import json
from dataclasses import replace
from datetime import date, timedelta

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import build_context, range_window
from prawko_analytics.health import build_health
from prawko_analytics.ingest import WARSAW, ingest_dump
from prawko_analytics.onboarding import observed_onboarding, warehouse_onboarding_report
from tests.support import event, write_dump
from tests.test_acquisition import END, FIRST, START, THROUGH, _row

APP = "synthetic.native.app"
BASE = {"application_id": APP, "application_id_basis": "native_application_id"}
COMPLETE = FIRST + timedelta(minutes=2)
HOME = FIRST + timedelta(minutes=3)


def _flow(name="onboarding_flow_viewed", *, at=None, user="install-a", attempt="onboarding-a",
          started=FIRST, completed=None, home=None, **changes):
    at = at or {"onboarding_flow_viewed": FIRST, "onboarding_flow_completed": COMPLETE,
                "onboarding_home_arrived": HOME}[name]
    if name == "onboarding_flow_completed" and completed is None:
        completed = COMPLETE
    if name == "onboarding_home_arrived":
        completed, home = completed or COMPLETE, home or HOME
    row = _row(name, at=at, user=user, **{
        **BASE, "onboarding_attempt_id": attempt, "onboarding_observation_version": 1,
        "onboarding_started_at": started.isoformat(),
        "onboarding_completed_at": completed.isoformat() if completed else None,
        "onboarding_home_observed_at": home.isoformat() if home else None,
        "onboarding_storage_status": "persistent", "onboarding_detection_method": "new_observation",
        "onboarding_clock_order_valid": True, "flow_context": "onboarding", "flow_version": "category_schedule_v1",
        "start_reason": "incomplete_onboarding_observed", "reset_operation_id": None,
        **({"completion_scope": "local_store_operations_returned", "completion_source": "finalize_local"}
           if name == "onboarding_flow_completed" else {}),
        **({"home_arrival_basis": "foreground_route_observed", "screen_name": "home"}
           if name == "onboarding_home_arrived" else {}), **changes,
    })
    return replace(row, event_id=f"provider.{name}.{user}.{attempt or 'missing'}.{at.strftime('%Y%m%dT%H%M%S%f')}")


def _learning(name="training_session_completed", *, at=None, user="install-a", **changes):
    at = at or HOME + timedelta(minutes=4)
    row = _row(name, at=at, user=user, **{
        **BASE, "training_session_id": "training-a", "accepted_unique_question_count": 5,
        "learning_outcome_rule_version": "learning-v1", "question_id": "question-a", "answer_id": "answer-a",
        "is_correct": True, "feature": "training", "ready_reason": "focused_ready",
        "ready_duration_scope": "current_focus_entry", "media_readiness": "not_measured",
        "ready_foreground_ms": 20, "ready_wall_ms": 20, **changes,
    })
    revision = row.properties.get("answer_revision_id") or "observation"
    return replace(row, event_id=f"provider.{name}.{user}.{at.strftime('%Y%m%dT%H%M%S%f')}.{revision}")


def _trace(*, user="install-a"):
    return [_flow(user=user), _flow("onboarding_flow_completed", user=user),
            _flow("onboarding_home_arrived", user=user),
            _learning("training_session_started", at=HOME + timedelta(minutes=1), user=user),
            _learning("learning_screen_ready", at=HOME + timedelta(minutes=2), user=user),
            _learning("training_question_answered", at=HOME + timedelta(minutes=3), user=user),
            _learning(user=user)]


def _report(rows, *, through=THROUGH, covered=True, start=START, end=END):
    return observed_onboarding(rows, start=start, end=end, observe_through=through,
                               coverage=lambda app, left, right: covered and app == APP)


def _cohort(report, population="first_observed", reason=None):
    return next(row for row in report["cohorts"] if row["population"] == population
                and (reason is None or row["start_reason"] == reason))


def _metric(report, name="meaningful", *, population="first_observed", frame="activation_24h", reason=None):
    return _cohort(report, population, reason)["frames"][frame]["metrics"][name]


def test_first_observed_and_onboarding_have_distinct_roots_and_ordered_milestones():
    report = _report(_trace())
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "ordered_learning_chain")["fraction"] == 1
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "after_home_ordered_learning_chain", population="onboarding_attempt")["fraction"] == 1
    assert report["grains"]["first_observed"] == "installation_observation_id"
    assert len(report["units"]) == 2
    assert "physical_new_install" in report["must_not_claim"]


def test_mature_nonachievers_are_retained_not_conditioned_on_home_opening_or_learning():
    report = _report([*_trace(), _flow(user="install-b", attempt="onboarding-b",
                                     installation_observation_id="observation-install-b")])
    assert _metric(report)["fraction"] == 0.5
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] == 0.5
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 0.5
    frame = _cohort(report)["frames"]["activation_24h"]
    assert frame["ttv_observed_achievers"] == frame["ttv_not_achieved_as_of"] == 1
    assert frame["median_achieved_seconds"] == 420


def test_category_and_schedule_steps_are_not_whole_flow_completion_or_home():
    report = _report([
        _flow(),
        _row("onboarding_step_completed", at=COMPLETE, **BASE, onboarding_attempt_id="onboarding-a",
             flow_context="onboarding", step="exam_schedule"),
        _row("screen_viewed", at=HOME, **BASE, screen_name="home"),
    ])
    for name in ("local_completed", "home_observed", "ordered_home", "after_home_meaningful"):
        assert _metric(report, name, population="onboarding_attempt")["fraction"] == 0


def test_foreground_home_is_not_itself_learning_and_open_is_separate():
    report = _report([*_trace()[:3], _row("app_visit_started", at=HOME + timedelta(minutes=1), **BASE,
                                       app_visit_id="visit-a")])
    assert _metric(report)["fraction"] == 0
    assert _metric(report, "opened")["fraction"] == 1
    assert _metric(report, "home_observed", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 0


def test_missing_explicit_local_completion_does_not_become_a_verified_ordered_home():
    report = _report([_flow(), _flow("onboarding_home_arrived"), _learning()])
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] == 0
    assert _metric(report, "home_observed", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] is None
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 1


def test_acceptance_and_home_clocks_do_not_get_replaced_by_delayed_capture():
    report = _report([
        _flow(), _flow("onboarding_flow_completed", at=HOME + timedelta(minutes=10)),
        _flow("onboarding_home_arrived", at=HOME + timedelta(minutes=11)), _learning(),
    ])
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 1


def test_settings_and_legacy_runtime_attempts_are_not_persistent_first_run_roots():
    report = _report([_flow(flow_context="settings")])
    assert all(row["population"] == "first_observed" for row in report["cohorts"])
    legacy = _report([_flow(onboarding_observation_version=None, onboarding_started_at=None)])
    assert all(row["population"] == "first_observed" for row in legacy["cohorts"])
    assert legacy["excluded"]["onboarding_start_clock_not_observed"] == 1


@pytest.mark.parametrize("changes", [
    {"onboarding_storage_status": "memory_only"}, {"onboarding_detection_method": "storage_recovery"},
    {"onboarding_detection_method": "identity_not_bound"}, {"onboarding_clock_order_valid": False},
    {"onboarding_observation_version": True}, {"flow_version": "another-flow"},
    {"start_reason": "learner@example.com"}, {"start_reason": []}, {"reset_operation_id": {}},
    {"start_reason": "progress_reset", "reset_operation_id": None},
])
def test_bad_origin_metadata_remains_a_limited_candidate_not_a_clean_denominator(changes):
    report = _report([_flow(**changes), _flow("onboarding_flow_completed"), _flow("onboarding_home_arrived")])
    assert _cohort(report, "onboarding_attempt")["start_candidates"] == 1
    assert _cohort(report, "onboarding_attempt")["verified_start_candidates"] == 0
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None


def test_restored_view_keeps_original_attempt_anchor_not_restart_capture_time():
    restored = _flow(at=FIRST + timedelta(days=2), onboarding_detection_method="restored")
    assert _cohort(_report([_flow(), restored]), "onboarding_attempt")["start_candidates"] == 1
    report = _report([_flow(), restored], start=START + timedelta(days=2), end=END + timedelta(days=2))
    assert report["units"] == []


def test_completion_without_entry_is_orphaned_not_reanchored_as_a_viewer():
    report = _report([_flow("onboarding_flow_completed", started=COMPLETE,
                           start_reason="completion_without_entry_observed")])
    assert _cohort(report, "onboarding_attempt")["verified_start_candidates"] == 0
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None


def test_reset_creates_another_attempt_not_another_install_and_bounds_temporal_association():
    reset_at = FIRST + timedelta(minutes=10)
    rows = [*_trace()[:3],
            _flow(at=reset_at, started=reset_at, attempt="onboarding-reset",
                  start_reason="progress_reset", reset_operation_id="reset-a"),
            _learning(at=reset_at + timedelta(minutes=1))]
    report = _report(rows)
    assert _cohort(report)["start_candidates"] == 1
    assert _cohort(report, "onboarding_attempt", "progress_reset")["start_candidates"] == 1
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt",
                   reason="incomplete_onboarding_observed")["fraction"] == 0


def test_confirmed_reset_bounds_old_attempt_even_without_a_delivered_new_attempt():
    reset_at = FIRST + timedelta(minutes=10)
    report = _report([*_trace()[:3],
                      _row("progress_reset_confirmed", at=reset_at, **BASE,
                           reset_operation_id="reset-a", source="settings", completion_scope="local_operations_returned"),
                      _learning(at=reset_at + timedelta(minutes=1))])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 0


def test_shared_attempt_and_installation_ids_restrict_both_owners_without_account_join():
    report = _report([_flow(), _flow(user="install-b", installation_observation_id="observation-install-a")])
    assert _metric(report)["fraction"] is None
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None


def test_conflicting_start_clock_is_not_resolved_by_first_or_last_input():
    original, changed = _flow(), _flow(at=FIRST + timedelta(minutes=1),
                                      onboarding_started_at=(FIRST + timedelta(seconds=1)).isoformat())
    for rows in ([original, changed], [changed, original]):
        report = _report(rows)
        assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None


def test_invalid_answers_ready_and_completion_have_separate_rate_domains():
    report = _report([*_trace()[:3],
                      _learning("training_question_answered", answer_id=None),
                      _learning("learning_screen_ready", question_id=None),
                      _learning()])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "accepted_answer")["fraction"] is None
    assert _metric(report, "usable_question")["fraction"] is None
    other = _report([_flow(), _learning("training_question_answered"), _learning(accepted_unique_question_count=True)])
    assert _metric(other)["fraction"] is None
    assert _metric(other, "accepted_answer")["fraction"] == 1


def test_missing_answer_namespace_does_not_erase_clean_meaningful_learning():
    report = _report([_flow(), _learning("training_question_answered", application_id=None), _learning()])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "accepted_answer")["fraction"] is None


def test_invalid_local_completion_does_not_erase_a_clean_foreground_home_or_learning_metric():
    report = _report([
        _flow(), _flow("onboarding_flow_completed", analytics_payload_valid=False),
        _flow("onboarding_home_arrived"), _learning(),
    ])
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None
    assert _metric(report, "home_observed", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 1


def test_late_home_defect_restricts_its_horizon_not_the_prior_clean_nonachiever_window():
    late = FIRST + timedelta(days=8)
    report = _report([
        _flow(), _flow("onboarding_flow_completed"),
        _flow("onboarding_home_arrived", at=late, home=late, screen_name="not-home"),
    ])
    assert _metric(report, "home_observed", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "home_observed", population="onboarding_attempt", frame="d30")["fraction"] is None


def test_valid_late_home_without_explicit_completion_does_not_restrict_earlier_ordered_home():
    late = FIRST + timedelta(days=8)
    report = _report([_flow(), _flow("onboarding_home_arrived", at=late, home=late)])
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "home_observed", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d30")["fraction"] is None
    assert _metric(report, "home_observed", population="onboarding_attempt", frame="d30")["fraction"] == 1


def test_completion_at_exclusive_horizon_does_not_create_earlier_onboarding_observations():
    right = FIRST + timedelta(days=7)
    report = _report([
        _flow(), _flow("onboarding_flow_completed", at=right, completed=right),
        _flow("onboarding_home_arrived", at=right, completed=right, home=right),
    ])
    assert _metric(report, "local_completed", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d30")["fraction"] == 1


def test_unrelated_payload_failure_does_not_poison_the_new_dependent_rates():
    report = _report([*_trace(), _row("paywall_viewed", at=FIRST + timedelta(minutes=1),
                                    **BASE, analytics_payload_valid=False)])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] == 1


def test_provider_id_conflict_is_retained_and_cannot_become_a_clean_completion():
    complete = _learning()
    conflicting = replace(complete, properties={**complete.properties, "accepted_unique_question_count": 0})
    report = _report([_flow(), complete, conflicting])
    assert _metric(report)["fraction"] is None
    assert report["source_quality_counts"]["cross_partition_identity_conflict_rows"] == 2


@pytest.mark.parametrize("changes", [
    {"observation_detection_method": "storage_recovery"}, {"observation_detection_method": "memory_only"},
    {"observation_contract_version": True}, {"first_observed_at": None},
])
def test_first_observed_anchors_are_not_recovered_from_native_install_or_sdk_markers(changes):
    report = _report([_flow(**changes), _row("Application Installed", at=FIRST, anchor=False, **BASE)])
    assert all(row["population"] != "first_observed" for row in report["cohorts"])


def test_missing_native_namespace_at_first_observation_is_not_backfilled_from_later_learning():
    report = _report([_flow(application_id=None), _learning()])
    assert _metric(report)["observed_units"] == 1
    assert _metric(report)["fraction"] is None


def test_nonprimary_learning_identity_is_not_joined_via_distinct_account_or_person():
    report = _report([_flow(), _learning(app_user_id=None)])
    assert _metric(report)["fraction"] is None
    assert _metric(report)["observed_units"] == 0


def test_known_root_missing_primary_learning_restricts_its_domain_not_root_population():
    report = _report([
        *_trace(), _learning(at=HOME + timedelta(minutes=5), app_user_id=None),
        _row("app_visit_started", at=HOME + timedelta(minutes=6), **BASE, app_visit_id="visit-a"),
    ])
    assert _metric(report)["fraction"] is None
    assert _metric(report, "accepted_answer")["fraction"] == 1
    assert _metric(report, "opened")["fraction"] == 1
    assert _cohort(report)["frames"]["activation_24h"]["common_issues"] == {}
    assert "unjoinable_first_observed_declarations" not in report["excluded"]


def test_known_root_bad_dependent_payload_does_not_create_an_unknown_new_root():
    report = _report([
        *_trace(),
        _learning("training_question_answered", at=HOME + timedelta(minutes=5),
                  app_user_id=None, analytics_payload_valid=False, answer_id=None),
    ])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "accepted_answer")["fraction"] is None
    assert _metric(report, "ordered_learning_chain")["fraction"] is None
    assert _cohort(report)["frames"]["activation_24h"]["common_issues"] == {}


def test_known_root_from_pre_window_history_does_not_restrict_unrelated_new_root_population():
    prior = FIRST - timedelta(days=2)
    report = _report([
        *_trace(),
        _flow(user="old-install", attempt="old-onboarding", at=prior, started=prior,
              first_observed_at=prior.isoformat()),
        _learning(user="old-install", app_user_id=None, first_observed_at=prior.isoformat()),
    ])
    assert _cohort(report)["start_candidates"] == 1
    assert _metric(report)["fraction"] is None
    assert _metric(report, "accepted_answer")["fraction"] == 1
    assert _cohort(report)["frames"]["activation_24h"]["common_issues"] == {}


def test_unknown_root_reusing_known_observation_with_conflicting_clock_still_restricts_population():
    report = _report([
        *_trace(),
        _learning(app_user_id=None, first_observed_at=(FIRST + timedelta(seconds=1)).isoformat()),
    ])
    assert _metric(report, "accepted_answer")["fraction"] is None
    assert _cohort(report)["frames"]["activation_24h"]["common_issues"]["root_population_membership_unverified"]


def test_missing_v1_attempt_id_cannot_improve_the_known_viewer_denominator():
    report = _report([*_trace(), _flow(user="install-b", attempt=None)])
    metric = _metric(report, "local_completed", population="onboarding_attempt")
    assert metric["fraction"] is None
    assert "root_population_membership_unverified" in _cohort(report, "onboarding_attempt")["frames"]["activation_24h"]["common_issues"]


def test_unjoinable_first_observed_declaration_restricts_population_not_unknown_is_zero():
    report = _report([*_trace(), _flow(user="install-b", attempt="onboarding-b", app_user_id=None)])
    assert _metric(report)["fraction"] is None
    assert report["excluded"]["unjoinable_first_observed_declarations"] == 1


def test_malformed_anchor_on_another_owner_is_not_removed_to_improve_the_fraction():
    report = _report([*_trace(), _flow(user="install-b", attempt="onboarding-b", first_observed_at=None)])
    assert _metric(report)["fraction"] is None
    assert "root_population_membership_unverified" in _cohort(report)["frames"]["activation_24h"]["common_issues"]


def test_future_anchor_claim_is_unknown_not_a_proof_that_the_root_is_outside_selection():
    report = _report([*_trace(), _flow(user="install-b", attempt="onboarding-b",
                                     first_observed_at=(FIRST + timedelta(days=2)).isoformat())])
    assert _metric(report)["fraction"] is None


def test_future_attempt_start_is_unknown_not_a_proof_that_the_root_is_outside_selection():
    report = _report([
        *_trace(),
        _flow(user="install-b", attempt="onboarding-b", started=FIRST + timedelta(days=2)),
    ])
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] is None
    assert _cohort(report, "onboarding_attempt")["frames"]["activation_24h"]["common_issues"][
        "root_population_membership_unverified"
    ]


@pytest.mark.parametrize("field", ["onboarding_completed_at", "onboarding_home_observed_at", "reset_operation_id"])
def test_missing_nullable_origin_fields_are_not_an_explicit_clean_null(field):
    source = _flow()
    source = replace(source, properties={key: value for key, value in source.properties.items() if key != field})
    report = _report([source])
    assert _metric(report, "local_completed", population="onboarding_attempt")["fraction"] is None
    assert _cohort(report, "onboarding_attempt")["verified_start_candidates"] == 0


def test_unknown_root_app_namespace_cannot_improve_a_known_application_denominator():
    report = _report([*_trace(), _flow(user="install-b", attempt="onboarding-b", application_id=None)])
    clean = next(row for row in report["cohorts"] if row["population"] == "first_observed" and row["application_id"] == APP)
    assert clean["frames"]["activation_24h"]["metrics"]["meaningful"]["fraction"] is None


def test_other_app_and_identity_with_bad_observations_do_not_suppress_clean_app_scope():
    report = _report([*_trace(), _flow(user="other-install", attempt="other-onboarding",
                                     application_id="other.app", onboarding_storage_status="memory_only")])
    clean = next(row for row in report["cohorts"] if row["population"] == "onboarding_attempt" and row["application_id"] == APP)
    assert clean["frames"]["activation_24h"]["metrics"]["ordered_home"]["fraction"] == 1
    unjoinable = _report([*_trace(), _flow(user="other-install", attempt=None, application_id="other.app")])
    assert _metric(unjoinable, "ordered_home", population="onboarding_attempt")["fraction"] == 1


def test_next_attempt_from_history_bounds_association_even_when_outside_root_selection():
    next_start = FIRST + timedelta(days=2)
    report = _report([*_trace()[:3],
                      _flow(at=next_start, started=next_start, attempt="later-onboarding",
                            start_reason="repeat_incomplete_onboarding_observed"),
                      _learning(at=next_start + timedelta(minutes=1))])
    assert _cohort(report, "onboarding_attempt")["start_candidates"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d7")["fraction"] == 0


@pytest.mark.parametrize("changes", [
    {"attempt": None}, {"onboarding_storage_status": "memory_only"},
    {"analytics_payload_valid": False},
])
def test_uncertain_late_attempt_boundary_limits_its_horizon_not_prior_learning(changes):
    late = FIRST + timedelta(days=8)
    report = _report([
        *_trace()[:3],
        _flow(at=late, started=late, **{
            "attempt": "late-onboarding", "start_reason": "repeat_incomplete_onboarding_observed", **changes,
        }),
        _learning(at=late + timedelta(minutes=1)),
    ])
    assert _metric(report)["fraction"] == 0
    assert _metric(report, frame="d30")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d30")["fraction"] is None
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d30")["fraction"] == 1


@pytest.mark.parametrize("changes", [
    {"analytics_payload_valid": False}, {"reset_operation_id": None}, {"app_user_id": None},
])
def test_uncertain_late_reset_boundary_limits_association_not_first_observed_learning(changes):
    late = FIRST + timedelta(days=8)
    report = _report([
        *_trace()[:3],
        _row("progress_reset_confirmed", at=late, **{
            **BASE, "source": "profile", "reset_operation_id": "reset-a",
            "completion_scope": "helper_resolved_best_effort_cleanup", **changes,
        }),
        _learning(at=late + timedelta(minutes=1)),
    ])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d30")["fraction"] is None
    assert _metric(report, frame="d30")["fraction"] == 1


def test_unknown_late_start_clock_still_restricts_root_membership_not_only_the_late_horizon():
    late = FIRST + timedelta(days=8)
    report = _report([
        *_trace()[:3],
        _flow(at=late, started=late, attempt="late-onboarding", onboarding_started_at=None),
    ])
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d7")["fraction"] is None
    assert _cohort(report, "onboarding_attempt")["frames"]["d7"]["common_issues"][
        "root_population_membership_unverified"
    ]


def test_unowned_late_attempt_reusing_known_id_with_another_clock_is_not_a_clean_old_attempt():
    late = FIRST + timedelta(days=8)
    report = _report([
        *_trace()[:3],
        _flow(at=late, started=late, app_user_id=None),
        _learning(at=late + timedelta(minutes=1)),
    ])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d30")["fraction"] is None
    assert _metric(report, "ordered_home", population="onboarding_attempt", frame="d30")["fraction"] == 1


def test_late_uncertain_boundary_after_known_supersession_does_not_restrict_closed_association():
    known = FIRST + timedelta(days=2)
    late = FIRST + timedelta(days=8)
    report = _report([
        *_trace()[:3],
        _row("progress_reset_confirmed", at=known, **BASE, source="profile", reset_operation_id="reset-a"),
        _row("progress_reset_confirmed", at=late, **BASE, source="profile", reset_operation_id=None),
        _learning(at=late + timedelta(minutes=1)),
    ])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d30")["fraction"] == 0
    assert _metric(report, frame="d30")["fraction"] == 1


@pytest.mark.parametrize("terminal", [None, "progress_reset_failed", "progress_reset_confirmed"])
def test_reset_intent_requires_a_confirmed_boundary_not_an_assumed_success_or_noop(terminal):
    late = FIRST + timedelta(days=8)
    rows = [
        *_trace()[:3],
        _row("progress_reset_started", at=late, **BASE, source="profile", reset_operation_id="reset-a"),
        _learning(at=late + timedelta(minutes=2)),
    ]
    if terminal:
        rows.append(_row(terminal, at=late + timedelta(minutes=1), **BASE, source="profile",
                         reset_operation_id="reset-a", error_code="synthetic_failure" if terminal.endswith("failed") else None,
                         completion_scope="helper_resolved_best_effort_cleanup" if terminal.endswith("confirmed") else None))
    report = _report(rows)
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d7")["fraction"] == 0
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt", frame="d30")["fraction"] == (
        0 if terminal == "progress_reset_confirmed" else None
    )
    assert _metric(report, frame="d30")["fraction"] == 1


def test_tied_attempt_origins_restrict_learning_association_not_observed_home():
    report = _report([
        *_trace(),
        _flow(attempt="another-onboarding", start_reason="repeat_incomplete_onboarding_observed"),
    ])
    assert _metric(report, "ordered_home", population="onboarding_attempt",
                   reason="incomplete_onboarding_observed")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt",
                   reason="incomplete_onboarding_observed")["fraction"] is None
    assert _metric(report)["fraction"] == 1


def test_reset_tied_with_unbound_attempt_start_does_not_prove_post_home_association():
    report = _report([
        *_trace(),
        _row("progress_reset_confirmed", at=FIRST, **BASE, reset_operation_id="reset-a",
             source="profile", completion_scope="helper_resolved_best_effort_cleanup"),
    ])
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] is None


def test_reset_tied_with_its_own_bound_attempt_is_not_another_supersession():
    trace = [replace(row, properties={
        **row.properties, "start_reason": "progress_reset", "reset_operation_id": "reset-a",
    }) if row.event.startswith("onboarding_") else row for row in _trace()]
    report = _report([
        *trace,
        _row("progress_reset_confirmed", at=FIRST, **BASE, reset_operation_id="reset-a",
             source="profile", completion_scope="helper_resolved_best_effort_cleanup"),
    ])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 1


def test_delayed_replay_of_origin_reset_does_not_clip_post_home_learning():
    trace = [replace(row, properties={
        **row.properties, "start_reason": "progress_reset", "reset_operation_id": "reset-a",
    }) if row.event.startswith("onboarding_") else row for row in _trace()]
    resets = [_row("progress_reset_confirmed", at=at, **BASE, reset_operation_id="reset-a",
                   source="profile", completion_scope="helper_resolved_best_effort_cleanup")
              for at in (FIRST, HOME + timedelta(minutes=1))]
    report = _report([*trace, *resets])
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 1
    assert report["source_quality_counts"]["duplicate_observation_rows"] == 1


def test_conflicting_origin_binding_is_input_order_independent_and_not_grouped_as_known_reason():
    initial = _flow()
    changed = _flow(at=FIRST + timedelta(seconds=1), start_reason="progress_reset", reset_operation_id="reset-a")
    for rows in ([initial, changed], [changed, initial]):
        cohort = _cohort(_report(rows), "onboarding_attempt")
        assert cohort["start_reason"] is None
        assert cohort["verified_start_candidates"] == 0
        assert cohort["frames"]["activation_24h"]["metrics"]["local_completed"]["fraction"] is None


def test_late_business_replay_is_not_new_first_observed_learning():
    before = _learning(at=FIRST - timedelta(minutes=1), anchor=False)
    replay = _learning(at=HOME + timedelta(minutes=4), anchor=False)
    report = _report([before, _flow(), replay])
    assert _metric(report)["fraction"] == 0
    assert report["source_quality_counts"]["duplicate_observation_rows"] == 1


def test_partial_maturity_uses_only_mature_roots_and_keeps_censored_candidates():
    later = FIRST + timedelta(days=1)
    report = _report([*_trace(), _flow(at=later, started=later, user="install-b", attempt="onboarding-b",
                                     installation_observation_id="observation-install-b",
                                     first_observed_at=later.isoformat())],
                     end=later + timedelta(minutes=1), through=later + timedelta(hours=1))
    frame = _cohort(report)["frames"]["activation_24h"]
    assert frame["mature_units"] == frame["censored_units"] == 1
    assert frame["metrics"]["meaningful"]["fraction"] == 1


@pytest.mark.parametrize("boundaries", [
    {"start": START.replace(tzinfo=None)}, {"end": START}, {"through": START},
])
def test_invalid_windows_fail_explicitly_before_warehouse_reads(tmp_path, boundaries):
    with pytest.raises(ValueError):
        _report([], **boundaries)
    with pytest.raises(ValueError):
        warehouse_onboarding_report(tmp_path, start=boundaries.get("start", START),
                                    end=boundaries.get("end", END), observe_through=boundaries.get("through", THROUGH))


def test_exam_updates_timeouts_and_replays_do_not_create_accepted_activity():
    row = _learning("exam_question_answered", exam_session_id="exam-a", training_session_id=None,
                    answer_action="create", answer_revision_id="revision-a")
    report = _report([_flow(), row, row,
                      _learning("exam_question_answered", exam_session_id="exam-a", training_session_id=None,
                                answer_action="update", answer_revision_id="revision-b"),
                      _learning("exam_question_answered", exam_session_id="exam-a", training_session_id=None,
                                answer_action="create", answer_revision_id="revision-c", timed_out=True)])
    assert _metric(report, "accepted_answer")["fraction"] == 1
    only_edits = _report([_flow(), _learning("exam_question_answered", exam_session_id="exam-a",
                                           answer_action="update", answer_revision_id="revision-b")])
    assert _metric(only_edits, "accepted_answer")["fraction"] == 0


def test_learning_chain_requires_session_identity_and_real_order_not_export_order():
    rows = _trace()
    mismatch = [row for row in rows if row.event != "training_session_completed"] + [
        _learning(training_session_id="different-session"),
    ]
    assert _metric(_report(mismatch), "ordered_learning_chain")["fraction"] == 0
    tied = [*_trace()[:3], *[
        _learning(name, at=HOME + timedelta(minutes=1))
        for name in ("training_session_started", "learning_screen_ready", "training_question_answered",
                     "training_session_completed")
    ]]
    assert _metric(_report(tied), "ordered_learning_chain")["fraction"] is None
    ordered = [*_trace()[:3], *[
        _learning(name, at=HOME + timedelta(minutes=1), app_run_id="run-a", event_sequence=index)
        for index, name in enumerate(("training_session_started", "learning_screen_ready", "training_question_answered",
                                      "training_session_completed"), 1)
    ]]
    assert _metric(_report(list(reversed(ordered))), "ordered_learning_chain")["fraction"] == 1


def test_short_training_and_partial_exam_are_not_meaningful_activation():
    report = _report([_flow(), _learning(accepted_unique_question_count=4),
                      _learning("exam_session_completed", exam_session_id="exam-a", question_total=25,
                                answered_count=1, completion_status="completed")])
    assert _metric(report)["fraction"] == 0


def test_home_same_time_learning_requires_proven_sequence_not_a_guessed_order():
    report = _report([*_trace()[:3], _learning(at=HOME)])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] is None


def test_wrong_home_completion_binding_is_not_repaired_by_time_proximity():
    report = _report([_flow(), _flow("onboarding_flow_completed"),
                      _flow("onboarding_home_arrived", completed=COMPLETE + timedelta(seconds=1))])
    assert _metric(report, "home_observed", population="onboarding_attempt")["fraction"] == 1
    assert _metric(report, "ordered_home", population="onboarding_attempt")["fraction"] is None


def test_learning_before_home_is_not_post_home_activity():
    report = _report([*_trace()[:3], _learning(at=COMPLETE + timedelta(seconds=1))])
    assert _metric(report)["fraction"] == 1
    assert _metric(report, "after_home_meaningful", population="onboarding_attempt")["fraction"] == 0


def test_half_open_maturity_partial_observation_and_nonachievers_are_explicit():
    right = FIRST + timedelta(days=1)
    report = _report([_flow(), _learning(at=right)], through=right)
    assert _metric(report)["fraction"] == 0
    assert _cohort(report)["frames"]["d7"]["censored_units"] == 1
    assert _metric(report, frame="d7")["fraction"] is None


def test_unverified_coverage_keeps_observed_milestones_but_no_fractions():
    report = _report(_trace(), covered=False)
    assert _metric(report)["observed_units"] == 1
    assert _metric(report)["fraction"] is None


def test_late_outcome_defect_does_not_erase_an_earlier_post_activation_anchor():
    report = _report([*_trace(), _learning(at=FIRST + timedelta(days=8), accepted_unique_question_count=True,
                                         training_session_id="later")])
    assert _metric(report, frame="d7")["fraction"] == 1
    assert _metric(report, frame="d30")["fraction"] is None
    assert _metric(report, frame="post_activation_calendar_d1")["fraction"] == 0


def test_post_activation_return_uses_warsaw_calendar_not_rolling_elapsed_day():
    returned_at = FIRST.replace(hour=0, minute=30) + timedelta(days=7)
    report = _report([*_trace(), _learning(at=returned_at, training_session_id="returned")])
    assert _metric(report, frame="post_activation_calendar_d7")["fraction"] == 1
    opened = _report([*_trace(), _row("app_visit_started", at=returned_at, **BASE, app_visit_id="visit-returned")])
    assert _metric(opened, frame="post_activation_calendar_d7")["fraction"] == 0
    assert _metric(opened, "opened", frame="post_activation_calendar_d7")["fraction"] == 1


def _client_days(tmp_path, rows, *, scoped=True):
    warehouse = tmp_path / "warehouse"
    for offset in range(33):
        day = date(2026, 9, 1) + timedelta(days=offset)
        raw = []
        for row in rows:
            if row.timestamp.astimezone(WARSAW).date() == day:
                item = event(row.event, row.timestamp.isoformat(), row.analysis_key or "fallback", **row.properties)
                item["uuid"] = row.event_id
                raw.append(item)
        path = write_dump(tmp_path / f"{day}.json", day=day.isoformat(), exported_at=(THROUGH + timedelta(days=2)).isoformat(),
                          events=raw)
        if scoped:
            payload = json.loads(path.read_text())
            payload["coverage"]["application_ids"] = [APP]
            path.write_text(json.dumps(payload))
        ingest_dump(path, warehouse)
    return warehouse


def test_cli_context_health_and_serialization_retain_source_and_maturity_gates(tmp_path, capsys):
    warehouse = _client_days(tmp_path, _trace())
    main(["onboarding", "--start", "2026-09-01", "--end", "2026-09-02",
          "--observe-through", THROUGH.isoformat(), "--warehouse", str(warehouse)])
    report = json.loads(capsys.readouterr().out)
    assert _metric(report)["fraction"] == 1
    context = build_context(warehouse, range_window("onboarding", date(2026, 9, 1), date(2026, 9, 2)))
    assert _cohort(context.onboarding)["frames"]["activation_24h"]["censored_units"] == 1
    assert context.model_validate_json(context.model_dump_json()).onboarding == context.onboarding
    health = build_health([], window_start=START, window_end=END, onboarding=report)
    assert health.onboarding == report
    assert build_health([], window_start=START, window_end=END).onboarding["status"] == "history_not_supplied"


def test_warehouse_without_explicit_app_coverage_does_not_establish_zero_or_a_rate(tmp_path):
    warehouse = _client_days(tmp_path, _trace(), scoped=False)
    report = warehouse_onboarding_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _metric(report)["observed_units"] == 1
    assert _metric(report)["fraction"] is None


@pytest.mark.parametrize("coverage", [True, "malformed", [APP], {"application_ids": [APP]}])
def test_malformed_coverage_restricts_onboarding_without_crashing(tmp_path, coverage):
    warehouse = _client_days(tmp_path, _trace())
    path = warehouse / "events" / "day=2026-09-01" / "partition.json"
    metadata = json.loads(path.read_text())
    metadata["coverage"] = coverage
    path.write_text(json.dumps(metadata))
    report = warehouse_onboarding_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _metric(report)["observed_units"] == 1
    assert _metric(report)["fraction"] is None
