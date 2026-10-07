"""Explicit application coverage and available client history, not delivery proof."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from prawko_analytics.acquisition_mapping import moment
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import WARSAW, load_events, partition_days


def _time(value):
    try:
        return moment(value)
    except (ValueError, OverflowError):
        return None


def application_covered(warehouse, application_id, left, right):
    if (
        not safe_identity_id(application_id) or left.tzinfo is None or right.tzinfo is None or not left < right
    ):
        return False
    partitions = partition_days(warehouse, left, right)
    for day, path, meta in partitions:
        if (
            path is None or not isinstance(meta, dict) or type(meta.get("metadata_version")) is not int
            or meta["metadata_version"] != 2 or meta.get("complete") is not True
        ):
            return False
        source = meta.get("coverage")
        if not isinstance(source, dict):
            return False
        applications = source.get("application_ids")
        if (
            source.get("pagination_complete") is not True or source.get("truncated") is not False
            or not isinstance(applications, list) or not 0 < len(applications) <= 100
            or any(safe_identity_id(value) is None for value in applications) or application_id not in applications
        ):
            return False
        start, end, watermark = (
            _time(source.get(field)) for field in ("window_start", "window_end", "delivery_watermark")
        )
        day_start = datetime.combine(day, time.min, tzinfo=WARSAW)
        day_end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=WARSAW)
        if (
            start is None or end is None or watermark is None
            or start > max(left, day_start) or min(right, day_end) > min(end, watermark)
        ):
            return False
    return bool(partitions)


def available_client_history(warehouse, start, through, contract):
    from prawko_analytics.context import _prepare

    days = []
    for path in (warehouse / "events").glob("day=*/events.parquet"):
        try:
            left = datetime.combine(date.fromisoformat(path.parent.name.removeprefix("day=")), time.min, tzinfo=WARSAW)
            if left < through:
                days.append(left)
        except ValueError:
            continue
    history_start = min([start, *days])
    paths = [path for _, path, _ in partition_days(warehouse, history_start, through) if path is not None]
    rows = [_prepare(raw, contract) for raw in load_events(paths, history_start, through)]
    return rows, min(days).isoformat() if days else None
