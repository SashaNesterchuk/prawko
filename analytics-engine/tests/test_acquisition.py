import json
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from prawko_analytics.acquisition import TERMINAL, observed_acquisition, warehouse_acquisition_report
from prawko_analytics.cli import main
from prawko_analytics.context import _prepare, build_context, day_window
from prawko_analytics.contract import load_contract
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump

UTC = timezone.utc
START = datetime(2026, 9, 1, tzinfo=UTC)
END = START + timedelta(days=1)
FIRST = START + timedelta(hours=10)
THROUGH = START + timedelta(days=32)
ATTRIBUTION = {
    "asa_result": "attributed", "asa_org_id": 123, "asa_campaign_id": 456,
    "asa_ad_group_id": 789, "asa_keyword_id": None, "asa_ad_id": None,
    "asa_claim_type": "Click", "asa_conversion_type": "Download",
    "asa_click_date": "2026-09-01T09:59Z", "asa_impression_date": None,
    "asa_country_or_region": "PL", "asa_unavailable_reason": None,
}


def _row(name, *, user="install-a", at=FIRST, anchor=True, **props):
    body = {
        "installation_observation_id": f"observation-{user}", "first_observed_at": FIRST.isoformat(),
        "observation_detection_method": "first_local_observation", "observation_contract_version": 1,
        "native_installed_at": "2026-08-01T10:00:00Z",
    } if anchor else {}
    raw = event(name, at.isoformat(), user, **{**body, **props})
    raw["event_id"] = raw["uuid"]
    raw["timestamp"] = at
    return _prepare(raw, load_contract())


def _asa(*, at=FIRST + timedelta(minutes=5), **props):
    return _row(TERMINAL, at=at, **{**ATTRIBUTION, **props})


def _purchase(*, at=FIRST + timedelta(minutes=1), **props):
    return _row(
        "purchase_succeeded", at=at,
        **{
            "purchase_attempt_id": "checkout-a", "transaction_id": "transaction-a",
            "product_id": "pl.month", "native_purchase_completed": True, **props,
        },
    )


def _learn(*, at=FIRST + timedelta(minutes=2), **props):
    return _row(
        "training_session_completed", at=at,
        **{
            "training_session_id": f"training-{at.strftime('%Y%m%dT%H%M%S')}", "accepted_unique_question_count": 5,
            "learning_outcome_rule_version": "learning-v1", **props,
        },
    )


def _report(rows, **options):
    return observed_acquisition(
        rows, **{"start": START, "end": END, "observe_through": THROUGH, "coverage_complete": True, **options},
    )


def _cohort(report, *, result="attributed", days=7):
    return next(item for item in report["cohorts"] if item["asa_result"] == result and item["days"] == days)


def _buckets(report):
    return {item["asa_result"]: item for item in report["mix"]["buckets"]}


def test_super_properties_and_visit_entries_are_not_acquisition_checks():
    report = _report([
        _row("profile_action_selected", **ATTRIBUTION),
        _row("app_entry_resolved", entry_source="notification", **ATTRIBUTION),
        _purchase(**ATTRIBUTION),
    ])
    assert report["mix"]["status"] == "unavailable"
    assert report["mix"]["installations"] == 1
    assert report["mix"]["terminal_observations"] == 0
    assert _buckets(report)["unknown"]["installations"] == 1
    assert _cohort(report, result="unknown")["observed_client_purchasers"] == 1
    assert _cohort(report, result="unknown")["client_purchase_fraction"] is None


def test_each_install_is_counted_once_not_once_per_event_or_person():
    report = _report([
        _asa(), _asa(at=FIRST + timedelta(hours=1)),
        _row("profile_action_selected", **ATTRIBUTION),
        _asa(user="install-b"), _purchase(), _learn(),
    ])
    assert report["mix"]["status"] == "observed"
    assert report["mix"]["installations"] == 2
    assert report["mix"]["terminal_observations"] == 2
    assert report["mix"]["buckets"][0]["share"] == 1
    assert report["installations"][0]["duplicate_terminal_rows"] == 1
    assert _cohort(report)["observed_client_purchasers"] == 1
    assert _cohort(report)["client_purchase_fraction"] == 0.5


def test_delayed_resolution_joins_purchase_by_installation_not_time_or_account():
    report = _report([
        _row("install_observation_resolved"), _purchase(),
        _asa(at=FIRST + timedelta(days=2)),
        _asa(user="install-b", at=FIRST + timedelta(days=3), asa_campaign_id=999),
    ])
    campaign = next(item for item in report["cohorts"] if item["asa_campaign_id"] == 456 and item["days"] == 7)
    other = next(item for item in report["cohorts"] if item["asa_campaign_id"] == 999 and item["days"] == 7)
    assert campaign["observed_client_purchasers"] == 1
    assert campaign["client_purchasers_before_attribution"] == 1
    assert other["observed_client_purchasers"] == 0
    assert report["financial_reconciliation"] == "not_joined"
    assert report["roas"] is None


def test_organic_unavailable_missing_and_android_are_different():
    report = _report([
        _row(TERMINAL, user="organic", asa_result="organic"),
        _row(TERMINAL, user="unavailable", asa_result="unavailable", asa_unavailable_reason="unresolved"),
        _row("profile_action_selected", user="old-build", anchor=False),
        _row("profile_action_selected", user="android", platform="android"),
    ])
    buckets = _buckets(report)
    assert set(buckets) == {"organic", "unavailable", "unknown", "ineligible"}
    assert all(item["installations"] == 1 and item["share"] == 0.25 for item in buckets.values())
    assert _cohort(report, result="organic")["client_purchase_fraction"] == 0
    assert _cohort(report, result="unavailable")["client_purchase_fraction"] is None
    assert _cohort(report, result="ineligible")["client_purchase_fraction"] is None


@pytest.mark.parametrize("value", [True, 0, -1, 2**53, 1.5, "123", [], {}])
def test_ids_are_positive_safe_numeric_ids_not_coerced(value):
    report = _report([_asa(asa_campaign_id=value)])
    assert report["quality_issues"]["invalid_attribution_terminal"] == 1
    assert report["installations"][0]["result"] == "unknown"
    assert _buckets(report)["unknown"]["asa_campaign_id"] is None


def test_null_keyword_and_missing_campaign_are_explicit_not_invented_search_match():
    report = _report([_asa(asa_campaign_id=None, asa_org_id=None)])
    assert report["installations"][0]["result"] == "attributed"
    assert report["installations"][0]["campaign_scope_status"] == "unavailable"
    assert report["mix"]["buckets"][0]["asa_keyword_id"] is None


@pytest.mark.parametrize("properties", [
    {"asa_result": "organic"},
    {"asa_result": "unavailable", "asa_unavailable_reason": "unresolved"},
    {"asa_result": "invalid"},
    {"asa_claim_type": "Tap"},
    {"asa_conversion_type": "Install"},
    {"asa_country_or_region": "Poland"},
    {"asa_click_date": "2026-02-30T10:00Z"},
    {"asa_click_date": "2026-09-01T10:00:00+00:00"},
    {"platform": "android"},
    {"analytics_payload_valid": False},
])
def test_invalid_terminal_never_becomes_clean_channel_attribution(properties):
    report = _report([_asa(**properties)])
    assert report["quality_issues"]["invalid_attribution_terminal"] == 1
    assert report["mix"]["terminal_observations"] == 0
    assert all(item["client_purchase_fraction"] is None for item in report["cohorts"])


def test_conflicting_terminals_do_not_last_write_win_and_do_not_poison_other_channel():
    report = _report([
        _asa(), _asa(at=FIRST + timedelta(days=2), asa_campaign_id=999),
        _asa(user="clean"), _purchase(user="clean", transaction_id="other"),
    ])
    assert report["mix"]["status"] == "limited_integrity"
    assert report["quality_issues"]["conflicting_attribution_terminal"] == 1
    assert all(item["share"] is None for item in report["mix"]["buckets"])
    assert _cohort(report)["client_purchase_fraction"] == 1
    assert _cohort(report, result="unknown")["client_purchase_fraction"] is None


def test_platform_disagreement_quarantines_ios_terminal():
    report = _report([_asa(), _row("profile_action_selected", platform="android")])
    assert report["installations"][0]["result"] == "unknown"
    assert report["quality_issues"]["conflicting_installation_platform"] == 1


@pytest.mark.parametrize("properties", [
    {"observation_detection_method": "storage_recovery"},
    {"observation_detection_method": "memory_only"},
    {"first_observed_at": "2026-09-01T10:00:00"},
    {"first_observed_at": "2026-09-02T10:00:00Z"},
    {"observation_contract_version": True},
])
def test_uncertain_anchors_are_not_new_install_cohorts(properties):
    report = _report([_asa(**properties), _purchase(**properties)])
    assert report["mix"]["terminal_observations"] == 1
    assert report["cohorts"] == []
    assert report["installations"][0]["anchor_status"] == "invalid_observation_anchor"


def test_reset_or_conflicting_anchor_does_not_create_another_install():
    report = _report([
        _asa(),
        _row("progress_reset_confirmed", at=FIRST + timedelta(days=1),
             installation_observation_id="different", reset_operation_id="reset"),
    ])
    assert report["mix"]["installations"] == 1
    assert report["cohorts"] == []
    assert report["installations"][0]["anchor_status"] == "conflicting_observation_anchor"


def test_same_observation_id_cannot_belong_to_two_installations():
    report = _report([
        _asa(), _asa(user="b", installation_observation_id="observation-install-a"),
    ])
    assert report["mix"]["installations"] == 2
    assert report["cohorts"] == []
    assert report["quality_issues"]["conflicting_observation_anchor_identity"] == 2


def test_old_anchor_is_not_reanchored_by_return_or_resolution():
    report = _report([_asa(), _purchase()], start=START + timedelta(days=1), end=START + timedelta(days=3))
    assert report["mix"]["installations"] == 0
    assert report["cohorts"] == []


def test_restore_access_confirmation_and_client_price_never_make_purchases_or_money():
    report = _report([
        _asa(),
        _row("restore_succeeded", restore_attempt_id="restore", entitlement_active=True),
        _row("purchase_access_confirmed", purchase_attempt_id="checkout", transaction_id="tx"),
        _row("paywall_viewed", price=10**300, currency="PLN"),
    ])
    assert _cohort(report)["observed_client_purchasers"] == 0
    assert _cohort(report)["client_purchase_fraction"] == 0
    assert "currencies" not in report


def test_transaction_replays_are_one_purchase_and_cross_installation_is_not_a_new_purchase():
    report = _report([
        _asa(), _purchase(), _purchase(at=FIRST + timedelta(days=1), purchase_attempt_id="retry"),
    ])
    assert _cohort(report)["observed_client_purchasers"] == 1
    crossed = _report([
        _asa(), _purchase(), _asa(user="b"), _purchase(user="b"),
    ])
    assert _cohort(crossed)["observed_client_purchasers"] == 0
    assert _cohort(crossed)["client_purchase_limited_installations"] == 2
    assert _cohort(crossed)["client_purchase_fraction"] is None


def test_conflicting_purchase_only_restricts_purchase_fraction():
    purchase = _purchase()
    conflict = replace(purchase, event_id="other-provider", properties={**purchase.properties, "product_id": "other"})
    report = _report([_asa(), purchase, conflict, _learn()])
    cohort = _cohort(report)
    assert cohort["observed_client_purchasers"] == 0
    assert cohort["client_purchase_fraction"] is None
    assert cohort["meaningful_learning_fraction"] == 1
    assert report["mix"]["status"] == "observed"


def test_missing_native_completion_or_join_ids_are_unknown_not_verified_failure():
    report = _report([_asa(), _purchase(native_purchase_completed=None)])
    assert _cohort(report)["observed_client_purchasers"] == 0
    assert _cohort(report)["client_purchase_limited_installations"] == 1
    assert _cohort(report)["client_purchase_fraction"] is None


def test_outside_horizon_outcome_issue_does_not_restrict_mature_d7_fraction():
    report = _report([_asa(), _purchase(), _purchase(at=FIRST + timedelta(days=10), product_id=None)])
    assert _cohort(report)["client_purchase_fraction"] == 1
    assert _cohort(report, days=30)["client_purchase_fraction"] is None


def test_elapsed_horizon_is_half_open_and_d30_immaturity_is_censored():
    report = _report([
        _asa(), _purchase(at=FIRST + timedelta(days=7)),
    ], observe_through=FIRST + timedelta(days=7))
    d7, d30 = _cohort(report), _cohort(report, days=30)
    assert d7["mature_installations"] == 1
    assert d7["observed_client_purchasers"] == 0
    assert d7["client_purchase_fraction"] == 0
    assert d30["mature_installations"] == 0
    assert d30["censored_installations"] == 1
    assert d30["client_purchase_fraction"] is None


def test_calendar_d7_return_is_not_cumulative_learning_or_open_return():
    report = _report([
        _asa(), _learn(),
        _row("Application Opened", at=FIRST + timedelta(days=7)),
        _learn(at=START + timedelta(days=8) - timedelta(hours=3)),
    ])
    cohort = _cohort(report)
    assert cohort["observed_meaningful_learning_installations"] == 1
    assert cohort["calendar_learning_return"]["observed_returned_installations"] == 1
    assert cohort["calendar_learning_return"]["fraction"] == 1
    no_return = _report([_asa(), _learn(), _row("Application Opened", at=FIRST + timedelta(days=7))])
    assert _cohort(no_return)["calendar_learning_return"]["fraction"] == 0


def test_full_calendar_return_day_is_required_even_when_elapsed_d7_is_mature():
    report = _report([_asa(), _learn()], observe_through=FIRST + timedelta(days=7))
    cohort = _cohort(report)
    assert cohort["mature_installations"] == 1
    assert cohort["calendar_learning_return"]["mature_installations"] == 0
    assert cohort["calendar_learning_return"]["censored_installations"] == 1
    assert cohort["calendar_learning_return"]["fraction"] is None


def test_invalid_learning_only_restricts_learning_not_purchases_or_mix():
    report = _report([_asa(), _purchase(), _learn(accepted_unique_question_count=10**500)])
    cohort = _cohort(report)
    assert cohort["observed_meaningful_learning_installations"] == 0
    assert cohort["meaningful_learning_fraction"] is None
    assert cohort["client_purchase_fraction"] == 1
    assert report["mix"]["status"] == "observed"


@pytest.mark.parametrize("count", [None, True, "5", 1.5, -1])
def test_missing_or_invalid_training_count_is_not_a_valid_nonachiever(count):
    report = _report([_asa(), _purchase(), _learn(accepted_unique_question_count=count)])
    assert _cohort(report)["observed_meaningful_learning_installations"] == 0
    assert _cohort(report)["meaningful_learning_fraction"] is None
    assert _cohort(report)["client_purchase_fraction"] == 1
    assert report["outcome_quality_issue_count"] == 1


@pytest.mark.parametrize("properties", [
    {"question_total": None}, {"answered_count": None}, {"completion_status": None},
    {"completion_status": "active"}, {"question_total": 0}, {"answered_count": 26},
])
def test_invalid_exam_outcome_cannot_be_a_valid_nonachiever_or_meaningful_result(properties):
    exam = _row("exam_session_completed", **{
        "exam_session_id": "exam", "question_total": 25, "answered_count": 25,
        "completion_status": "completed", "learning_outcome_rule_version": "learning-v1", **properties,
    })
    report = _report([_asa(), exam, _purchase()])
    assert _cohort(report)["observed_meaningful_learning_installations"] == 0
    assert _cohort(report)["meaningful_learning_fraction"] is None
    assert _cohort(report)["client_purchase_fraction"] == 1


def test_short_training_and_partial_expired_exam_are_valid_nonachievers():
    exam = _row(
        "exam_session_completed", exam_session_id="exam", question_total=25, answered_count=24,
        completion_status="expired", learning_outcome_rule_version="learning-v1",
    )
    report = _report([_asa(), exam, _learn(accepted_unique_question_count=4)])
    assert _cohort(report)["observed_meaningful_learning_installations"] == 0
    assert _cohort(report)["meaningful_learning_fraction"] == 0
    assert report["outcome_quality_issue_count"] == 0


def test_completed_fully_answered_exam_is_meaningful_but_open_is_not():
    exam = _row(
        "exam_session_completed", exam_session_id="exam", question_total=25, answered_count=25,
        completion_status="completed", learning_outcome_rule_version="learning-v1",
    )
    report = _report([_asa(), exam])
    assert _cohort(report)["meaningful_learning_fraction"] == 1
    assert report["outcome_quality_issue_count"] == 0


def test_extreme_dates_are_censored_instead_of_overflowing():
    first = datetime(9999, 12, 30, 10, tzinfo=UTC)
    report = _report(
        [_asa(at=first, first_observed_at=first.isoformat())],
        start=first, end=datetime(9999, 12, 31, tzinfo=UTC), observe_through=datetime.max.replace(tzinfo=UTC),
    )
    assert all(item["censored_installations"] == 1 and item["client_purchase_fraction"] is None
               for item in report["cohorts"])


def test_historical_terminal_conflict_is_retained_for_an_install_returning_later(tmp_path):
    warehouse = _ingest_days(tmp_path, [
        _asa(), _asa(at=FIRST + timedelta(days=1), asa_campaign_id=999),
        _row("profile_action_selected", at=FIRST + timedelta(days=7)),
    ])
    window = day_window(date(2026, 9, 8))
    report = warehouse_acquisition_report(warehouse, start=window.start, end=window.end)
    assert report["installations"][0]["result"] == "unknown"
    assert report["quality_issues"]["conflicting_attribution_terminal"] == 1
    assert report["mix"]["buckets"][0]["share"] is None


def test_unverified_coverage_keeps_observations_but_no_fractions():
    report = _report([_asa(), _purchase(), _learn()], coverage_complete=False)
    assert report["mix"]["status"] == "incomplete_coverage"
    assert report["mix"]["buckets"][0]["share"] is None
    assert _cohort(report)["observed_client_purchasers"] == 1
    assert _cohort(report)["client_purchase_fraction"] is None
    assert _cohort(report)["meaningful_learning_fraction"] is None


def test_fallback_sdk_identity_cannot_be_joined_by_person_or_account():
    terminal = _asa()
    fallback = replace(terminal, key_source="fallback", properties={**terminal.properties, "app_user_id": None})
    report = _report([fallback, _purchase()])
    assert report["mix"]["status"] == "unavailable"
    assert report["quality_issues"]["missing_primary_installation_identity"] == 1
    assert report["mix"]["buckets"][0]["share"] is None
    assert _cohort(report, result="unknown")["client_purchase_fraction"] is None


def test_unjoinable_outcomes_restrict_only_their_dependent_cohort_metric():
    purchase = _purchase(user="unknown")
    fallback = replace(purchase, key_source="fallback", properties={**purchase.properties, "app_user_id": None})
    report = _report([_asa(), _learn(), fallback])
    assert _cohort(report)["client_purchase_fraction"] is None
    assert _cohort(report)["meaningful_learning_fraction"] == 1


@pytest.mark.parametrize("options", [
    {"start": END}, {"end": START}, {"observe_through": START},
    {"start": START.replace(tzinfo=None)}, {"observe_through": THROUGH.replace(tzinfo=None)},
])
def test_bad_window_fails_even_without_source_data(options):
    with pytest.raises(ValueError, match="timezone-aware"):
        _report([], **options)


def _ingest_days(tmp_path, rows, *, days=10, missing=None):
    warehouse = tmp_path / "warehouse"
    for offset in range(days):
        current = date(2026, 9, 1) + timedelta(days=offset)
        if current == missing:
            continue
        raw = []
        for row in rows:
            if row.timestamp.date() == current:
                raw.append(event(row.event, row.timestamp.isoformat(), row.analysis_key, **row.properties))
        path = write_dump(
            tmp_path / f"{current}.json", day=current.isoformat(), exported_at="2026-10-05T10:00:00Z", events=raw,
        )
        ingest_dump(path, warehouse)
    return warehouse


def test_warehouse_history_resolves_returning_install_without_super_properties(tmp_path):
    warehouse = _ingest_days(tmp_path, [_asa(), _row("profile_action_selected", at=FIRST + timedelta(days=7))])
    window = day_window(date(2026, 9, 8))
    report = warehouse_acquisition_report(warehouse, start=window.start, end=window.end)
    assert report["mix"]["terminal_observations"] == 1
    assert report["mix"]["installations"] == 1
    assert report["cohorts"] == []
    assert report["history_partitions_complete"] is True
    assert report["historical_delivery_as_of"] == "not_verified"


def test_missing_observation_day_prevents_mature_cohort_fraction(tmp_path):
    warehouse = _ingest_days(
        tmp_path, [_asa(), _purchase()], missing=date(2026, 9, 4),
    )
    window = day_window(date(2026, 9, 1))
    report = warehouse_acquisition_report(warehouse, start=window.start, end=window.end, observe_through=START + timedelta(days=9))
    assert report["coverage_complete"] is False
    assert _cohort(report)["observed_client_purchasers"] == 1
    assert _cohort(report)["client_purchase_fraction"] is None


def test_cli_context_health_integration_and_observe_through(tmp_path, capsys):
    warehouse = _ingest_days(tmp_path, [
        _row("install_observation_resolved"), _purchase(), _asa(at=FIRST + timedelta(days=2)),
        _learn(at=FIRST + timedelta(days=7)),
    ])
    context = build_context(warehouse, day_window(date(2026, 9, 1)))
    assert context.acquisition_mix.status == "unavailable"
    assert context.acquisition["roas"] is None
    main([
        "acquisition", "--start", "2026-09-01", "--end", "2026-09-02",
        "--observe-through", "2026-09-10T00:00:00Z", "--warehouse", str(warehouse),
    ])
    result = json.loads(capsys.readouterr().out)
    assert result["mix"]["status"] == "observed"
    assert _cohort(result)["client_purchase_fraction"] == 1
    assert _cohort(result)["client_purchasers_before_attribution"] == 1
    health = build_health(
        [], window_start=START, window_end=END, acquisition=result, coverage_complete=True,
    )
    assert health.acquisition == result
    assert health.monetization["revenuecat"] == "not_loaded"
    health_local = build_health(
        [_asa()], window_start=START, window_end=END, coverage_complete=True,
    )
    assert health_local.acquisition["mix"]["status"] == "observed"


def test_context_acquisition_is_populated_and_roundtrips(tmp_path):
    warehouse = _ingest_days(tmp_path, [_asa()])
    context = build_context(warehouse, day_window(date(2026, 9, 1)))
    assert context.acquisition_mix.status == "observed"
    assert context.acquisition_mix.buckets[0]["asa_campaign_id"] == 456
    assert context.model_validate_json(context.model_dump_json()).acquisition == context.acquisition
    assert not any(item.id == "acquisition_unavailable" for item in context.qa)
    assert any(item.interpretation_id == "ios_installation_adservices_attributed_v1" for item in context.observations)


def test_no_sources_are_unknown_not_zero_paid_acquisition(tmp_path):
    report = warehouse_acquisition_report(tmp_path, start=START, end=END)
    assert report["mix"]["status"] == "unavailable"
    assert report["mix"]["buckets"] == []
    assert report["cohorts"] == []
    assert report["product_funnel"] == []
    assert report["coverage_complete"] is False


def _funnel(report, *, result="attributed"):
    return next(item for item in report["product_funnel"] if item["asa_result"] == result)


def _answer(*, at=FIRST + timedelta(minutes=1), **props):
    return _row(
        "training_question_answered", at=at, training_session_id="training-a",
        question_id="q1", answer_id="a1", is_correct=True, **props,
    )


def _exam(*, at=FIRST + timedelta(minutes=2), **props):
    return _row("exam_session_completed", at=at, **{
        "exam_session_id": "exam-a", "completion_status": "completed", "question_total": 2,
        "answered_count": 2, "learning_outcome_rule_version": "learning-v1", **props,
    })


def _paywall(*, at=FIRST + timedelta(minutes=3), **props):
    return _row("paywall_viewed", at=at, **{"paywall_view_id": "view-a", **props})


def _started(*, at=FIRST + timedelta(minutes=4), attempt="checkout-a", **props):
    return _row("purchase_started", at=at, purchase_attempt_id=attempt, **props)


def _origin(**props):
    return {
        "checkout_origin_status": "observed", "checkout_origin_version": 1,
        "checkout_origin_exam_country": "PL", "checkout_origin_paywall_offer": "plans",
        "checkout_origin_subscription_period": "P1M", **props,
    }


def test_ordered_funnel_counts_dropoff_and_keeps_checkout_country_and_product_kind():
    report = _report([
        _asa(asa_keyword_id=300), _answer(), _exam(),
        _asa(user="install-b", asa_keyword_id=300),
        _answer(user="install-b"), _exam(user="install-b", exam_session_id="exam-b"),
        _paywall(user="install-b", paywall_view_id="view-b"),
        _started(user="install-b", attempt="checkout-b"),
        _purchase(
            user="install-b", at=FIRST + timedelta(minutes=5), purchase_attempt_id="checkout-b",
            transaction_id="transaction-b", exam_country="PL",
            **_origin(checkout_origin_exam_country="SK", checkout_origin_paywall_offer="lifetime",
                      checkout_origin_subscription_period=None),
        ),
    ])
    funnel = _funnel(report)
    steps = {step["id"]: step for step in funnel["steps"]}
    assert funnel["asa_campaign_id"] == 456 and funnel["asa_keyword_id"] == 300
    assert funnel["mature_installations"] == 2 and funnel["censored_installations"] == 0
    assert steps["first_useful_action"]["installations"] == 2
    assert steps["practice_exam_completed"]["fraction"] == 1
    assert steps["paywall_viewed"] == {"id": "paywall_viewed", "installations": 1, "fraction": 0.5}
    assert steps["purchase_started"]["fraction"] == 0.5
    assert steps["purchase_succeeded"]["fraction"] == 0.5
    assert funnel["purchase_outside_ordered_funnel"] == 0
    assert funnel["purchase_context"] == [{
        "exam_country": "SK", "paywall_offer": "lifetime", "product_kind": "lifetime", "installations": 1,
    }]
    assert report["roas"] is None and "ordered_funnel_as_verified_revenue" in report["must_not_claim"]


def test_purchase_and_paywall_before_the_exam_stay_outside_the_ordered_steps():
    report = _report([
        _asa(),
        _paywall(at=FIRST + timedelta(minutes=1)),
        _answer(at=FIRST + timedelta(minutes=2)),
        _exam(at=FIRST + timedelta(minutes=3)),
        _started(at=FIRST + timedelta(minutes=4)),
        _purchase(at=FIRST + timedelta(minutes=5), **_origin()),
    ])
    steps = {step["id"]: step["installations"] for step in _funnel(report)["steps"]}
    assert steps == {
        "first_useful_action": 1, "practice_exam_completed": 1, "paywall_viewed": 0,
        "purchase_started": 0, "purchase_succeeded": 0,
    }
    assert _funnel(report)["purchase_outside_ordered_funnel"] == 1


def test_tied_event_time_does_not_order_the_next_funnel_step():
    at = FIRST + timedelta(minutes=1)
    report = _report([_asa(), _answer(at=at), _exam(at=at)])
    steps = {step["id"]: step["installations"] for step in _funnel(report)["steps"]}
    assert steps["first_useful_action"] == 1
    assert steps["practice_exam_completed"] == 0


def test_unfinished_30_day_window_censors_the_funnel():
    report = _report([
        _asa(), _answer(), _exam(), _paywall(), _started(),
        _purchase(at=FIRST + timedelta(minutes=5), **_origin()),
    ], observe_through=FIRST + timedelta(days=2))
    funnel = _funnel(report)
    assert funnel["censored_installations"] == 1 and funnel["mature_installations"] == 0
    assert all(step["installations"] == 0 and step["fraction"] is None for step in funnel["steps"])
    assert funnel["purchase_context"] == []
