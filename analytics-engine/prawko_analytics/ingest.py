"""Turn a PostHog JSON dump into day-partitioned Parquet."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
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
                json.dumps(raw.get("properties") or {}, separators=(",", ":"), default=str),
            )
        )
    written: list[WrittenPartition] = []
    for day in sorted(buckets):
        rows = buckets[day]
        directory = warehouse / "events" / f"day={day.isoformat()}"
        directory.mkdir(parents=True, exist_ok=True)
        parquet_path = directory / "events.parquet"
        if parquet_path.exists():
            parquet_path.unlink()
        _write_parquet(parquet_path, rows)
        complete = _partition_complete(payload, day)
        meta = {
            "dump_id": dump_id,
            "exported_at": exported_at,
            "complete": complete,
            "event_rows": len(rows),
            "day": day.isoformat(),
        }
        (directory / "partition.json").write_text(json.dumps(meta, indent=2) + "\n")
        written.append(
            WrittenPartition(day, parquet_path, len(rows), complete, dump_id)
        )
    return written


def partition_days(warehouse: Path, start: datetime, end: datetime) -> list[tuple[date, Path | None, dict | None]]:
    day = start.astimezone(WARSAW).date()
    last = end.astimezone(WARSAW).date()
    found = []
    while day < last:
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
        connection.executemany("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
        connection.execute(f"COPY events TO {_sql_string(path.as_posix())} (FORMAT PARQUET)")
    finally:
        connection.close()


def _dump_id(payload: dict) -> str:
    if payload.get("day"):
        return str(payload["day"])
    if payload.get("from") and payload.get("to"):
        return f"{payload['from']}_{payload['to']}"
    return str(payload.get("exportedAt"))


def _partition_complete(payload: dict, day: date) -> bool:
    exported = _parse_timestamp(str(payload["exportedAt"])).astimezone(WARSAW).date()
    if payload.get("day"):
        declared = date.fromisoformat(str(payload["day"]))
        return day == declared and exported > declared
    if payload.get("to"):
        end = date.fromisoformat(str(payload["to"]))
        return day < end
    return False


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
