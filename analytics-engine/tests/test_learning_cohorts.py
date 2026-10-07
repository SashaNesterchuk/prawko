from dataclasses import replace
from datetime import date, timedelta

import pytest

from prawko_analytics.context import build_context, range_window
from prawko_analytics.contract import load_contract
from prawko_analytics.ingest import ingest_dump
from tests.support import LEARNING_INTERACTION_EVENTS, event, write_dump

ANCHOR = {
    "installation_observation_id": "installation-a",
    "first_observed_at": "2026-09-01T10:00:00Z",
    "native_installed_at": "2026-08-01T10:00:00Z",
    "observation_detection_method": "first_local_observation",
    "observation_contract_version": 1,
}


def _context(tmp_path, rows):
    warehouse = tmp_path / "warehouse"
    start = date(2026, 9, 1)
    for offset in range(9):
        day = start + timedelta(days=offset)
        dump = write_dump(
            tmp_path / f"{day}.json", day=day.isoformat(), exported_at="2026-09-12T10:00:00Z",
            events=[row for row in rows if row["timestamp"].startswith(day.isoformat())],
        )
        ingest_dump(dump, warehouse)
    contract = load_contract()
    contract = replace(contract, metrics=tuple(replace(metric, min_denominator=1) for metric in contract.metrics))
    return build_context(warehouse, range_window("cohort", start, date(2026, 9, 10)), contract)


def _learning(name, timestamp, user="a", **props):
    return event(name, timestamp, user, **{**ANCHOR, **props})


def _retention(context, name="learning_d7_return"):
    return next(metric for metric in context.metrics if metric.id == name)


def test_open_return_is_not_learning_retention(tmp_path):
    context = _context(tmp_path, [
        event("Application Installed", "2026-09-01T10:00:00Z", "a"),
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("profile_action_selected", "2026-09-08T10:00:00Z"),
    ])
    assert _retention(context, "d7_return").numerator == 1
    assert _retention(context).denominator == 1
    assert _retention(context).numerator == 0
    assert context.learning_time_to_value.censored == 1


def test_five_unique_accepted_training_questions_define_a_meaningful_return(tmp_path):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("training_session_completed", "2026-09-08T10:00:00Z",
                  training_session_id="training-1", accepted_unique_question_count=5,
                  learning_outcome_rule_version="learning-v1"),
    ])
    assert _retention(context).numerator == _retention(context).denominator == 1
    assert _retention(context).grain == "installation_observation_id"


def test_repeated_resolution_does_not_reanchor_install_to_the_event_date(tmp_path):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("install_observation_resolved", "2026-09-08T10:00:00Z"),
        _learning("exam_session_completed", "2026-09-08T10:01:00Z",
                  exam_session_id="exam-1", completion_status="completed",
                  answered_count=25, question_total=25, learning_outcome_rule_version="learning-v1"),
    ])
    assert _retention(context).numerator == _retention(context).denominator == 1


def test_partial_exam_or_short_training_is_not_learning_activation(tmp_path):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("training_session_completed", "2026-09-01T10:10:00Z",
                  training_session_id="t", accepted_unique_question_count=4, learning_outcome_rule_version="learning-v1"),
        _learning("exam_session_completed", "2026-09-01T10:20:00Z", exam_session_id="e",
                  completion_status="completed", answered_count=1, question_total=25, learning_outcome_rule_version="learning-v1"),
    ])
    timing = context.learning_time_to_value
    assert timing.observations == 1
    assert timing.achieved == 0 and timing.censored == 1 and timing.median_achieved_seconds is None


def test_time_to_value_keeps_nonachievers_in_the_cohort(tmp_path):
    second = {**ANCHOR, "installation_observation_id": "installation-b"}
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        event("install_observation_resolved", "2026-09-01T10:00:00Z", "b", **second),
        _learning("training_session_completed", "2026-09-01T10:30:00Z",
                  training_session_id="t", accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1"),
    ])
    timing = context.learning_time_to_value
    assert timing.observations == 2
    assert timing.achieved == 1 and timing.censored == 1
    assert timing.median_achieved_seconds == 1800


def test_storage_recovery_and_conflicting_anchors_are_excluded(tmp_path):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("install_observation_resolved", "2026-09-02T10:00:00Z", first_observed_at="2026-09-02T10:00:00Z"),
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z", user="b",
                  installation_observation_id="installation-b", observation_detection_method="storage_recovery"),
    ])
    assert context.learning_time_to_value.observations == 0
    assert context.learning_time_to_value.excluded_observations == 2
    assert _retention(context).denominator == 0


def test_conflicting_completion_does_not_become_a_learning_outcome_or_a_clean_timing_report(tmp_path):
    completed = _learning(
        "training_session_completed", "2026-09-08T10:00:00Z", event_id="run:completion",
        training_session_id="t", accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1",
    )
    conflicting = {**completed, "properties": {**completed["properties"], "accepted_unique_question_count": 0}}
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"), completed, conflicting,
    ])
    timing = context.learning_time_to_value
    assert timing.status == "limited_integrity"
    assert timing.invalid_observation_rows == 2
    assert timing.achieved == 0
    assert timing.median_achieved_seconds is None
    assert _retention(context).numerator == 0
    assert _retention(context).value is None


@pytest.mark.parametrize("annotation", [
    {"analytics_payload_contract_version": 2, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": False},
    {"analytics_payload_contract_version": 3, "analytics_payload_contract_status": "valid",
     "analytics_payload_valid": True},
    {"analytics_payload_contract_version": 2, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": True},
])
def test_unusable_checkout_does_not_erase_independently_verified_learning_return_or_timing(tmp_path, annotation):
    context = _context(tmp_path, [
        event("Application Installed", "2026-09-01T10:00:00Z", "a"),
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("training_session_completed", "2026-09-08T10:00:00Z", training_session_id="training-one",
                  accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1"),
        _learning("purchase_succeeded", "2026-09-08T11:00:00Z", purchase_attempt_id="purchase-one",
                  checkout_view_id="view-one", product_id="sku", **annotation),
    ])
    learning = _retention(context)
    assert learning.value == 1 and learning.invalid_payload_rows == 0
    assert learning.numerator == learning.denominator == 1
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.achieved == 1
    assert context.learning_time_to_value.median_achieved_seconds == 7 * 24 * 3600
    calendar = _retention(context, "d7_return")
    assert calendar.value is None and calendar.invalid_payload_rows == 1


@pytest.mark.parametrize("event_name,properties", [
    ("learning_operation_failed", {
        "operation_id": "operation-one", "operation_id_source": "failure_observation",
        "operation": "sync_answer", "error_code": "network", "user_visible": False,
    }),
    ("notification_schedule_resolved", {
        "operation_id": "notification-one", "operation": "sync", "outcome": "failed",
        "scheduled_count": 1, "enabled": True, "confirmation_scope": "helper_result_not_delivery",
    }),
    ("offline_pack_download_failed", {
        "operation_id": "offline-one", "category": "B", "operation": "remove", "error_code": "storage",
    }),
    ("progress_reset_failed", {
        "reset_operation_id": "reset-one", "source": "profile", "error_code": "storage",
    }),
    ("screen_viewed", {
        "screen_observation_scope": "inline_review", "route_pattern": "/exam/answers",
        "screen_name": "exam_answers", "exam_session_id": "exam-one",
    }),
    ("learning_intent_requested", {"learning_intent_id": "intent-one", "mode": "quarter"}),
])
def test_invalid_auxiliary_operation_retains_independent_learning_root_and_outcome(tmp_path, event_name, properties):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("training_session_completed", "2026-09-08T10:00:00Z", training_session_id="training-one",
                  accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1"),
        _learning(event_name, "2026-09-08T11:00:00Z", **properties,
                  analytics_payload_contract_version=2, analytics_payload_contract_status="invalid",
                  analytics_payload_valid=False),
    ])
    learning = _retention(context)
    assert learning.value == 1 and learning.invalid_payload_rows == 0
    assert learning.numerator == learning.denominator == 1
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.achieved == 1
    assert context.learning_time_to_value.median_achieved_seconds == 7 * 24 * 3600
    assert context.data_quality["client_payload_validation"]["counts"]["v2_invalid"] == 1


@pytest.mark.parametrize("event_name", LEARNING_INTERACTION_EVENTS)
def test_invalid_learning_interaction_does_not_erase_independently_confirmed_d7_or_ttv(tmp_path, event_name):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning("training_session_completed", "2026-09-08T10:00:00Z", training_session_id="training-one",
                  accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1"),
        _learning(event_name, "2026-09-08T11:00:00Z", training_session_id="training-one", exam_session_id="exam-one",
                  answered_count=5, correct_count=9, question_total=5,
                  analytics_payload_contract_version=2, analytics_payload_contract_status="invalid",
                  analytics_payload_valid=False, analytics_payload_invalid_keys="correct_count"),
    ])
    learning = _retention(context)
    assert learning.value == 1 and learning.invalid_payload_rows == 0
    assert learning.numerator == learning.denominator == 1
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.achieved == 1
    assert context.learning_time_to_value.invalid_observation_rows == 0
    assert context.learning_time_to_value.median_achieved_seconds == 7 * 24 * 3600
    assert context.data_quality["client_payload_validation"]["counts"]["v2_invalid"] == 1


@pytest.mark.parametrize("event_name", [
    "training_result_viewed", "training_answers_review_question_viewed", "training_answers_review_closed",
    "exam_result_viewed", "exam_answers_review_question_viewed", "exam_session_ended",
    "exam_restart_selected", "answer_explanation_viewed",
])
def test_clean_interaction_annotations_and_completion_like_fields_cannot_manufacture_learning_outcomes(tmp_path, event_name):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z"),
        _learning(event_name, "2026-09-08T10:00:00Z", training_session_id="training-one", exam_session_id="exam-one",
                  result_origin="existing_result", answered_count=5, question_total=5,
                  status="completed", end_reason="learner_finish", completion_status="completed",
                  accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1",
                  analytics_payload_contract_version=2, analytics_payload_contract_status="valid",
                  analytics_payload_valid=True),
    ])
    learning = _retention(context)
    assert learning.denominator == 1 and learning.numerator == 0 and learning.value == 0
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.achieved == 0 and context.learning_time_to_value.censored == 1
    assert context.learning_time_to_value.median_achieved_seconds is None
    assert context.data_quality["client_payload_validation"]["counts"]["v2_valid"] == 1


@pytest.mark.parametrize("annotation", [
    {"analytics_payload_contract_version": 2, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": False},
    {"analytics_payload_contract_version": 3, "analytics_payload_contract_status": "valid",
     "analytics_payload_valid": True},
])
def test_unusable_nonproduct_install_root_still_restricts_dependent_learning_return(tmp_path, annotation):
    context = _context(tmp_path, [
        _learning("install_observation_resolved", "2026-09-01T10:00:00Z", **annotation),
        _learning("training_session_completed", "2026-09-08T10:00:00Z", training_session_id="training-one",
                  accepted_unique_question_count=5, learning_outcome_rule_version="learning-v1"),
    ])
    metric = _retention(context)
    assert metric.invalid_payload_rows == 1
    assert metric.value is None
    assert context.learning_time_to_value.status == "limited_integrity"
