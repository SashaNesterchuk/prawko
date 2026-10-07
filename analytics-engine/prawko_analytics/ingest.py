"""Turn a PostHog JSON dump into day-partitioned Parquet."""

from __future__ import annotations

import json
import hashlib
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

WARSAW = ZoneInfo("Europe/Warsaw")


@dataclass(frozen=True)
class WrittenPartition:
    day: date
    path: Path
    event_rows: int
    complete: bool
    dump_id: str


def ingest_dump(dump_path: Path, warehouse: Path) -> list[WrittenPartition]:
    payload = json.loads(dump_path.read_text())
    dump_id = _dump_id(payload)
    exported_at = str(payload["exportedAt"])
    buckets: dict[date, list[tuple]] = {}
    for raw in payload["events"]:
        if not isinstance(raw.get("properties") or {}, dict):
            raise ValueError("Event properties must be an object.")
        properties = dict(raw.get("properties") or {})
        if isinstance(raw.get("received_at"), str):
            properties["_export_provider_received_at"] = raw["received_at"]
        timestamp = _parse_timestamp(raw["timestamp"])
        day = timestamp.astimezone(WARSAW).date()
        buckets.setdefault(day, []).append(
            (
                str(raw.get("uuid") or ""),
                str(raw["event"]),
                timestamp,
                raw.get("distinct_id"),
                raw.get("person_id"),
                raw.get("session_id"),
                dump_id,
                json.dumps(properties, separators=(",", ":"), default=str),
            )
        )
    # A verified empty day is a partition too; absence of events is not a missing export.
    for day in _coverage_days(payload):
        buckets.setdefault(day, [])
    written: list[WrittenPartition] = []
    for day in sorted(buckets):
        incoming = buckets[day]
        directory = warehouse / "events" / f"day={day.isoformat()}"
        directory.mkdir(parents=True, exist_ok=True)
        parquet_path = directory / "events.parquet"
        meta_path = directory / "partition.json"
        previous_meta = json.loads(meta_path.read_text()) if meta_path.is_file() else {}
        existing = _read_partition(parquet_path) if parquet_path.is_file() else []
        rows, duplicates = _deduplicate_rows(existing + incoming)
        prior_complete = previous_meta.get("metadata_version") == 2 and previous_meta.get("complete") is True
        complete = _partition_complete(payload, day) or prior_complete
        meta = {
            "metadata_version": 2,
            "dump_id": dump_id,
            "dump_ids": sorted(set(previous_meta.get("dump_ids", [])) | {dump_id}),
            "exported_at": exported_at,
            "complete": complete,
            "event_rows": len(rows),
            "incoming_rows": len(incoming),
            "duplicate_rows": duplicates,
            "conflict_rows": sum(json.loads(row[7]).get("_warehouse_import_conflict") is True for row in rows),
            "merge_policy": "append_dedupe_preserve_identity_conflicts",
            "coverage": payload.get("coverage") if _partition_complete(payload, day)
                else previous_meta.get("coverage") if prior_complete else None,
            "day": day.isoformat(),
        }
        # Never unlink the old partition before a successful write.
        with tempfile.TemporaryDirectory(dir=directory) as temporary:
            temp_parquet = Path(temporary) / "events.parquet"
            temp_meta = Path(temporary) / "partition.json"
            _write_parquet(temp_parquet, rows)
            temp_meta.write_text(json.dumps(meta, indent=2) + "\n")
            temp_parquet.replace(parquet_path)
            temp_meta.replace(meta_path)
        written.append(
            WrittenPartition(day, parquet_path, len(rows), complete, dump_id)
        )
    return written


def partition_days(warehouse: Path, start: datetime, end: datetime) -> list[tuple[date, Path | None, dict | None]]:
    if end <= start:
        return []
    day = start.astimezone(WARSAW).date()
    last = (end.astimezone(timezone.utc) - timedelta(microseconds=1)).astimezone(WARSAW).date()
    found = []
    while day <= last:
        directory = warehouse / "events" / f"day={day.isoformat()}"
        parquet_path = directory / "events.parquet"
        meta_path = directory / "partition.json"
        meta = json.loads(meta_path.read_text()) if meta_path.is_file() else None
        found.append((day, parquet_path if parquet_path.is_file() else None, meta))
        day += timedelta(days=1)
    return found


def load_events(parquet_paths: list[Path], start: datetime, end: datetime) -> list[dict]:
    if not parquet_paths:
        return []
    file_list = ", ".join(_sql_string(path.as_posix()) for path in parquet_paths)
    connection = duckdb.connect()
    try:
        start_sql = _sql_string(_utc_literal(start))
        end_sql = _sql_string(_utc_literal(end))
        result = connection.execute(
            f"""
            SELECT
              event_id,
              event,
              CAST(timezone('UTC', timestamp) AS VARCHAR) AS timestamp,
              distinct_id,
              person_id,
              dump_id,
              properties
            FROM read_parquet([{file_list}])
            WHERE timestamp >= TIMESTAMPTZ {start_sql}
              AND timestamp < TIMESTAMPTZ {end_sql}
            """
        )
        columns = [item[0] for item in result.description]
        loaded = []
        for row in result.fetchall():
            record = dict(zip(columns, row, strict=True))
            record["timestamp"] = _parse_timestamp(str(record["timestamp"]))
            props = json.loads(record["properties"])
            record["provider_event_id"] = record["event_id"]
            record["client_event_id"] = props.get("event_id")
            record["client_occurred_at"] = props.get("client_occurred_at")
            # The export timestamp is not a provider receipt timestamp.
            record["received_at"] = props.get("_export_provider_received_at") or props.get("$received_at")
            loaded.append(record)
        return loaded
    finally:
        connection.close()


def _write_parquet(path: Path, rows: list[tuple]) -> None:
    connection = duckdb.connect()
    try:
        connection.execute(
            """
            CREATE TABLE events (
              event_id VARCHAR,
              event VARCHAR,
              timestamp TIMESTAMPTZ,
              distinct_id VARCHAR,
              person_id VARCHAR,
              session_id VARCHAR,
              dump_id VARCHAR,
              properties VARCHAR
            )
            """
        )
        if rows:
            connection.executemany("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
        connection.execute(f"COPY events TO {_sql_string(path.as_posix())} (FORMAT PARQUET)")
    finally:
        connection.close()


def _dump_id(payload: dict) -> str:
    if payload.get("dump_id"):
        return str(payload["dump_id"])
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]
    return f"{payload.get('exportedAt', 'unknown')}:{digest}"


def _partition_complete(payload: dict, day: date) -> bool:
    coverage = payload.get("coverage")
    if not isinstance(coverage, dict):
        return False
    if coverage.get("pagination_complete") is not True or coverage.get("truncated") is not False:
        return False
    try:
        start = _parse_timestamp(coverage["window_start"])
        end = _parse_timestamp(coverage["window_end"])
        watermark = _parse_timestamp(coverage["delivery_watermark"])
        exported = _parse_timestamp(payload["exportedAt"])
    except (KeyError, TypeError, ValueError, AttributeError):
        return False
    day_start = datetime.combine(day, time.min, tzinfo=WARSAW)
    day_end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=WARSAW)
    return start <= day_start and day_end <= end and day_end <= watermark <= exported


def _coverage_days(payload: dict) -> list[date]:
    coverage = payload.get("coverage")
    if not isinstance(coverage, dict):
        return []
    try:
        start = _parse_timestamp(coverage["window_start"]).astimezone(WARSAW).date()
        end = _parse_timestamp(coverage["window_end"]).astimezone(WARSAW).date()
    except (KeyError, TypeError, ValueError, AttributeError):
        return []
    days = []
    current = start
    while current < end:
        if _partition_complete(payload, current):
            days.append(current)
        current += timedelta(days=1)
    return days


def _read_partition(path: Path) -> list[tuple]:
    connection = duckdb.connect()
    try:
        rows = connection.execute(
            "SELECT event_id, event, CAST(timezone('UTC', timestamp) AS VARCHAR), "
            "distinct_id, person_id, session_id, dump_id, properties "
            f"FROM read_parquet({_sql_string(path.as_posix())})"
        ).fetchall()
        return [(row[0], row[1], _parse_timestamp(row[2]), *row[3:]) for row in rows]
    finally:
        connection.close()


def _deduplicate_rows(rows: list[tuple]) -> tuple[list[tuple], int]:
    provider_bodies: dict[str, set[str]] = {}
    client_bodies: dict[tuple, set[str]] = {}
    prepared = []
    for row in rows:
        props = json.loads(row[7])
        client_id = props.get("event_id")
        client_id = client_id if isinstance(client_id, str) and client_id else None
        scope = props.get("app_user_id") or row[3]
        scope = scope if isinstance(scope, str) and scope else None
        client_key = (scope, client_id) if scope and client_id else None
        # Receipt/export metadata and SDK enrichment are not the immutable client body.
        body = {key: value for key, value in props.items()
                if not key.startswith(("$", "_warehouse_")) and key != "_export_provider_received_at"}
        fingerprint = hashlib.sha256(json.dumps(
            [row[1], row[2], row[3], body], sort_keys=True, default=str,
        ).encode()).hexdigest()
        if row[0]:
            provider_bodies.setdefault(row[0], set()).add(fingerprint)
        if client_key:
            client_bodies.setdefault(client_key, set()).add(fingerprint)
        prepared.append((row, props, client_key, fingerprint))
    provider_ids: set[tuple] = set()
    client_ids: set[tuple] = set()
    exact_rows: set[str] = set()
    result = []
    for row, props, client_key, fingerprint in prepared:
        provider_key = (row[0], fingerprint)
        scoped_body = (client_key, fingerprint)
        duplicate = (
            bool(row[0] and provider_key in provider_ids)
            or (client_key is not None and scoped_body in client_ids)
            or (not row[0] and client_key is None and fingerprint in exact_rows)
        )
        if row[0]:
            provider_ids.add(provider_key)
        if client_key is not None:
            client_ids.add(scoped_body)
        exact_rows.add(fingerprint)
        if not duplicate:
            conflicts = []
            if row[0] and len(provider_bodies[row[0]]) > 1:
                conflicts.append("provider")
            if client_key and len(client_bodies[client_key]) > 1:
                conflicts.append("client")
            if conflicts:
                props = {**props, "_warehouse_import_conflict": True,
                         "_warehouse_import_conflict_keys": ",".join(conflicts)}
                row = (*row[:7], json.dumps(props, separators=(",", ":")))
            result.append(row)
    return result, len(rows) - len(result)


def _parse_timestamp(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    if " " in text and "T" not in text:
        text = text.replace(" ", "T", 1)
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _utc_literal(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00")


def _sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"
