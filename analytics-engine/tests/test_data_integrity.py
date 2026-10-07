import json
from datetime import date

import pytest

from prawko_analytics.context import build_context, day_window
from prawko_analytics.ingest import ingest_dump, load_events
from tests.support import event, write_dump


def _load(warehouse):
    window = day_window(date(2026, 10, 3))
    return load_events([warehouse / "events/day=2026-10-03/events.parquet"], window.start, window.end)


def _partial(path, events):
    path.write_text(json.dumps({"exportedAt": "2026-10-04T09:00:00Z", "day": "2026-10-03", "events": events}))
    return path


def test_overlapping_partial_dump_merges_without_erasing_previous_rows(tmp_path):
    first = event("paywall_viewed", "2026-10-03T10:00:00Z", "a", event_id="client-1")
    second = event("paywall_viewed", "2026-10-03T11:00:00Z", "b", event_id="client-2")
    full = write_dump(tmp_path / "full.json", day="2026-10-03",
                      exported_at="2026-10-04T08:00:00Z", events=[first, second])
    warehouse = tmp_path / "warehouse"
    ingest_dump(full, warehouse)
    duplicate = {**first, "uuid": "redelivered-with-another-provider-id"}
    third = event("paywall_viewed", "2026-10-03T12:00:00Z", "c", event_id="client-3")
    partial = _partial(tmp_path / "partial.json", [duplicate, third])
    result = ingest_dump(partial, warehouse)
    assert result[0].event_rows == 3
    assert result[0].complete is True  # Earlier verified coverage remains valid as of its watermark.
    assert {row["client_event_id"] for row in _load(warehouse)} == {"client-1", "client-2", "client-3"}
    meta = json.loads((warehouse / "events/day=2026-10-03/partition.json").read_text())
    assert len(meta["dump_ids"]) == 2
    assert meta["duplicate_rows"] == 1
    assert meta["coverage"]["delivery_watermark"] == "2026-10-04T08:00:00Z"


def test_reimport_is_idempotent_and_distinct_provider_events_are_not_collapsed(tmp_path):
    first = event("paywall_viewed", "2026-10-03T10:00:00Z", "a")
    second = {**first, "uuid": "another-actual-event"}
    dump = _partial(tmp_path / "dump.json", [first, second, first])
    warehouse = tmp_path / "warehouse"
    assert ingest_dump(dump, warehouse)[0].event_rows == 2
    assert ingest_dump(dump, warehouse)[0].event_rows == 2


def test_failed_parquet_write_preserves_the_existing_partition(tmp_path, monkeypatch):
    dump = _partial(tmp_path / "dump.json", [event("paywall_viewed", "2026-10-03T10:00:00Z", "a")])
    warehouse = tmp_path / "warehouse"
    ingest_dump(dump, warehouse)
    def fail(*_args):
        raise OSError("simulated storage failure")
    monkeypatch.setattr("prawko_analytics.ingest._write_parquet", fail)
    with pytest.raises(OSError):
        ingest_dump(dump, warehouse)
    assert len(_load(warehouse)) == 1


@pytest.mark.parametrize("change", [
    {"pagination_complete": False}, {"truncated": True},
    {"delivery_watermark": "2026-10-03T12:00:00Z"},
    {"delivery_watermark": "2026-10-05T12:00:00Z"},
])
def test_unverified_pagination_or_delivery_prohibits_rates(tmp_path, change):
    dump = write_dump(tmp_path / "dump.json", day="2026-10-03",
                      exported_at="2026-10-04T08:00:00Z", events=[
                          event("paywall_viewed", "2026-10-03T10:00:00Z", "a", paywall_view_id="v"),
                      ])
    payload = json.loads(dump.read_text())
    payload["coverage"].update(change)
    dump.write_text(json.dumps(payload))
    warehouse = tmp_path / "warehouse"
    assert ingest_dump(dump, warehouse)[0].complete is False
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.dataset.window.complete is False
    assert all(metric.value is None and not metric.lead_visible for metric in context.metrics)
    assert all(any(reason.rule == "incomplete_coverage" for reason in metric.eligibility.reasons)
               for metric in context.metrics)


def test_verified_empty_day_is_not_a_missing_partition(tmp_path):
    dump = write_dump(tmp_path / "dump.json", day="2026-10-03",
                      exported_at="2026-10-04T08:00:00Z", events=[])
    warehouse = tmp_path / "warehouse"
    written = ingest_dump(dump, warehouse)
    assert len(written) == 1 and written[0].event_rows == 0 and written[0].complete
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.dataset.window.complete
    assert not any(item.id == "missing_partition" for item in context.qa)


def test_provider_receipt_time_is_preserved_without_substituting_export_time(tmp_path):
    first = {
        **event("paywall_viewed", "2026-10-03T10:00:00Z", "a", event_id="client-1",
                client_occurred_at="2026-10-03T09:59:59Z"),
        "received_at": "2026-10-03T12:00:00Z",
    }
    second = event("paywall_viewed", "2026-10-03T11:00:00Z", "b")
    warehouse = tmp_path / "warehouse"
    ingest_dump(_partial(tmp_path / "dump.json", [first, second]), warehouse)
    by_user = {row["distinct_id"]: row for row in _load(warehouse)}
    assert by_user["a"]["client_event_id"] == "client-1"
    assert by_user["a"]["provider_event_id"] == first["uuid"]
    assert by_user["a"]["client_occurred_at"] == "2026-10-03T09:59:59Z"
    assert by_user["a"]["received_at"] == "2026-10-03T12:00:00Z"
    assert by_user["b"]["received_at"] is None


@pytest.mark.parametrize("key", ["provider", "client"])
def test_conflicting_event_identity_retains_both_bodies_and_prohibits_metrics(tmp_path, key):
    first = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", event_id="client-one", paywall_view_id="v1")
    second = {
        **first, "uuid": first["uuid"] if key == "provider" else "provider-two",
        "properties": {**first["properties"], "paywall_view_id": "v2",
                       "event_id": "client-two" if key == "provider" else "client-one"},
    }
    warehouse = tmp_path / "warehouse"
    ingest_dump(_partial(tmp_path / "first.json", [first]), warehouse)
    ingest_dump(_partial(tmp_path / "second.json", [second]), warehouse)
    rows = _load(warehouse)
    assert len(rows) == 2
    assert all(json.loads(row["properties"])["_warehouse_import_conflict"] for row in rows)
    assert ingest_dump(_partial(tmp_path / "second.json", [second]), warehouse)[0].event_rows == 2
    meta = json.loads((warehouse / "events/day=2026-10-03/partition.json").read_text())
    assert meta["conflict_rows"] == 2
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert any(item.id == "import_identity_conflict" for item in context.qa)
    assert all(metric.value is None for metric in context.metrics)
    assert any(metric.import_conflict_rows == 2 for metric in context.metrics)


def test_same_client_id_under_another_event_is_a_conflict_not_two_valid_observations(tmp_path):
    first = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", event_id="client-one")
    second = event("purchase_started", "2026-10-03T11:00:00Z", "usr_i", event_id="client-one")
    warehouse = tmp_path / "warehouse"
    ingest_dump(_partial(tmp_path / "dump.json", [first, second]), warehouse)
    assert all(json.loads(row["properties"])["_warehouse_import_conflict"] for row in _load(warehouse))


def test_same_client_id_on_different_installs_remains_separate_and_receipt_drift_is_not_a_conflict(tmp_path):
    first = {
        **event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", event_id="run:1"),
        "received_at": "2026-10-03T11:00:00Z",
    }
    delivered_again = {**first, "uuid": "provider-new", "received_at": "2026-10-03T12:00:00Z",
                       "properties": {**first["properties"], "$geoip_city_name": "New enrichment"}}
    another_install = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_other", event_id="run:1")
    warehouse = tmp_path / "warehouse"
    ingest_dump(_partial(tmp_path / "dump.json", [first, delivered_again, another_install]), warehouse)
    rows = _load(warehouse)
    assert len(rows) == 2
    assert not any(json.loads(row["properties"]).get("_warehouse_import_conflict") for row in rows)
