import json
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import (
    AnalysisWindow, _prepare, build_context, day_window, load_prepared_rows, load_quality_observations,
)
from prawko_analytics.contract import load_contract
from prawko_analytics.data_quality import (
    RULES, canonical_observations, diagnostic_observations, observe_data_quality,
)
from prawko_analytics.health import build_health
from prawko_analytics.ingest import WARSAW, ingest_dump, partition_days
from prawko_analytics.learning import learning_time_to_value
from prawko_analytics.quality import nonnegative_number, observation_usable
from tests.support import event, write_dump


START = datetime(2026, 10, 3, tzinfo=timezone.utc)
END = START + timedelta(days=1)
CONTRACT = load_contract()


def prepared(raw):
    return _prepare({
        **raw, "event_id": raw["uuid"],
        "timestamp": datetime.fromisoformat(raw["timestamp"].replace("Z", "+00:00")),
    }, CONTRACT)


def observe(*raws, history=None):
    return observe_data_quality(
        [prepared(raw) for raw in raws], start=START, end=END,
        history=[prepared(raw) for raw in history] if history is not None else None,
        coverage_complete=True,
    )


def training(timestamp="2026-10-03T10:00:00Z", **props):
    return event("training_session_completed", timestamp, "usr_i", **{
        "training_session_id": "training-one", "accepted_unique_question_count": 5,
        "learning_outcome_rule_version": "learning-v1", **props,
    })


def import_days(tmp_path, raws, days=("2026-10-02", "2026-10-03")):
    warehouse = tmp_path / "warehouse"
    for day in days:
        ingest_dump(write_dump(
            tmp_path / f"{day}.json", day=day, exported_at="2026-10-05T08:00:00Z",
            events=[raw for raw in raws if raw["timestamp"].startswith(day)],
        ), warehouse)
    return warehouse


def minimum_contract():
    return replace(CONTRACT, metrics=tuple(replace(metric, min_denominator=1) for metric in CONTRACT.metrics))


def test_business_replay_uses_first_observation_without_backfilling_later_optional_metadata():
    first = training()
    replay = training("2026-10-03T11:00:00Z", score_percent=80, correct_count=4)
    rows, report = observe(replay, first)
    canonical = canonical_observations(rows)
    assert len(canonical) == 1 and canonical[0].timestamp == prepared(first).timestamp
    assert canonical[0].properties.get("score_percent") is None
    assert report["counts"]["duplicate_observation_rows"] == 1
    assert report["quality_issue_count"] == 0
    assert len(diagnostic_observations(rows)) == 2


def test_identical_tied_observations_are_one_business_observation_without_temporal_claim():
    first = training(event_id="client-one")
    second = {**training(event_id="client-two"), "uuid": "provider-two"}
    forward, report = observe(first, second)
    reverse, reverse_report = observe(second, first)
    assert canonical_observations(forward)[0].event_id == canonical_observations(reverse)[0].event_id
    assert report["counts"] == reverse_report["counts"]
    assert report["quality_issue_count"] == 0


def test_tied_unknown_metadata_or_different_runtime_order_is_not_arbitrarily_upgraded():
    first = training(event_id="client-one")
    second = {**training(event_id="client-two", correct_count=4), "uuid": "provider-two"}
    rows, report = observe(first, second)
    assert report["counts"]["uncertain_business_order_rows"] == 2
    assert not any(observation_usable(row.properties) for row in rows)
    first["properties"].update(app_run_id="run-one", event_sequence=1)
    second["properties"].update(app_run_id="run-two", event_sequence=1)
    assert observe(first, second)[1]["counts"]["uncertain_business_order_rows"] == 2


def test_same_runtime_sequence_can_prove_first_unknown_metadata():
    first = training(event_id="client-one", app_run_id="run-one", event_sequence=1)
    second = {**training(event_id="client-two", app_run_id="run-one", event_sequence=2, correct_count=4),
              "uuid": "provider-two"}
    rows, report = observe(second, first)
    assert report["quality_issue_count"] == 0
    assert canonical_observations(rows)[0].properties.get("correct_count") is None


def test_repeated_same_raw_object_does_not_become_two_canonical_observations():
    row = prepared(training())
    rows, report = observe_data_quality([row, row], start=START, end=END, coverage_complete=True)
    assert len(canonical_observations(rows)) == 1
    assert report["counts"]["raw_observation_rows"] == 2
    assert report["counts"]["duplicate_observation_rows"] == 1


def test_identical_provider_and_client_receipt_enrichment_is_not_a_body_conflict():
    first = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", event_id="client-one")
    delivered = {**first, "uuid": "provider-two", "received_at": "2026-10-03T12:00:00Z",
                 "properties": {**first["properties"], "$geoip_city_name": "new enrichment"}}
    rows, report = observe(first, delivered)
    assert report["counts"]["duplicate_observation_rows"] == 1
    assert report["quality_issue_count"] == 0
    assert len(canonical_observations(rows)) == 1


@pytest.mark.parametrize("identity", ["provider", "client"])
def test_cross_partition_event_identity_conflicts_are_retained_and_restrict_rates(tmp_path, identity):
    first = event("paywall_viewed", "2026-10-02T10:00:00Z", "usr_i",
                  event_id="client-one", paywall_view_id="view-one")
    second = event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i",
                   event_id="client-one" if identity == "client" else "client-two", paywall_view_id="view-two")
    if identity == "provider":
        second["uuid"] = first["uuid"]
    warehouse = import_days(tmp_path, [first, second])
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.dataset.event_rows == 1
    assert context.data_quality["counts"]["cross_partition_identity_conflict_rows"] == 1
    assert "import_identity_conflict" in {qa.id for qa in context.qa}
    metric = next(metric for metric in context.metrics if metric.id == "paywall_purchase_conversion")
    assert metric.import_conflict_rows == 1 and metric.value is None
    health_rows = load_prepared_rows(warehouse, day_window(date(2026, 10, 3)))
    assert not observation_usable(health_rows[0].properties)
    health = build_health(health_rows, window_start=START, window_end=END, coverage_complete=True)
    assert health.data_quality["counts"]["import_conflict_rows"] == 1
    assert not any(metric.reliable for metric in health.metrics if metric.unit == "rate")


def test_client_id_is_install_scoped_not_account_or_person_scoped():
    first = training(event_id="client-one", supabase_user_id="same-account")
    second = event("training_session_completed", "2026-10-03T11:00:00Z", "usr_other",
                   event_id="client-one", supabase_user_id="same-account", training_session_id="training-one",
                   accepted_unique_question_count=0, learning_outcome_rule_version="learning-v1")
    rows, report = observe(first, second)
    assert report["quality_issue_count"] == 0
    assert len(canonical_observations(rows)) == 2


def test_pre_window_completion_replay_is_not_new_learning_in_context_health_or_cli(tmp_path):
    first = training("2026-10-02T10:00:00Z")
    replay = training("2026-10-03T10:00:00Z", **{
        "installation_observation_id": "install-one", "first_observed_at": "2026-10-03T09:00:00Z",
        "observation_detection_method": "first_local_observation", "observation_contract_version": 1,
    })
    anchor = event("install_observation_resolved", "2026-10-03T09:00:00Z", "usr_i", **{
        key: replay["properties"][key] for key in (
            "installation_observation_id", "first_observed_at", "observation_detection_method", "observation_contract_version",
        )
    })
    warehouse = import_days(tmp_path, [first, replay, anchor])
    window = day_window(date(2026, 10, 3))
    context = build_context(warehouse, window)
    assert context.dataset.event_rows == 2
    assert next(item for item in context.uninterpreted_events if item.event == "training_session_completed").event_rows == 1
    assert context.data_quality["counts"]["pre_window_duplicate_rows"] == 1
    assert context.data_quality["history_partitions_complete"]
    assert context.learning_time_to_value.achieved == 0
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.invalid_observation_rows == 0
    rows = load_prepared_rows(warehouse, window)
    assert len(rows) == 2 and len(canonical_observations(rows)) == 1
    assert len(diagnostic_observations(rows)) == 1
    health = build_health(rows, window_start=window.start, window_end=window.end, coverage_complete=True)
    assert health.data_quality["counts"]["pre_window_duplicate_rows"] == 1
    assert not next(item for item in health.funnels if item.id == "learning").steps[-1].users
    out = tmp_path / "quality.json"
    main(["data-quality", "--warehouse", str(warehouse), "--day", "2026-10-03", "--out", str(out)])
    assert json.loads(out.read_text()) == context.data_quality


def test_historical_business_conflict_is_not_hidden_by_report_window(tmp_path):
    first = training("2026-10-02T10:00:00Z")
    conflicting = training("2026-10-03T10:00:00Z", accepted_unique_question_count=0)
    warehouse = import_days(tmp_path, [first, conflicting])
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.data_quality["counts"]["conflicting_business_rows"] == 1
    assert "business_identity_conflict" in {item.id for item in context.qa}
    assert all(metric.value is None and metric.business_conflict_rows for metric in context.metrics
               if metric.id in {"learning_d7_return", "d7_return"})
    assert context.learning_time_to_value.status == "limited_integrity"
    rows = load_prepared_rows(warehouse, day_window(date(2026, 10, 3)))
    reprocessed, report = observe_data_quality(rows, start=START, end=END, coverage_complete=True)
    assert not observation_usable(reprocessed[0].properties)
    assert report["counts"]["conflicting_business_rows"] == 1


def test_same_day_pre_window_replay_is_found_in_partial_day_window(tmp_path):
    first = training("2026-10-03T09:00:00Z")
    replay = training("2026-10-03T11:00:00Z")
    future = training("2026-10-03T12:00:00Z", accepted_unique_question_count=0)
    warehouse = import_days(tmp_path, [first, replay, future], days=("2026-10-03",))
    window = AnalysisWindow("partial", START.replace(hour=10), START.replace(hour=11, minute=30), "partial")
    rows, report = load_quality_observations(warehouse, window)
    assert len(rows) == 1
    assert report["counts"]["pre_window_duplicate_rows"] == 1
    assert report["quality_issue_count"] == 0
    assert len(canonical_observations(rows)) == 0


def test_partition_bounds_include_last_partial_day_but_exclude_exact_end_midnight(tmp_path):
    partial_end = START + timedelta(days=1, hours=1)
    parts = partition_days(tmp_path, START, partial_end)
    assert [day.isoformat() for day, _path, _meta in parts] == ["2026-10-03", "2026-10-04"]
    end_midnight = (START + timedelta(days=1)).astimezone(WARSAW).replace(hour=0)
    parts = partition_days(tmp_path, START, end_midnight)
    assert [day.isoformat() for day, _path, _meta in parts] == ["2026-10-03"]


def test_conflicting_offline_operation_does_not_prohibit_independent_paywall_fraction(tmp_path):
    trace = [
        ("paywall_viewed", {}),
        ("paywall_offer_ready", {"offer_load_id": "offer-one"}),
        ("paywall_cta_selected", {"action": "purchase"}),
        ("purchase_started", {"purchase_attempt_id": "attempt-one"}),
        ("purchase_succeeded", {"purchase_attempt_id": "attempt-one"}),
    ]
    raws = [event(name, f"2026-10-03T10:0{index}:00Z", "usr_i", paywall_view_id="view-one", **props)
            for index, (name, props) in enumerate(trace)]
    raws.extend([
        event("offline_pack_download_completed", "2026-10-03T11:00:00Z", "usr_i", operation_id="offline-one"),
        event("offline_pack_download_cancelled", "2026-10-03T12:00:00Z", "usr_i", operation_id="offline-one"),
    ])
    warehouse = import_days(tmp_path, raws)
    context = build_context(warehouse, day_window(date(2026, 10, 3)), minimum_contract())
    assert context.data_quality["counts"]["conflicting_business_rows"] == 2
    metric = next(item for item in context.metrics if item.id == "paywall_purchase_conversion")
    assert metric.business_conflict_rows == 0
    assert metric.value == 1


@pytest.mark.parametrize("first_event,second_event,ids", [
    ("purchase_succeeded", "purchase_cancelled", {"purchase_attempt_id": "attempt-one"}),
    ("purchase_succeeded", "purchase_failed", {"purchase_attempt_id": "attempt-one"}),
    ("restore_succeeded", "restore_failed", {"restore_attempt_id": "restore-one"}),
    ("paywall_offer_ready", "paywall_offer_failed", {"paywall_view_id": "view-one", "offer_load_id": "load-one"}),
    ("offline_pack_download_completed", "offline_pack_download_cancelled", {"operation_id": "download-one"}),
    ("progress_reset_confirmed", "progress_reset_failed", {"reset_operation_id": "reset-one"}),
])
def test_contradictory_definitive_terminal_families_are_quarantined(first_event, second_event, ids):
    rows, report = observe(
        event(first_event, "2026-10-03T10:00:00Z", "usr_i", **ids),
        event(second_event, "2026-10-03T11:00:00Z", "usr_i", **ids),
    )
    assert report["counts"]["conflicting_business_rows"] == 2
    assert not any(observation_usable(row.properties) for row in rows)


def test_pending_status_check_and_access_confirmation_are_not_conflicting_native_terminals():
    ids = {"purchase_attempt_id": "attempt-one", "product_id": "weekly"}
    rows, report = observe(*[
        event(name, f"2026-10-03T10:0{index}:00Z", "usr_i", **ids)
        for index, name in enumerate((
            "purchase_started", "purchase_pending", "purchase_status_check_completed",
            "purchase_access_confirmed", "purchase_succeeded",
        ))
    ])
    assert report["quality_issue_count"] == 0
    assert len(canonical_observations(rows)) == 5
    assert "purchase_pending" not in RULES and "purchase_status_check_completed" not in RULES


def test_offer_refresh_and_repeated_resume_abandon_episodes_stay_distinct():
    rows, report = observe(*[
        event(name, f"2026-10-03T10:0{index}:00Z", "usr_i", **props)
        for index, (name, props) in enumerate((
            ("paywall_offer_failed", {"paywall_view_id": "view-one", "offer_load_id": "load-one"}),
            ("paywall_offer_ready", {"paywall_view_id": "view-one", "offer_load_id": "load-two"}),
            ("training_session_resumed", {"training_session_id": "training-one"}),
            ("training_session_resumed", {"training_session_id": "training-one"}),
            ("training_session_abandoned", {"training_session_id": "training-one"}),
            ("training_session_abandoned", {"training_session_id": "training-one"}),
        ))
    ])
    assert report["quality_issue_count"] == 0
    assert report["counts"]["duplicate_observation_rows"] == 0
    assert len(canonical_observations(rows)) == 6


def test_notification_operation_id_matches_producer_and_conflicting_outcomes_restrict_observation():
    common = {"operation_id": "schedule-one", "operation": "enable", "scheduled_count": 1,
              "confirmation_scope": "helper_result_not_delivery"}
    rows, report = observe(
        event("notification_schedule_resolved", "2026-10-03T10:00:00Z", "usr_i", **common, outcome="enabled"),
        event("notification_schedule_resolved", "2026-10-03T11:00:00Z", "usr_i", **common, outcome="failed"),
    )
    assert report["counts"]["conflicting_business_rows"] == 2
    assert report["business_rules"][0]["grain"] == ["app_user_id", "operation_id"]
    assert not any(observation_usable(row.properties) for row in rows)


@pytest.mark.parametrize("kind", ["training", "exam"])
def test_reused_answer_or_revision_cannot_bind_two_sessions(kind):
    props = {"answer_id": "answer-one", "question_id": "question-one", "is_correct": True}
    if kind == "exam":
        props.update(answer_revision_id="revision-one", answer_action="create")
    rows, report = observe(
        event(f"{kind}_question_answered", "2026-10-03T10:00:00Z", "usr_i", **props, **{f"{kind}_session_id": "one"}),
        event(f"{kind}_question_answered", "2026-10-03T11:00:00Z", "usr_i", **props, **{f"{kind}_session_id": "two"}),
    )
    assert report["counts"]["conflicting_business_rows"] == 2
    assert not any(observation_usable(row.properties) for row in rows)


def test_same_exam_slot_new_revision_is_not_a_business_duplicate():
    props = {"exam_session_id": "exam-one", "answer_id": "slot-one", "question_id": "question-one"}
    rows, report = observe(
        event("exam_question_answered", "2026-10-03T10:00:00Z", "usr_i", **props,
              answer_revision_id="revision-one", answer_action="create", is_correct=False),
        event("exam_question_answered", "2026-10-03T11:00:00Z", "usr_i", **props,
              answer_revision_id="revision-two", answer_action="update", is_correct=True),
    )
    assert report["quality_issue_count"] == 0
    assert len(canonical_observations(rows)) == 2


def test_replayed_answer_with_changed_content_or_selection_is_not_silently_collapsed():
    props = {"training_session_id": "training-one", "answer_id": "answer-one", "question_id": "question-one",
             "is_correct": True, "question_revision": "content-v1:aaaaaaaaaaaaaaaa"}
    rows, report = observe(
        event("training_question_answered", "2026-10-03T10:00:00Z", "usr_i", **props),
        event("training_question_answered", "2026-10-03T11:00:00Z", "usr_i",
              **{**props, "question_revision": "content-v1:bbbbbbbbbbbbbbbb"}),
    )
    assert report["counts"]["conflicting_business_rows"] == 2
    assert len(canonical_observations(rows)) == 2


@pytest.mark.parametrize("value", [True, "5", -1, 5.5, float("inf"), 10 ** 400])
def test_invalid_immutable_count_is_not_a_clean_business_outcome(value):
    rows, report = observe(training(accepted_unique_question_count=value))
    assert report["counts"]["invalid_business_rows"] == 1
    assert not observation_usable(rows[0].properties)


def test_unknown_business_ids_are_not_inferred_from_account_person_or_time():
    row = event("training_session_completed", "2026-10-03T10:00:00Z", "usr_i", supabase_user_id="account-one")
    rows, report = observe(row, {**row, "uuid": "provider-two"})
    assert len(canonical_observations(rows)) == 2
    assert report["business_rules"][0]["unjoinable_observations"] == 2
    assert report["counts"]["invalid_business_rows"] == 0


def test_receipt_lag_separates_client_occurrence_provider_proxy_and_invalid_negative_clocks():
    raws = [
        {**event("screen_viewed", "2026-10-03T10:00:02Z", "usr_i",
                 client_occurred_at="2026-10-03T10:00:00Z"), "received_at": "2026-10-03T10:00:10Z"},
        {**event("screen_viewed", "2026-10-03T11:00:00Z", "usr_i",
                 client_occurred_at="2026-10-03T11:00:00Z"), "received_at": "2026-10-03T12:00:00Z"},
        {**event("screen_viewed", "2026-10-03T13:00:00Z", "usr_i"), "received_at": "2026-10-03T13:00:20Z"},
        {**event("screen_viewed", "2026-10-03T14:00:00Z", "usr_i",
                 client_occurred_at="2026-10-03T14:00:00Z"), "received_at": "2026-10-03T13:59:59Z"},
        {**event("screen_viewed", "2026-10-03T15:00:00Z", "usr_i",
                 client_occurred_at="invalid"), "received_at": "2026-10-03T15:00:20Z"},
        {**event("screen_viewed", "2026-10-03T16:00:00Z", "usr_i"), "received_at": "invalid"},
        event("screen_viewed", "2026-10-03T17:00:00Z", "usr_i"),
    ]
    lag = observe(*raws)[1]["receipt_lag"]
    assert lag["median_client_lag_seconds"] == 1805
    assert lag["p95_client_lag_seconds"] == 3600
    assert lag["median_provider_event_time_proxy_seconds"] == 20
    assert lag["max_event_client_time_drift_seconds"] == 2
    assert lag["client_lag_buckets"] == {"under_60s": 1, "1h_to_24h": 1}
    assert lag["counts"]["invalid_client_occurrence_rows"] == 1
    assert lag["counts"]["invalid_receipt_rows"] == 1
    assert lag["counts"]["receipt_unavailable_rows"] == 1
    assert lag["counts"]["receipt_precedes_occurrence_rows"] == 1
    assert lag["counts"]["provider_event_time_proxy_rows"] == 1
    assert lag["native_delivery"] == "not_verified" and not lag["export_time_is_receipt"]


def test_export_timestamp_never_supplies_missing_receipt_and_empty_quality_report_has_zero_counts(tmp_path):
    warehouse = import_days(tmp_path, [training()])
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.data_quality["receipt_lag"]["median_client_lag_seconds"] is None
    assert context.data_quality["receipt_lag"]["counts"]["receipt_unavailable_rows"] == 1
    _rows, empty = observe_data_quality([], start=START, end=END)
    assert empty["counts"]["raw_observation_rows"] == 0
    assert empty["counts"]["analysis_observation_rows"] == 0
    assert empty["status"] == "incomplete_coverage"


def test_falsey_invalid_clock_is_invalid_not_missing():
    row = prepared(training())
    row = replace(row, client_occurred_at=0, received_at=0)
    _rows, report = observe_data_quality([row], start=START, end=END)
    assert report["receipt_lag"]["counts"]["invalid_receipt_rows"] == 1
    assert report["receipt_lag"]["counts"]["invalid_client_occurrence_rows"] == 1


def test_huge_numbers_fail_closed_without_breaking_learning_report():
    assert not nonnegative_number(10 ** 400)
    result = learning_time_to_value([prepared(training(accepted_unique_question_count=10 ** 400))],
                                    start=START, end=END, complete=True)
    assert result.achieved == 0


def test_client_validation_failure_is_exposed_by_standalone_quality_gate():
    rows, report = observe(training(analytics_payload_valid=False))
    assert report["status"] == "limited_integrity"
    assert report["quality_issue_count"] == 1
    assert report["counts"]["invalid_client_payload_rows"] == 1
    assert report["counts"]["analysis_observation_rows"] == 1
    assert report["counts"]["usable_analysis_observation_rows"] == 0
    assert not observation_usable(rows[0].properties)


def test_same_provider_body_uses_utc_instant_not_datetime_display_offset():
    first = prepared(training())
    second = replace(first, timestamp=first.timestamp.astimezone(WARSAW))
    rows, report = observe_data_quality([first, second], start=START, end=END)
    assert report["counts"]["import_conflict_rows"] == 0
    assert report["counts"]["duplicate_observation_rows"] == 1
    assert len(canonical_observations(rows)) == 1


def test_quality_window_is_half_open_and_history_does_not_look_beyond_report_end():
    current = training()
    future = training(END.isoformat(), accepted_unique_question_count=0)
    rows, report = observe(current, future)
    assert len(rows) == 1 and report["quality_issue_count"] == 0


@pytest.mark.parametrize("start,end", [
    (START.replace(tzinfo=None), END), (START, END.replace(tzinfo=None)), (END, START), (START, START),
])
def test_quality_window_requires_explicit_ordered_timezone_bounds(start, end):
    with pytest.raises(ValueError):
        observe_data_quality([], start=start, end=end)
