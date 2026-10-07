import json
from datetime import date

import pytest

from prawko_analytics.context import build_context, day_window
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.rewarded_ads import rewarded_ad_report
from tests.support import event, write_dump
from tests.test_content_observations import prepared


def ad(name="ad_requested", timestamp="2026-10-07T10:00:00Z", install="usr_i", **changes):
    return event(name, timestamp, install, **{
        "ad_observation_version": 1, "ad_format": "rewarded", "placement": "exam_unlock",
        "ad_request_id": "request-1", "ad_impression_id": "impression-1", "ad_unit_basis": "test_unit",
        "ad_native_load_observed": True, "ad_opened_observed": False, **changes,
    })


def native(**changes):
    return ad("ad_native_request_started", "2026-10-07T10:00:01Z", ad_request_basis="sdk_load_invoked", **changes)


def impression(**changes):
    return ad("ad_impression_observed", "2026-10-07T10:00:02Z",
              ad_impression_basis="sdk_paid_callback", ad_native_terminal_observed=False, **changes)


def paid(**changes):
    return ad("ad_impression_revenue", "2026-10-07T10:00:03Z", **{
        "revenue": 0.0025, "currency": "USD", "revenue_precision": "precise",
        "ad_paid_callback_sequence": 1, "ad_paid_basis": "sdk_paid_value",
        "ad_native_terminal_observed": False, **changes,
    })


def report(*raws, complete=True):
    return rewarded_ad_report([prepared(raw) for raw in raws], coverage_complete=complete)


def test_disabled_opportunities_and_opened_are_not_impressions_or_native_loads():
    disabled = ad("ad_failed", ad_impression_id=None, ad_unit_basis="not_resolved", ad_native_load_observed=False,
                  ad_failure_category="disabled", ad_failure_stage="policy")
    result = report(disabled, disabled)
    assert result["stages"]["disabled_opportunity_units"] == 1
    assert result["stages"]["native_load_invocation_units"] == 0
    assert result["paid_impressions"] == 0
    opened = report(ad(), native(), ad("ad_shown", ad_opened_observed=True))
    assert opened["stages"]["opened_units"] == 1
    assert opened["stages"]["paid_impression_evidence_units"] == 0
    assert opened["stages"]["terminal_unobserved_units"] == 1


def test_identical_paid_callbacks_add_one_impression_and_late_values_do_not_add_rewards():
    result = report(ad(), native(), impression(), paid(), paid(ad_paid_callback_sequence=2, ad_native_terminal_observed=True),
                    ad("ad_reward_earned", reward="exam_attempt"), ad("ad_dismissed", reward_earned=True))
    assert result["paid_impressions"] == 1
    assert result["stages"]["earned_reward_units"] == 1
    assert result["quality"]["duplicate_paid_observations"] == 1
    assert result["quality"]["late_paid_observations"] == 1
    assert result["sdk_paid_values"]["currencies"] == [
        {"currency": "USD", "amount": "0.0025", "impressions": 1, "precision_counts": {"precise": 1}},
    ]
    assert result["sdk_paid_values"]["basis"] == "client_sdk_paid_value_not_settled_money"
    assert result["quality_issue_count"] == 0


@pytest.mark.parametrize("change", [
    {"revenue": 0.005}, {"currency": "EUR"}, {"revenue_precision": "estimated"},
])
def test_conflicting_paid_values_stay_visible_but_add_no_money(change):
    result = report(ad(), native(), impression(), paid(), paid(ad_paid_callback_sequence=2, **change))
    assert result["quality"]["conflicting_paid_impressions"] == 1
    assert result["paid_impressions"] == 0
    assert not result["sdk_paid_values"]["currencies"]


def test_currencies_and_install_scopes_are_not_pooled_and_other_formats_remain_legacy():
    usd = [ad(), native(), impression(), paid()]
    eur = [ad(install="usr_other"), native(app_user_id="usr_other"), impression(app_user_id="usr_other"),
           paid(app_user_id="usr_other", currency="EUR", revenue=0.125)]
    legacy = event("ad_impression_revenue", "2026-10-07T10:00:05Z", "usr_i",
                   ad_format="interstitial", revenue=1000, currency="USD")
    result = report(*usd, *eur, legacy)
    assert result["paid_impressions"] == 2
    assert {item["currency"]: item["amount"] for item in result["sdk_paid_values"]["currencies"]} == {
        "EUR": "0.125", "USD": "0.0025",
    }
    assert result["quality"]["other_format_observations"] == 1


@pytest.mark.parametrize("changes", [
    {"revenue": True}, {"revenue": -1}, {"revenue": float("inf")}, {"revenue": 10 ** 400},
    {"currency": "unknown"}, {"currency": "learner@example.com"},
    {"ad_paid_callback_sequence": True}, {"ad_impression_id": None},
    {"ad_paid_basis": "settled_money"}, {"ad_native_load_observed": False},
])
def test_invalid_paid_shapes_do_not_enter_currency_totals_or_export_private_values(changes):
    result = report(ad(), native(), impression(), paid(**changes))
    assert not result["sdk_paid_values"]["currencies"]
    assert result["quality_issue_count"] > 0
    assert "learner@example.com" not in json.dumps(result)


def test_paid_requires_both_native_request_and_paid_impression_evidence():
    assert report(ad(), impression(), paid())["paid_impressions"] == 0
    assert report(ad(), native(), paid())["paid_impressions"] == 0

def test_paid_order_requires_app_run_sequence_on_equal_timestamps_and_optional_failure_is_limited():
    request = native()
    observed, value = impression(), paid()
    request["timestamp"] = observed["timestamp"] = value["timestamp"] = "2026-10-07T10:00:01Z"
    for index, raw in enumerate((request, observed, value), 1):
        raw["properties"].update(runtime_id="not-real-order", event_sequence=index)
    assert report(ad(), request, observed, value)["paid_impressions"] == 0
    for raw in (request, observed, value):
        raw["properties"]["app_run_id"] = "real-run"
    assert report(value, observed, request, ad())["paid_impressions"] == 1
    failed = ad("ad_observation_failed", observation_stage="paid_listener_registration", why="observation_failed")
    assert report(ad(), failed)["status"] == "limited_integrity"


def test_scope_collisions_and_invalid_observations_quarantine_requests():
    result = report(ad(), native(), impression(), paid(), ad("ad_shown", ad_request_id="other-request", ad_opened_observed=True))
    assert result["quality"]["conflicting_request_scopes"] == 2
    assert result["paid_impressions"] == 0
    result = report(ad(), native(), impression(), paid(), ad("ad_shown", analytics_payload_valid=False))
    assert result["quality"]["quarantined_request_scopes"] == 1
    assert result["paid_impressions"] == 0
    result = report(ad(ad_observation_version=True))
    assert result["quality"]["invalid_observations"] == 1


def test_normalized_failures_and_reward_disagreements_are_diagnostics_not_grants():
    result = report(ad(), native(), ad("ad_failed", ad_failure_category="no_fill", ad_failure_stage="sdk_event"))
    assert result["failure_categories"] == {"no_fill": 1}
    assert result["stages"]["earned_reward_units"] == 0
    result = report(ad(), native(), ad("ad_dismissed", reward_earned=True))
    assert result["quality"]["reward_terminal_disagreement_units"] == 1


def test_context_health_and_qa_keep_sdk_values_separate_from_revenuecat_finance(tmp_path):
    raws = [ad(), native(), impression(), paid()]
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "dump.json", day="2026-10-07",
                           exported_at="2026-10-08T08:00:00Z", events=raws), warehouse)
    window = day_window(date(2026, 10, 7))
    context = build_context(warehouse, window)
    health = build_health([prepared(raw) for raw in raws], window_start=window.start,
                          window_end=window.end, coverage_complete=True)
    assert context.rewarded_ads == health.rewarded_ads
    assert context.rewarded_ads["paid_impressions"] == 1
    assert context.financial["status"] == "not_loaded"


def test_paid_conflict_reaches_context_qa_without_becoming_a_financial_effect(tmp_path):
    conflict = paid(revenue=0.005, ad_paid_callback_sequence=2)
    conflict["timestamp"] = "2026-10-07T10:00:04Z"
    conflict["uuid"] = "conflicting-paid"
    raws = [ad(), native(), impression(), paid(), conflict]
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "dump.json", day="2026-10-07",
                           exported_at="2026-10-08T08:00:00Z", events=raws), warehouse)
    context = build_context(warehouse, day_window(date(2026, 10, 7)))
    assert "rewarded_ad_observations_limited" in {item.id for item in context.qa}
    assert context.rewarded_ads["quality"]["conflicting_paid_impressions"] == 1
    assert not context.rewarded_ads["sdk_paid_values"]["currencies"]
