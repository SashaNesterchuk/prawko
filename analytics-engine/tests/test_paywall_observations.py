import json
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import _prepare, build_context, day_window, load_prepared_rows
from prawko_analytics.contract import load_contract
from prawko_analytics.data_quality import canonical_observations, observe_data_quality
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.interpret import select_interpretation
from prawko_analytics.paywall_contract import (
    CHECKOUT_FIELDS, COMPLETED, ELIGIBILITY_EVENTS, PAYWALL_FIELDS, RESOLVED, STARTED,
)
from prawko_analytics.paywall_observations import paywall_observations_report, warehouse_paywall_report
from tests.support import event, write_dump


START = datetime(2026, 10, 3, tzinfo=timezone.utc)
END = START + timedelta(days=1)
CONTRACT = load_contract()


def prepared(raw):
    return _prepare({
        **raw, "event_id": raw["uuid"],
        "timestamp": datetime.fromisoformat(raw["timestamp"].replace("Z", "+00:00")),
    }, CONTRACT)


def eligibility(name, timestamp="2026-10-03T10:00:00Z", user="usr_i", **props):
    fields = {
        "paywall_view_id": "view-one", "eligibility_request_id": "request-one",
        "trial_eligibility_observation_version": 1, "eligibility_scope": "request_not_display",
        "eligibility_requested_product_count": 1, "eligibility_distinct_product_count": 1,
        "eligibility_observer_active": True, "eligibility_view_visible": True, "eligibility_platform": "ios",
    }
    if name == STARTED:
        fields["eligibility_started_at"] = timestamp
    else:
        fields.update(eligibility_native_query_invoked=True, eligibility_error_category=None)
        if name == RESOLVED:
            fields.update(eligibility_product_id="product-one", eligibility_outcome="eligible",
                          eligibility_basis="revenuecat_ios_status")
        else:
            fields.update(eligibility_request_outcome="resolved", eligibility_resolved_product_count=1,
                          eligibility_duration_ms=2000)
    fields.update(props)
    return event(name, timestamp, user, **fields)


def trace(**props):
    return [
        eligibility(STARTED, "2026-10-03T10:00:00Z", **props),
        eligibility(RESOLVED, "2026-10-03T10:00:01Z", **props),
        eligibility(COMPLETED, "2026-10-03T10:00:02Z", **props),
    ]


def report(raws, **kwargs):
    return paywall_observations_report(
        [prepared(raw) for raw in raws], start=START, end=END, coverage_complete=True, **kwargs,
    )


def origin(namespace="paywall_origin", **changes):
    fields = PAYWALL_FIELDS if namespace == "paywall_origin" else CHECKOUT_FIELDS
    values = {field: None for field in fields}
    if namespace == "paywall_origin":
        values.update(variant="paywall2", offer="plans", default_plan="quarter", config_version=1,
                      country="PL", category="B", locale="pl", monetization_version=2, presentation="modal")
        basis = "local_screen_config_not_remote_revision"
    else:
        values.update(exam_country="PL", product_id="old-product", package_id="$rc_three_month",
                      price=29.99, currency="PLN", subscription_period="P3M")
        basis = "checkout_input_and_selected_package"
    values.update(changes)
    return {
        f"{namespace}_version": 1, f"{namespace}_status": "observed",
        f"{namespace}_at": "2026-10-03T09:00:00Z", f"{namespace}_basis": basis,
        **{f"{namespace}_{key}": value for key, value in values.items()},
    }


def snapshot(timestamp="2026-10-03T10:00:03Z", **props):
    return event("paywall_cta_selected", timestamp, "usr_i", **{
        "paywall_view_id": "view-one", "action": "purchase", "product_id": "product-one",
        "trial_eligibility_observation_version": 1, "trial_eligibility_request_id": "request-one",
        "trial_eligibility": "eligible", "trial_eligibility_basis": "revenuecat_ios_status",
        "trial_shown": True, "trial_days": 3, **props,
    })


def test_clean_scoped_request_and_selected_plan_are_count_only_diagnostics():
    result = report([*trace(), snapshot()])
    assert result["status"] == "observed"
    assert result["request_status_counts"] == {"completed": 1}
    assert result["observed_product_outcomes"] == {"eligible": 1}
    assert result["plan_snapshots"]["counts"]["raw_outcome_linked_snapshot_observations"] == 1
    assert result["resolution_rate"] is None and result["displayed_trial_rate"] is None
    assert result["quality_issue_count"] == 0


@pytest.mark.parametrize("outcome,basis", [
    ("eligible", "revenuecat_ios_status"), ("ineligible", "revenuecat_ios_status"),
    ("unknown", "sdk_status_unknown"), ("unknown", "missing_product_response"),
    ("no_intro_offer", "revenuecat_ios_status"),
])
def test_sdk_normalized_outcomes_remain_distinct(outcome, basis):
    raws = trace()
    raws[1]["properties"].update(eligibility_outcome=outcome, eligibility_basis=basis)
    result = report(raws)
    assert result["observed_product_outcomes"] == {outcome: 1}
    assert result["quality_issue_count"] == 0


@pytest.mark.parametrize("outcome,basis,platform,native,error", [
    ("unsupported", "unsupported_platform", "android", False, None),
    ("not_configured", "not_configured", "ios", False, None),
    ("error", "request_error", "ios", True, "network"),
    ("error", "request_error", "ios", False, "configuration"),
])
def test_skipped_queries_and_normalized_errors_are_not_ineligible(outcome, basis, platform, native, error):
    raws = trace(eligibility_platform=platform)
    for raw in raws[1:]:
        raw["properties"].update(eligibility_native_query_invoked=native, eligibility_error_category=error)
    raws[1]["properties"].update(eligibility_outcome="error" if error else "unknown", eligibility_basis=basis)
    raws[2]["properties"]["eligibility_request_outcome"] = outcome
    result = report(raws)
    assert result["requests"][0]["status"] == "completed"
    assert result["requests"][0]["request_outcome"] == outcome
    assert result["observed_product_outcomes"] == {"error" if error else "unknown": 1}
    assert result["quality_issue_count"] == 0


def test_no_products_requires_no_native_query_and_no_product_rows():
    raws = [
        eligibility(STARTED, eligibility_requested_product_count=0, eligibility_distinct_product_count=0),
        eligibility(COMPLETED, "2026-10-03T10:00:01Z", eligibility_requested_product_count=0,
                    eligibility_distinct_product_count=0, eligibility_resolved_product_count=0,
                    eligibility_request_outcome="no_products", eligibility_native_query_invoked=False),
    ]
    assert report(raws)["request_status_counts"] == {"completed": 1}
    assert report(raws)["observed_product_outcomes"] == {}


@pytest.mark.parametrize("field,value", [
    ("trial_eligibility_observation_version", True), ("trial_eligibility_observation_version", "1"),
    ("trial_eligibility_observation_version", 1.5), ("trial_eligibility_observation_version", 2),
    ("eligibility_distinct_product_count", True), ("eligibility_distinct_product_count", -1),
    ("eligibility_distinct_product_count", 10**1000), ("eligibility_requested_product_count", 0),
    ("eligibility_observer_active", False), ("eligibility_view_visible", "true"),
    ("eligibility_scope", "display"), ("eligibility_platform", []),
    ("eligibility_started_at", "2026-10-03T10:00:01Z"),
    ("eligibility_started_at", "2026-10-03T10:00:00"),
])
def test_invalid_started_payload_cannot_create_clean_request(field, value):
    result = report([eligibility(STARTED, **{field: value})])
    assert result["status"] == "limited_integrity"
    assert result["requests"][0]["status"] == "limited_integrity"


@pytest.mark.parametrize("field,value", [
    ("eligibility_product_id", None), ("eligibility_product_id", "private@example.com"),
    ("eligibility_outcome", "eligible-but-unknown"), ("eligibility_basis", "pending"),
    ("eligibility_native_query_invoked", False), ("eligibility_error_category", "raw-private-error"),
])
def test_invalid_product_is_not_counted_as_usable_outcome(field, value):
    raws = trace()
    raws[1]["properties"][field] = value
    result = report(raws)
    assert result["observed_product_outcomes"] == {}
    assert result["quality_issue_count"] > 0


def test_unknown_terminal_and_orphan_are_not_declared_abandon_or_success():
    assert report(trace()[:2])["requests"][0]["status"] == "terminal_not_observed"
    assert report(trace()[1:])["requests"][0]["status"] == "start_not_observed"
    assert report(trace()[:2])["resolution_rate"] is None


def test_terminal_declared_count_does_not_establish_delivered_product_coverage():
    result = report([trace()[0], trace()[2]])
    assert result["requests"][0]["quality_issues"] == {"product_observation_count_mismatch": 1}
    assert result["requests"][0]["status"] == "limited_integrity"


def test_tied_timestamps_require_actual_runtime_sequence():
    raws = trace()
    for raw in raws:
        raw["timestamp"] = "2026-10-03T10:00:00Z"
    assert report(raws)["quality_issue_count"] > 0
    for index, raw in enumerate(raws):
        raw["properties"].update(app_run_id="run-one", event_sequence=index + 1)
    assert report(raws)["quality_issue_count"] == 0


def test_detached_products_are_kept_but_cannot_establish_current_plan_eligibility():
    raws = trace()
    for raw in raws[1:]:
        raw["properties"].update(eligibility_observer_active=False, eligibility_view_visible=False)
    result = report([*raws, snapshot()])
    assert result["observed_product_outcomes"] == {"eligible": 1}
    assert result["requests"][0]["view_visible_at_terminal"] is False
    assert result["plan_snapshots"]["quality_issues"] == {"known_eligibility_without_product_evidence": 1}


def test_pending_plan_snapshot_cannot_borrow_a_future_resolved_outcome():
    result = report([*trace(), snapshot("2026-10-03T10:00:00.500Z",
                                     trial_eligibility="unknown", trial_eligibility_basis="pending", trial_shown=False)])
    assert result["plan_snapshots"]["counts"]["raw_outcome_unavailable_at_snapshot"] == 1
    assert result["quality_issue_count"] == 0


def test_unknown_android_snapshot_may_show_trial_without_claiming_eligible():
    raws = trace(eligibility_platform="android")
    for raw in raws[1:]:
        raw["properties"].update(eligibility_native_query_invoked=False)
    raws[1]["properties"].update(eligibility_outcome="unknown", eligibility_basis="unsupported_platform")
    raws[2]["properties"]["eligibility_request_outcome"] = "unsupported"
    result = report([*raws, snapshot(trial_eligibility="unknown", trial_eligibility_basis="unsupported_platform")])
    assert result["plan_snapshots"]["counts"]["trial_shown_snapshot_observations"] == 1
    assert result["quality_issue_count"] == 0


def test_replayed_product_and_terminal_do_not_increase_request_or_product_counts():
    raws = trace()
    replay = eligibility(RESOLVED, "2026-10-03T11:00:00Z")
    terminal = eligibility(COMPLETED, "2026-10-03T11:00:01Z")
    result = report([*raws, replay, terminal])
    assert result["request_status_counts"] == {"completed": 1}
    assert result["observed_product_outcomes"] == {"eligible": 1}


def test_available_history_can_pair_pre_window_start_with_current_terminal_without_replay_activity():
    raws = trace()
    for raw in raws[:2]:
        raw["timestamp"] = raw["timestamp"].replace("10-03", "10-02")
    raws[0]["properties"]["eligibility_started_at"] = raws[0]["timestamp"]
    result = report([raws[2]], history=[prepared(raw) for raw in raws[:2]])
    assert result["request_status_counts"] == {"completed": 1}
    replay = eligibility(COMPLETED, "2026-10-04T10:00:00Z")
    result = paywall_observations_report(
        [prepared(raw) for raw in [*trace(), replay]], start=END, end=END + timedelta(days=1),
    )
    assert result["requests"] == []


def test_request_binding_and_historical_product_conflicts_are_quarantined():
    raws = trace()
    conflict = eligibility(RESOLVED, "2026-10-03T11:00:00Z", eligibility_outcome="ineligible")
    result = report([*raws, conflict])
    assert result["requests"][0]["status"] == "limited_integrity"
    assert result["observed_product_outcomes"] == {}
    wrong_view = trace()
    wrong_view[2]["properties"]["paywall_view_id"] = "other-view"
    annotated, quality = observe_data_quality(
        [prepared(raw) for raw in wrong_view], start=START, end=END,
    )
    assert quality["counts"]["conflicting_business_rows"] == 3
    assert len(canonical_observations(annotated)) == 3


def test_same_request_id_on_other_install_does_not_alias_accounts():
    raws = trace()
    other = trace(user="usr_other", eligibility_outcome="ineligible")
    for raw in [*raws, *other]:
        raw["properties"]["supabase_user_id"] = "shared-account"
    result = report([*raws, *other])
    assert result["request_status_counts"] == {"completed": 2}
    assert result["observed_product_outcomes"] == {"eligible": 1, "ineligible": 1}


def test_paywall_origin_is_immutable_but_current_country_may_change():
    view = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i",
                 paywall_view_id="view-one", **origin())
    later = snapshot(exam_country="CZ", **origin())
    result = report([view, later, *trace()])
    assert result["paywall_origins"]["status_counts"] == {"observed": 1}
    later["properties"]["paywall_origin_country"] = "CZ"
    result = report([view, later, *trace()])
    assert result["paywall_origins"]["units"][0]["quality_issues"]["origin_snapshot_conflict"] == 1


def test_checkout_native_package_refresh_is_not_origin_conflict_and_prices_are_not_summed():
    raws = [
        event("purchase_started", "2026-10-03T10:00:00Z", "usr_i", purchase_attempt_id="attempt-one",
              product_id="refreshed-product", price=19.99, **origin("checkout_origin")),
        event("purchase_succeeded", "2026-10-03T10:00:01Z", "usr_i", purchase_attempt_id="attempt-one",
              product_id="refreshed-product", exam_country="CZ", **origin("checkout_origin")),
    ]
    result = report(raws)
    unit = result["checkout_origins"]["units"][0]
    assert unit["status"] == "observed"
    assert unit["native_package_difference_observations"] == 1
    assert unit["snapshot"]["checkout_origin_product_id"] == "old-product"
    assert unit["snapshot"]["checkout_origin_price"] == 29.99
    assert "money" in result["must_not_be_interpreted_as"]


def test_safe_store_package_and_offering_labels_are_metadata_not_business_ids():
    raw = event("purchase_started", "2026-10-03T10:00:00Z", "usr_i", purchase_attempt_id="attempt-one",
                **origin("checkout_origin", package_id="$rc_monthly", offering_id="Named store offering"))
    assert report([raw])["checkout_origins"]["status_counts"] == {"observed": 1}
    raw["properties"]["checkout_origin_offering_id"] = "https://private.example/"
    assert report([raw])["checkout_origins"]["status_counts"] == {"limited_integrity": 1}


@pytest.mark.parametrize("namespace,id_key,name", [
    ("paywall_origin", "paywall_view_id", "paywall_viewed"),
    ("checkout_origin", "purchase_attempt_id", "purchase_started"),
])
def test_legacy_absence_and_observer_failure_never_acquire_current_origin(namespace, id_key, name):
    raw = event(name, "2026-10-03T10:00:00Z", "usr_i", **{id_key: "one"})
    key = "paywall_origins" if namespace == "paywall_origin" else "checkout_origins"
    assert report([raw])[key]["status_counts"] == {"legacy_unobserved": 1}
    raw["properties"].update({f"{namespace}_version": 1, f"{namespace}_status": "observation_failed"})
    assert report([raw])[key]["status_counts"] == {"observation_failed": 1}


@pytest.mark.parametrize("value", [True, "1", 1.5, None, 2])
def test_new_interpretations_reject_coerced_or_unknown_source_version(value):
    for name in ELIGIBILITY_EVENTS:
        interpretation, status = select_interpretation(
            CONTRACT.events[name].interpretations, schema=3, app_version="1.0.31",
            properties={"trial_eligibility_observation_version": value},
        )
        assert interpretation is None and status == "none"


def test_new_interpretations_are_optional_and_never_product_return_activity():
    for name in ELIGIBILITY_EVENTS:
        interpretation, status = select_interpretation(
            CONTRACT.events[name].interpretations, schema=3, app_version="1.0.31",
            properties={"trial_eligibility_observation_version": 1},
        )
        assert status == "matched" and interpretation.funnel_role == "optional"
        assert not CONTRACT.is_product_event(name)
    assert CONTRACT.is_product_event("paywall_viewed")
    assert CONTRACT.events["paywall_offer_ready"].interpretations[0].id == "offer_available"


def test_health_detached_callbacks_do_not_add_a_foreground_return_day():
    anchor = event("Application Installed", "2026-10-03T10:00:00Z", "usr_i")
    late = eligibility(RESOLVED, "2026-10-04T11:00:00Z", eligibility_observer_active=False,
                       eligibility_view_visible=False)
    health = build_health(
        [prepared(anchor), prepared(late)], window_start=START, window_end=END + timedelta(days=2),
        coverage_complete=True,
    )
    assert health.paywall_observations["observed_product_outcomes"] == {"eligible": 1}
    metric = next(metric for metric in health.metrics if metric.id == "d1_return")
    assert metric.numerator == 0 and metric.denominator == 1


def test_warehouse_cli_context_health_share_scoped_history_and_keep_independent_conversion(tmp_path):
    warehouse = tmp_path / "warehouse"
    raws = [
        event(name, f"2026-10-03T09:0{index}:00Z", "usr_i", paywall_view_id="view-one", **props)
        for index, (name, props) in enumerate([
            ("paywall_viewed", {}), ("paywall_offer_ready", {"offer_load_id": "offer-one"}),
            ("paywall_cta_selected", {"action": "purchase"}),
            ("purchase_started", {"purchase_attempt_id": "attempt-one"}),
            ("purchase_succeeded", {"purchase_attempt_id": "attempt-one"}),
        ])
    ]
    raws.extend(trace())
    raws.append(eligibility(RESOLVED, "2026-10-03T11:00:00Z", eligibility_outcome="ineligible"))
    ingest_dump(write_dump(tmp_path / "day.json", day="2026-10-03",
                           exported_at="2026-10-05T08:00:00Z", events=raws), warehouse)
    contract = replace(CONTRACT, metrics=tuple(replace(item, min_denominator=1) for item in CONTRACT.metrics))
    context = build_context(warehouse, day_window(date(2026, 10, 3)), contract)
    assert context.paywall_observations == warehouse_paywall_report(
        warehouse, start=context.dataset.window.start, end=context.dataset.window.end, contract=contract,
    )
    assert "paywall_observations_limited" in {item.id for item in context.qa}
    assert next(item for item in context.metrics if item.id == "paywall_purchase_conversion").value == 1
    out = tmp_path / "report.json"
    main(["paywall-observations", "--warehouse", str(warehouse), "--day", "2026-10-03", "--out", str(out)])
    assert json.loads(out.read_text()) == context.paywall_observations
    rows = load_prepared_rows(warehouse, day_window(date(2026, 10, 3)))
    health = build_health(
        rows, window_start=context.dataset.window.start, window_end=context.dataset.window.end,
        paywall_observations=context.paywall_observations, coverage_complete=True,
    )
    assert health.paywall_observations == context.paywall_observations
    assert health.attempt_quality["activity_integrity_issue_count"] == 0


def test_partial_coverage_and_unjoinable_observations_never_create_complete_denominators():
    result = paywall_observations_report([prepared(raw) for raw in trace()], start=START, end=END)
    assert result["status"] == "incomplete_coverage"
    result = report([eligibility(STARTED, eligibility_request_id=None)])
    assert result["quality_issues"] == {"unjoinable_eligibility_observations": 1}
    assert result["requests"] == []


@pytest.mark.parametrize("field,value", [
    ("paywall_origin_version", True), ("paywall_origin_at", "2026-10-03T09:00:00"),
    ("paywall_origin_at", "2026-10-04T09:00:00Z"), ("paywall_origin_config_version", "1"),
    ("paywall_origin_country", "UA"), ("paywall_origin_basis", "remote-config-revision"),
    ("paywall_origin_variant", []), ("paywall_origin_locale", "private@example.com"),
])
def test_invalid_origin_is_not_repaired_from_current_properties(field, value):
    raw = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i",
                paywall_view_id="view-one", **origin())
    raw["properties"][field] = value
    unit = report([raw])["paywall_origins"]["units"][0]
    assert unit["status"] == "limited_integrity"
    assert unit["snapshot"] is None


@pytest.mark.parametrize("country,variant,offer,default", [
    ("PL", "paywall2", "plans", "quarter"), ("CZ", "legacy", "lifetime", None),
    ("SK", "legacy", "lifetime", None),
])
def test_origin_retains_local_country_billing_snapshot(country, variant, offer, default):
    raw = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", paywall_view_id="view-one",
                **origin(country=country, variant=variant, offer=offer, default_plan=default))
    unit = report([raw])["paywall_origins"]["units"][0]
    assert unit["status"] == "observed"
    assert unit["snapshot"]["paywall_origin_country"] == country
    assert unit["snapshot"]["paywall_origin_offer"] == offer


def test_cross_partition_conflict_and_pre_window_replay_survive_cli_source_history(tmp_path):
    warehouse = tmp_path / "warehouse"
    old = trace()
    for raw in old:
        raw["timestamp"] = raw["timestamp"].replace("10-03", "10-02")
    old[0]["properties"]["eligibility_started_at"] = old[0]["timestamp"]
    current = eligibility(RESOLVED, "2026-10-03T11:00:00Z", eligibility_outcome="ineligible")
    for day, raws in [("2026-10-02", old), ("2026-10-03", [current])]:
        ingest_dump(write_dump(tmp_path / f"{day}.json", day=day, exported_at="2026-10-05T08:00:00Z",
                               events=raws), warehouse)
    window = day_window(date(2026, 10, 3))
    result = warehouse_paywall_report(warehouse, start=window.start, end=window.end)
    assert result["requests"][0]["status"] == "limited_integrity"
    assert result["observed_product_outcomes"] == {}
    assert result["history_available_from"] is not None


def test_eligibility_error_does_not_erase_clean_learning_ttv_or_invent_calendar_return(tmp_path):
    warehouse = tmp_path / "warehouse"
    anchor = {
        "installation_observation_id": "installation-one", "first_observed_at": "2026-10-03T09:00:00Z",
        "observation_detection_method": "first_local_observation", "observation_contract_version": 1,
    }
    raws = [
        event("Application Installed", "2026-10-03T09:00:00Z", "usr_i"),
        event("install_observation_resolved", "2026-10-03T09:00:00Z", "usr_i", **anchor),
        event("training_session_completed", "2026-10-03T10:00:00Z", "usr_i",
              training_session_id="training-one", accepted_unique_question_count=5,
              learning_outcome_rule_version="learning-v1", **anchor),
        eligibility(RESOLVED, "2026-10-10T10:00:00Z", eligibility_outcome="malformed"),
    ]
    for offset in range(9):
        day = date(2026, 10, 3) + timedelta(days=offset)
        ingest_dump(write_dump(
            tmp_path / f"{day}.json", day=day.isoformat(), exported_at="2026-10-15T08:00:00Z",
            events=[raw for raw in raws if raw["timestamp"].startswith(day.isoformat())],
        ), warehouse)
    from prawko_analytics.context import range_window

    context = build_context(warehouse, range_window("test", date(2026, 10, 3), date(2026, 10, 12)))
    metric = next(item for item in context.metrics if item.id == "d7_return")
    assert metric.numerator == 0 and metric.denominator == 1
    assert metric.invalid_business_rows == 0
    assert context.learning_time_to_value.invalid_observation_rows == 0
    assert context.learning_time_to_value.achieved == 1
