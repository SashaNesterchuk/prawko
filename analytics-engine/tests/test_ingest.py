from datetime import date

from prawko_analytics.context import build_context, day_window
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


def test_warsaw_day_boundary_lands_in_the_partition(tmp_path):
    dump = write_dump(
        tmp_path / "dump.json",
        day="2026-10-03",
        exported_at="2026-10-04T08:00:00Z",
        events=[
            event("paywall_viewed", "2026-10-02T22:00:00Z", "usr_early"),
            event("paywall_viewed", "2026-10-03T20:00:00Z", "usr_late"),
        ],
    )
    warehouse = tmp_path / "warehouse"
    written = ingest_dump(dump, warehouse)
    assert [item.day for item in written] == [date(2026, 10, 3)]
    assert written[0].complete is True
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.dataset.event_rows == 2
    assert context.dataset.analysis_keys == 2
    assert context.dataset.window.complete is True


def test_partial_export_day_is_not_complete(tmp_path):
    dump = tmp_path / "dump.json"
    dump.write_text(
        """
        {
          "exportedAt": "2026-09-20T12:30:00Z",
          "from": "2026-09-12",
          "to": "2026-09-20",
          "timezone": "Europe/Warsaw",
          "events": [
            {
              "uuid": "early",
              "event": "paywall_viewed",
              "timestamp": "2026-09-12T10:00:00Z",
              "distinct_id": "usr_1",
              "properties": {"app_user_id": "usr_1", "app_version": "1.0.29", "analytics_schema_version": 3}
            },
            {
              "uuid": "late",
              "event": "paywall_viewed",
              "timestamp": "2026-09-20T10:00:00Z",
              "distinct_id": "usr_2",
              "properties": {"app_user_id": "usr_2", "app_version": "1.0.29", "analytics_schema_version": 3}
            }
          ]
        }
        """
    )
    written = ingest_dump(dump, tmp_path / "warehouse")
    by_day = {item.day: item.complete for item in written}
    # A date range alone does not prove pagination or delivery coverage.
    assert by_day[date(2026, 9, 12)] is False
    assert by_day[date(2026, 9, 20)] is False
