from dataclasses import replace
from datetime import date

from prawko_analytics.context import build_context, day_window
from prawko_analytics.contract import load_contract
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


def _trace(user="a", view="view-1", attempt="attempt-1", start="10", offset=0):
    events = [
        ("paywall_viewed", 0, {}),
        ("paywall_offer_ready", 1, {}),
        ("paywall_cta_selected", 2, {"action": "purchase"}),
        ("purchase_started", 3, {"purchase_attempt_id": attempt}),
        ("purchase_succeeded", 4, {"purchase_attempt_id": attempt}),
    ]
    return [
        event(name, f"2026-10-03T{start}:{index + offset:02d}:00Z", user, paywall_view_id=view, **props)
        for name, index, props in events
    ]


def _context(tmp_path, events):
    dump = write_dump(tmp_path / "dump.json", day="2026-10-03",
                      exported_at="2026-10-04T08:00:00Z", events=events)
    warehouse = tmp_path / "warehouse"
    ingest_dump(dump, warehouse)
    contract = load_contract()
    contract = replace(contract, metrics=tuple(replace(metric, min_denominator=1) for metric in contract.metrics))
    return build_context(warehouse, day_window(date(2026, 10, 3)), contract)


def _metric(context):
    return next(item for item in context.metrics if item.id == "paywall_purchase_conversion")


def _funnel(context):
    return next(item for item in context.funnels if item.id == "paywall_purchase")


def test_retries_preserve_view_grain_and_do_not_double_count_conversion(tmp_path):
    events = _trace() + _trace(attempt="retry-2", offset=5)[2:]
    context = _context(tmp_path, events)
    assert [step.units for step in _funnel(context).steps] == [1, 1, 1, 1, 1]
    metric = _metric(context)
    assert metric.numerator == metric.denominator == 1
    assert metric.value == 1


def test_purchase_without_view_or_before_native_start_is_not_conversion(tmp_path):
    events = _trace()
    events[-1]["timestamp"] = "2026-10-03T09:59:00Z"
    events.append(event("purchase_succeeded", "2026-10-03T10:05:00Z", "outsider",
                        paywall_view_id="missing-view", purchase_attempt_id="missing-attempt"))
    context = _context(tmp_path, events)
    assert _metric(context).numerator == 0
    assert _metric(context).denominator == 1
    assert _funnel(context).steps[-1].units == 0


def test_same_user_different_view_or_attempt_does_not_cross_join(tmp_path):
    events = _trace()
    events[-1]["properties"]["purchase_attempt_id"] = "another-attempt"
    context = _context(tmp_path, events)
    assert _metric(context).numerator == 0
    assert _funnel(context).steps[-1].units == 0


def test_ids_do_not_cross_join_different_install_identities(tmp_path):
    events = _trace()
    events[-1] = event("purchase_succeeded", "2026-10-03T10:04:00Z", "another-user",
                        paywall_view_id="view-1", purchase_attempt_id="attempt-1")
    assert _metric(_context(tmp_path, events)).numerator == 0


def test_outcome_outside_metric_horizon_does_not_convert(tmp_path):
    events = _trace()
    events[-1]["timestamp"] = "2026-10-03T12:00:00Z"
    context = _context(tmp_path, events)
    assert _metric(context).numerator == 0
    assert _metric(context).conversion_window_seconds == 3600
    # The separate diagnostic funnel explicitly has a longer 24-hour window.
    assert _funnel(context).steps[-1].units == 1


def test_immature_views_are_censored_not_failed(tmp_path):
    context = _context(tmp_path, _trace(start="21", offset=30))
    metric = _metric(context)
    assert metric.censored_units == 1
    assert metric.denominator == metric.numerator == 0
    assert metric.value is None


def test_missing_join_ids_prohibit_a_rate_instead_of_inventing_a_link(tmp_path):
    events = _trace()
    del events[-1]["properties"]["purchase_attempt_id"]
    metric = _metric(_context(tmp_path, events))
    assert metric.unjoinable_rows == 1
    assert metric.value is None
    assert any(reason.rule == "missing_join_id" for reason in metric.eligibility.reasons)


def test_client_sequence_resolves_equal_timestamp_order(tmp_path):
    events = _trace()
    for index, row in enumerate(events):
        row["timestamp"] = "2026-10-03T10:00:00Z"
        row["properties"].update(app_run_id="run-1", event_sequence=index + 1)
    events[-1]["properties"]["event_sequence"] = 1
    assert _metric(_context(tmp_path, events)).numerator == 0


def test_invalid_client_payload_prohibits_a_rate_even_with_join_ids(tmp_path):
    events = _trace()
    events[-1]["properties"]["analytics_payload_valid"] = False
    metric = _metric(_context(tmp_path, events))
    assert metric.invalid_payload_rows == 1
    assert metric.unjoinable_rows == 0
    assert metric.value is None and not metric.lead_visible
    assert any(reason.rule == "invalid_client_payload" for reason in metric.eligibility.reasons)
