from datetime import date

import pytest

from prawko_analytics.context import build_context, day_window
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.paths import REPO_ROOT

DUMP = REPO_ROOT / "docs/analytics/prawko-posthog-dump-2026-10-03.json"


@pytest.mark.skipif(not DUMP.is_file(), reason="Oct 3 PostHog dump is gitignored")
def test_oct_3_context_matches_the_manual_review(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_dump(DUMP, warehouse)
    context = build_context(warehouse, day_window(date(2026, 10, 3)))

    assert context.dataset.event_rows == 4264
    assert context.dataset.analysis_keys == 20
    assert context.dataset.window.complete is False
    assert context.identity.quality == "ok"
    assert context.identity.primary_analysis_key == "app_user_id"
    assert context.identity.fallback_rows == 99
    assert context.report_policy.recommendations_enabled is False
    assert context.report_policy.causal_hypotheses_enabled is False
    assert context.report_policy.status == "limited"
    assert context.acquisition_mix.status == "unavailable"

    app_keys = {item.version: item.analysis_keys for item in context.versions.app_versions}
    assert app_keys["1.0.29"] == 8
    assert app_keys["1.0.28"] == 11
    assert app_keys["1.0.25"] == 1
    schema = {item.version: item for item in context.versions.analytics_schema_versions}
    assert schema[3].analysis_keys == 8
    assert schema[3].event_rows == 2679
    assert context.versions.analysis_keys_are_partition is False

    spotlight = next(item for item in context.declared_absences if item.event == "first_start_shown")
    assert spotlight.event_rows == 0
    assert spotlight.zero_events_mean == "feature_not_in_current_ui"
    assert "onboarding_dropoff" in spotlight.must_not_be_interpreted_as
    notifications = next(
        item for item in context.declared_absences if item.interpretation_id == "inactive_notifications"
    )
    assert notifications.zero_events_mean == "feature_not_in_current_ui"

    restart = [item for item in context.observations if item.event == "exam_restart_gate_shown"]
    assert restart
    assert all("daily_exam_cap" in item.must_not_be_interpreted_as for item in restart)

    inline = [item for item in context.observations if item.interpretation_id == "inline_lock_after_answer"]
    assert sum(item.event_rows for item in inline) == 200
    assert "purchase_intent" in inline[0].must_not_be_interpreted_as
    assert "explain_tap" in inline[0].must_not_be_interpreted_as

    disabled_ads = [
        item
        for item in context.observations
        if item.event == "ad_skipped" and item.interpretation_id == "policy_disabled"
    ]
    assert sum(item.event_rows for item in disabled_ads) == 509
    assert all("broken_ads" in item.must_not_be_interpreted_as for item in disabled_ads)
    assert not any(item.interpretation_id == "other_skip" for item in context.observations)

    signature = next(item for item in context.error_signatures if item.id == "guest_answer_sync_denied")
    assert signature.event_rows == 200
    assert signature.analysis_keys == 6
    assert signature.confidence_ceiling == "high"
    assert signature.evidence_class == "deterministic_fact"

    paywall = [
        item
        for item in context.metrics
        if item.id == "paywall_purchase_conversion"
        and item.slice.get("app_version") == "1.0.29"
        and item.slice.get("analytics_schema_version") == 3
    ]
    assert len(paywall) == 1
    assert paywall[0].numerator == 0
    assert paywall[0].denominator == 6
    assert paywall[0].eligibility.status == "prohibited"
    assert paywall[0].value is None
    assert paywall[0].lead_visible is False
    assert any(
        reason.rule == "min_denominator" and reason.actual == 6 and reason.required == 30
        for reason in paywall[0].eligibility.reasons
    )

    exam = [item for item in context.metrics if item.id == "exam_pass_rate"]
    assert exam
    assert sum(item.numerator for item in exam) == 0
    assert sum(item.denominator for item in exam) == 7
    assert all(item.eligibility.status == "prohibited" for item in exam)

    d7 = next(item for item in context.metrics if item.id == "d7_return")
    assert d7.eligibility.status == "prohibited"
    assert any(reason.rule == "cohort_not_mature" for reason in d7.eligibility.reasons)

    screens = next(item for item in context.uninterpreted_events if item.event == "screen_viewed")
    assert screens.reason == "no_contract_entry"
    assert screens.event_rows == 366

    assert any(item.id == "event_concentration" and item.severity == "WARNING" for item in context.qa)
    assert not any(item.severity == "FATAL" for item in context.qa)
