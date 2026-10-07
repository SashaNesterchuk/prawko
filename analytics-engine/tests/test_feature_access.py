from datetime import date, datetime

import pytest

from prawko_analytics.access import feature_access_report
from prawko_analytics.context import _prepare, build_context, day_window
from prawko_analytics.contract import load_contract
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


def access_event(**props):
    properties = {
        "access_observation_version": 1, "access_rule_version": "plus-feature-observation-v1",
        "access_observed_feature": "offline_mode", "access_expected": "allowed", "access_observed": "blocked",
        "access_comparison": "blocked_despite_plus", "access_expected_is_plus": True,
        "access_expected_source": "purchase", "access_snapshot_basis": "current_local_entitlement_store",
        "access_customer_info_age_ms": 60_000, "access_customer_info_clock_order": "ordered", **props,
    }
    return event("offline_access_blocked", "2026-10-03T10:00:00Z", "usr_i", **properties)


def prepared(raw):
    raw["timestamp"] = datetime.fromisoformat(raw["timestamp"].replace("Z", "+00:00"))
    return _prepare(raw, load_contract())


def test_access_report_labels_observation_counts_without_revenue_or_error_rates():
    result = feature_access_report([prepared(access_event())], coverage_complete=True)
    assert result["potential_mismatch_events"] == 1
    assert result["groups"][0]["feature"] == "offline_mode"
    assert result["groups"][0]["access_sources"] == {"purchase": 1}
    assert result["groups"][0]["max_customer_info_age_ms"] == 60_000
    assert "rate" not in result
    assert result["identity_grain"] == "app_user_id_installation"


@pytest.mark.parametrize("change", [
    {"access_expected_is_plus": False},
    {"access_comparison": "consistent"},
    {"access_customer_info_age_ms": -1},
    {"access_customer_info_age_ms": True},
    {"access_customer_info_age_ms": 10 ** 400},
    {"access_expected": []},
    {"access_expected_source": {"email": "learner@example.com"}},
    {"app_user_id": "learner@example.com"},
    {"analytics_payload_valid": False},
    {"_warehouse_import_conflict": True},
])
def test_invalid_or_contradictory_observations_do_not_become_access_mismatches(change):
    raw = access_event()
    raw["properties"].update(change)
    result = feature_access_report([prepared(raw)], coverage_complete=True)
    assert result["invalid_observations"] == 1
    assert result["potential_mismatch_events"] == 0
    assert "learner@example.com" not in str(result)


def test_unknown_customer_info_age_and_uninstrumented_surfaces_are_explicit():
    raw = access_event()
    raw["properties"].update(access_customer_info_age_ms=None, access_customer_info_clock_order="future")
    result = feature_access_report([
        prepared(raw), prepared(event("paywall_viewed", "2026-10-03T11:00:00Z", "usr_i", is_plus=True)),
        prepared(event("premium_gate_viewed", "2026-10-03T12:00:00Z", "usr_i")),
    ])
    assert result["customer_info_clock_issues"] == 1
    assert result["groups"][0]["unknown_customer_info_age_rows"] == 1
    assert result["uninstrumented_surface_events"] == 1
    assert result["observed_events"] == 1
    assert result["status"] == "limited"


def test_context_and_health_expose_the_same_feature_diagnostics(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(
        tmp_path / "dump.json", day="2026-10-03", exported_at="2026-10-04T08:00:00Z", events=[access_event()],
    ), warehouse)
    window = day_window(date(2026, 10, 3))
    context = build_context(warehouse, window)
    health = build_health(
        [prepared(access_event())], window_start=window.start, window_end=window.end, coverage_complete=True,
    )
    assert context.feature_access == health.feature_access
    assert context.feature_access["potential_mismatch_events"] == 1
