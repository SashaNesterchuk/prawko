import json
from datetime import date, datetime

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import build_context, day_window
from prawko_analytics.external_entries import external_entry_report
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump
from tests.test_content_observations import prepared, QUESTION


START = datetime.fromisoformat("2026-10-07T00:00:00+00:00")
END = datetime.fromisoformat("2026-10-08T00:00:00+00:00")


def source(name="app_entry_resolved", timestamp="2026-10-07T10:00:00Z", install="usr_i", **changes):
    return event(name, timestamp, install, **{
        "entry_observation_version": 1, "entry_observation_id": "entry-1",
        "entry_kind": "notification", "entry_reason": "notification", "entry_signal_origin": "live_os_response",
        "entry_signal_received_at": "2026-10-07T10:00:00Z", "entry_observed_at": "2026-10-07T10:00:00Z",
        "entry_observation_time_basis": "client_signal_processing_not_tap", "entry_scope_status": "bound_visit",
        "entry_bound_app_visit_id": "visit-1", "app_visit_id": "visit-1", "app_visibility": "active",
        "entry_destination_horizon_seconds": 60, "entry_association_horizon_seconds": 3600,
        "notification_response_revision": QUESTION, "cached_response": False,
        "entry_target_route_pattern": None, "entry_target_screen_name": None,
        "entry_target_entity_revision": None, "entry_target_entity_required": False,
        "entry_target_basis": "notification_target_unspecified", **changes,
    })


def destination(timestamp="2026-10-07T10:00:01Z", **changes):
    return source("external_entry_destination_observed", timestamp, **{
        "entry_destination_route_pattern": "/learn", "entry_destination_screen_name": "learn",
        "entry_destination_entity_revision": None, "entry_destination_phase": "usable",
        "entry_destination_match": "target_unspecified", "entry_destination_basis": "preexisting_route_snapshot",
        "entry_elapsed_ms": 1000, **changes,
    })


def learn(**changes):
    return [
        source("training_session_started", "2026-10-07T10:01:00Z", training_session_id="training-1", **changes),
        source("training_question_answered", "2026-10-07T10:02:00Z", training_session_id="training-1",
               answer_id="answer-1", question_id="q-1", is_correct=True, **changes),
        source("training_session_completed", "2026-10-07T10:03:00Z", training_session_id="training-1",
               learning_outcome_rule_version="learning-v1", accepted_unique_question_count=5, **changes),
    ]

def close(**changes):
    return source("external_entry_ended", "2026-10-07T10:05:00Z", entry_end_reason="visit_background", **changes)


def report(*raws, end=END, complete=True):
    return external_entry_report([prepared(raw) for raw in raws], start=START, end=end, coverage_complete=complete)


def test_scoped_source_dedupe_and_meaningful_learning_after_new_answer():
    root = source()
    result = report(root, root, source("notification_opened"), destination(), destination(), *learn(), close())
    assert result["source_units"] == result["bound_units"] == 1
    assert result["quality"]["duplicate_source_observations"] == 2
    assert result["quality"]["duplicate_destination_observations"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] == 1
    assert result["destinations"][0]["basis"] == "preexisting_route_snapshot"
    assert result["quality_issue_count"] == 0
    assert "causal_reminder_lift" in result["must_not_be_interpreted_as"]


@pytest.mark.parametrize("change", [
    {"app_visit_id": "other-visit"}, {"app_visibility": "background"},
    {"entry_observation_id": "other-entry"}, {"app_user_id": "other-install"},
    {"entry_bound_app_visit_id": "other-visit"}, {"training_session_id": "other-session"},
])
def test_learning_cannot_join_by_account_person_time_or_different_visit(change):
    starts, answer, done = learn()
    done["properties"].update(change)
    done["properties"]["supabase_user_id"] = "same-account"
    result = report(source(supabase_user_id="same-account"), starts, answer, done)
    assert result["notification_learning"]["mature_achieved_units"] == 0
    assert result["notification_learning"]["mature_learning_fraction"] in (0, None)


def test_old_results_replayed_answers_exam_edits_and_missing_starts_are_not_new_learning():
    begin, answer, done = learn()
    old = {**answer, "timestamp": "2026-10-07T09:59:00Z"}
    old["properties"] = {key: value for key, value in old["properties"].items() if not key.startswith("entry_")}
    assert report(source(), begin, old, answer, done)["notification_learning"]["mature_achieved_units"] == 0
    assert report(source(), answer, done)["notification_learning"]["mature_achieved_units"] == 0
    old_done = {**done, "timestamp": "2026-10-07T09:59:00Z"}
    old_done["properties"] = {key: value for key, value in old_done["properties"].items() if not key.startswith("entry_")}
    assert report(source(), begin, answer, old_done, done)["notification_learning"]["mature_achieved_units"] == 0
    exam = [
        source("exam_session_resumed", "2026-10-07T10:01:00Z", exam_session_id="exam-1"),
        source("exam_question_answered", "2026-10-07T10:02:00Z", exam_session_id="exam-1",
               question_id="q-1", answer_id="a-1", answer_revision_id="revision-1", is_correct=True, answer_action="update"),
        source("exam_session_completed", "2026-10-07T10:03:00Z", exam_session_id="exam-1",
               learning_outcome_rule_version="learning-v1", completion_status="completed", answered_count=32, question_total=32),
    ]
    assert report(source(), *exam)["notification_learning"]["mature_achieved_units"] == 0
    exam[1]["properties"]["answer_action"] = "create"
    assert report(source(), *exam, close())["notification_learning"]["mature_achieved_units"] == 1


def test_awaiting_foreground_can_bind_but_cached_or_queued_unattributed_sources_cannot():
    waiting = source(entry_scope_status="awaiting_foreground", entry_bound_app_visit_id=None, app_visit_id=None)
    result = report(waiting, destination(), *learn(), close())
    assert result["bound_units"] == 1
    assert result["notification_learning"]["mature_achieved_units"] == 1
    for scope in ("cached_unattributed", "processing_visit_changed", "signal_horizon_elapsed"):
        cached = scope == "cached_unattributed"
        root = source(entry_scope_status=scope, entry_bound_app_visit_id=None,
                      cached_response=cached, entry_signal_origin="cached_os_response" if cached else "live_os_response")
        result = report(root)
        assert result["bound_units"] == 0
        assert result["notification_learning"]["mature_learning_fraction"] is None


def test_nonachievers_remain_denominator_and_observer_unmount_is_censoring():
    root = source()
    result = report(root, end=datetime.fromisoformat("2026-10-07T10:10:00+00:00"))
    assert result["notification_learning"]["censored_units"] == 1
    assert result["notification_learning"]["mature_units"] == 0
    unmount = source("external_entry_ended", "2026-10-07T10:05:00Z", entry_end_reason="observer_unmount")
    assert report(root, unmount, end=datetime.fromisoformat("2026-10-07T10:10:00+00:00"))["notification_learning"]["censored_units"] == 1
    background = source("external_entry_ended", "2026-10-07T10:05:00Z", entry_end_reason="visit_background")
    result = report(root, background, end=datetime.fromisoformat("2026-10-07T10:10:00+00:00"))
    assert result["notification_learning"]["mature_units"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] == 0


def test_half_open_horizons_and_equal_timestamps_need_real_run_sequence():
    root = source()
    late = destination("2026-10-07T10:01:00Z")
    assert not report(root, late)["destinations"]
    begin, answer, done = learn()
    done["timestamp"] = "2026-10-07T11:00:00Z"
    assert report(root, begin, answer, done)["notification_learning"]["mature_achieved_units"] == 0
    tied = destination("2026-10-07T10:00:00Z", runtime_id="fake-run", event_sequence=2)
    root["properties"].update(runtime_id="fake-run", event_sequence=1)
    assert not report(root, tied)["destinations"]
    root["properties"]["app_run_id"] = tied["properties"]["app_run_id"] = "real-run"
    assert len(report(tied, root)["destinations"]) == 1


@pytest.mark.parametrize("changes", [
    {"entry_observation_version": True}, {"entry_kind": ["notification"]},
    {"entry_observation_id": "learner@example.com"}, {"entry_target_route_pattern": "https://private.example"},
    {"entry_signal_received_at": "2026-10-07T10:00:00"}, {"entry_observed_at": "2026-10-07T11:00:00Z"},
    {"entry_association_horizon_seconds": True}, {"notification_response_revision": "private response"},
    {"entry_scope_status": "bound_visit", "entry_bound_app_visit_id": None},
    {"analytics_payload_valid": False}, {"_warehouse_import_conflict": True},
])
def test_invalid_entry_shapes_are_quarantined_and_cannot_leak_rejected_values(changes):
    result = report(source(**changes))
    assert result["source_units"] == 0
    assert result["quality"]["invalid_entry_observations"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None
    assert "learner@example.com" not in json.dumps(result)
    assert "private.example" not in json.dumps(result)
    assert "private response" not in json.dumps(result)


def test_huge_elapsed_value_is_quarantined_without_breaking_destination_report():
    result = report(source(), destination(entry_elapsed_ms=10 ** 400))
    assert result["quality"]["invalid_entry_observations"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None


def test_conflicting_binding_or_source_body_and_orphans_prohibit_fraction():
    root = source()
    bad = source("notification_opened", entry_bound_app_visit_id="other-visit", app_visit_id="other-visit")
    assert report(root, bad)["quarantined_units"] == 1
    changed = source("notification_opened", notification_response_revision="content-v1:2222222222222222")
    assert report(root, changed)["quarantined_units"] == 1
    result = report(destination())
    assert result["quality"]["orphan_entry_observations"] == 1
    result = report(root, *learn(), close(), complete=False)
    assert result["notification_learning"]["mature_achieved_units"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None


def test_destination_match_is_checked_not_trusted_and_raw_properties_do_not_escape():
    result = report(source(), destination(entry_destination_match="static_route", raw_url="private"))
    assert result["quality"]["invalid_destination_observations"] == 1
    assert not result["destinations"]
    assert "private" not in json.dumps(result)

def test_group_aliases_late_foreground_binding_and_duplicate_business_scopes_remain_explicit():
    link = source(
        entry_kind="deep_link", entry_reason="deep_link", entry_signal_origin="live_url",
        entry_target_basis="normalized_static_route", entry_target_route_pattern="/learn",
        entry_target_screen_name="learn", notification_response_revision=None,
    )
    landing = destination(
        entry_kind="deep_link", entry_reason="deep_link", entry_signal_origin="live_url",
        entry_target_basis="normalized_static_route", entry_target_route_pattern="/learn",
        entry_target_screen_name="learn", notification_response_revision=None,
        entry_destination_route_pattern="/(tabs)/learn", entry_destination_match="static_route",
    )
    assert report(link, landing)["destinations"][0]["match"] == "static_route"
    waiting = source(entry_scope_status="awaiting_foreground", entry_bound_app_visit_id=None, app_visit_id=None)
    result = report(waiting, *learn())
    assert result["bound_units"] == 0
    assert result["quality"]["late_foreground_binding_units"] == 1
    duplicate = source("notification_opened", entry_observation_id="another-entry")
    result = report(source(), duplicate)
    assert result["quality"]["duplicate_notification_business_scopes"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None


def test_malformed_terminal_and_conflicting_answer_cannot_unlock_learning_fraction():
    terminal = source("external_entry_ended", entry_end_reason=["visit_background"])
    result = report(source(), terminal, *learn())
    assert result["quality"]["invalid_entry_observations"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None
    begin, answer, done = learn()
    conflict = {**answer, "properties": {**answer["properties"], "is_correct": False}}
    result = report(source(), begin, answer, conflict, done)
    assert result["quality"]["conflicting_learning_units"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None

def test_completion_before_same_timestamp_background_requires_proven_sequence():
    begin, answer, done = learn()
    close = source("external_entry_ended", "2026-10-07T10:03:00Z", entry_end_reason="visit_background")
    assert report(source(), begin, answer, done, close)["notification_learning"]["mature_achieved_units"] == 0
    done["properties"].update(app_run_id="run-1", event_sequence=10)
    close["properties"].update(app_run_id="run-1", event_sequence=11)
    assert report(close, done, answer, begin, source())["notification_learning"]["mature_achieved_units"] == 1


def test_context_health_and_cli_include_identical_entry_report_and_quality_gate(tmp_path):
    raws = [source(), destination(), *learn(), close()]
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "dump.json", day="2026-10-07",
                           exported_at="2026-10-08T08:00:00Z", events=raws), warehouse)
    window = day_window(date(2026, 10, 7))
    context = build_context(warehouse, window)
    health = build_health([prepared(raw) for raw in raws], window_start=window.start,
                          window_end=window.end, coverage_complete=True)
    assert context.external_entries == health.external_entries
    output = tmp_path / "context.json"
    main(["context", "--warehouse", str(warehouse), "--day", "2026-10-07", "--out", str(output)])
    assert json.loads(output.read_text())["external_entries"]["notification_learning"]["mature_achieved_units"] == 1


def test_missing_visit_tail_is_censored_even_after_calendar_horizon_but_early_learning_remains_visible():
    result = report(source(), *learn())
    learning = result["notification_learning"]
    assert learning["censor_reasons"] == {"unknown_visit_tail": 1}
    assert learning["observed_achieved_units"] == 1
    assert learning["mature_achieved_units"] == 0
    assert learning["mature_learning_fraction"] is None
    unmount = source("external_entry_ended", "2026-10-07T10:04:00Z", entry_end_reason="observer_unmount")
    assert report(source(), *learn(), unmount)["notification_learning"]["censor_reasons"] == {"observer_unmount": 1}
    checkpoint = event("app_visit_checkpoint", "2026-10-07T11:00:00Z", "usr_i", app_visit_id="visit-1")
    assert report(source(), checkpoint)["notification_learning"]["mature_learning_fraction"] == 0


def test_observation_end_does_not_allow_later_destinations_or_learning():
    unmount = source("external_entry_ended", "2026-10-07T10:00:00.500Z", entry_end_reason="observer_unmount")
    result = report(source(), unmount, destination(), *learn())
    assert not result["destinations"]
    assert result["notification_learning"]["observed_achieved_units"] == 0


def test_integrity_issue_reaches_context_qa_and_prohibits_fraction(tmp_path):
    raws = [source(), destination(entry_destination_match="static_route"), *learn(), close()]
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "dump.json", day="2026-10-07",
                           exported_at="2026-10-08T08:00:00Z", events=raws), warehouse)
    context = build_context(warehouse, day_window(date(2026, 10, 7)))
    assert "external_entry_observations_limited" in {item.id for item in context.qa}
    assert context.external_entries["notification_learning"]["mature_learning_fraction"] is None


@pytest.mark.parametrize("count", [True, "5", -1, 5.5])
def test_invalid_declared_learning_count_is_not_a_clean_nonachievement(count):
    begin, answer, done = learn()
    done["properties"]["accepted_unique_question_count"] = count
    result = report(source(), begin, answer, done, close())
    assert result["quality"]["invalid_learning_observations"] == 1
    assert result["notification_learning"]["mature_learning_fraction"] is None
