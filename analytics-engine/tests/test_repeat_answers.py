from datetime import date, datetime, timedelta, timezone

import pytest

from prawko_analytics.context import build_context, range_window
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.repeat_answers import repeat_answer_report
from tests.support import write_dump
from tests.test_content_observations import (
    OTHER, content_event, display_event, prepared, rule_event,
)


START = datetime(2026, 10, 3, tzinfo=timezone.utc)
END = START + timedelta(days=10)


def repeat(timestamp="2026-10-04T10:00:00Z", **changes):
    return content_event(timestamp=timestamp, **{
        "training_session_id": "training-2", "answer_id": "answer-2", "is_correct": True,
        "mode": "wrong_answers", "first_encounter": False, "previous_times_seen": 1, **changes,
    })


def report(*raws, end=END, complete=True):
    return repeat_answer_report([prepared(raw) for raw in raws], start=START, end=end, coverage_complete=complete)


def exam_answer(timestamp, *, session="exam-1", answer="exam-1:1", rev="submission-1", **changes):
    rules = rule_event(timestamp)["properties"]
    return content_event("exam_question_answered", timestamp, **{
        **rules, "exam_session_id": session, "answer_id": answer, "answer_revision_id": rev,
        "answer_action": "create", "is_correct": False, "mode": "exam", **changes,
    })


def review(timestamp="2026-10-03T10:01:00Z", **changes):
    raw = display_event(timestamp, **{
        "review_id": "review-1", "view_state": "question", "was_answered": True, "is_correct": False, **changes,
    })
    raw["event"] = "training_answers_review_question_viewed"
    return raw


def test_ordered_repeat_has_explicit_revision_selection_and_noncausal_joint_outcomes():
    result = report(
        content_event(mode="learning", first_encounter=True, previous_times_seen=0),
        display_event(), repeat(),
    )
    assert result["root_units"] == result["comparable_pairs"] == result["unique_repeat_answers"] == 1
    assert result["mature_comparable_pairs"] == 1
    assert result["mature_repeat_correct_fraction"] == 1
    group = result["groups"][0]
    assert group["transitions"] == {"wrong_to_correct": 1}
    assert group["baseline_selection"]["first_encounter"] is True
    assert group["repeat_selection"]["mode"] == "wrong_answers"
    assert group["exposure_kind"] == "explanation_text_visible"
    assert any("not causal" in clause for clause in result["limitations"])


def test_duplicate_answers_and_repeated_exposure_views_add_no_comparison_units():
    result = report(
        content_event(), content_event(timestamp="2026-10-03T10:00:01Z"),
        display_event(), display_event("2026-10-03T10:02:00Z"), review("2026-10-03T10:03:00Z"),
        repeat(), repeat(timestamp="2026-10-04T10:00:01Z"),
    )
    assert result["root_units"] == result["comparable_pairs"] == 1
    assert result["quality"]["duplicate_answer_observations"] == 2
    assert result["groups"][0]["additional_exposure_observations"] == 2


def test_identical_exposure_duplicates_do_not_create_a_false_timestamp_order_conflict():
    first = display_event()
    result = report(content_event(), first, first, repeat())
    assert result["root_units"] == 1
    assert result["quality"]["duplicate_exposure_observations"] == 1
    assert result["groups"][0]["additional_exposure_observations"] == 0


def test_nonreturners_are_retained_and_immature_exposures_are_censored_even_with_a_known_pair():
    nonreturner = report(content_event(), display_event())
    assert nonreturner["outcomes"] == {"no_repeat_observed": 1}
    assert nonreturner["mature_repeat_correct_fraction"] is None
    censored = report(content_event(), display_event(), end=START + timedelta(days=1))
    assert censored["outcomes"] == {"censored": 1}
    assert censored["censored_units"] == 1
    early_pair = report(content_event(), display_event(), repeat(), end=START + timedelta(days=2))
    assert early_pair["comparable_pairs"] == 1
    assert early_pair["mature_comparable_pairs"] == 0
    assert early_pair["mature_repeat_correct_fraction"] is None


def test_answer_outside_the_seven_day_horizon_or_report_end_is_not_a_repeat():
    result = report(content_event(), display_event(), repeat(timestamp="2026-10-11T10:00:00Z"))
    assert result["outcomes"] == {"no_repeat_observed": 1}
    result = report(content_event(), display_event(), repeat(), end=START + timedelta(days=1))
    assert result["outcomes"] == {"censored": 1}


def test_seven_day_followup_horizon_is_half_open():
    result = report(content_event(), display_event(), repeat(timestamp="2026-10-10T10:01:00Z"))
    assert result["outcomes"] == {"no_repeat_observed": 1}
    just_before = report(content_event(), display_event(), repeat(timestamp="2026-10-10T10:00:59Z"))
    assert just_before["comparable_pairs"] == 1
    assert just_before["confidence_ceiling"] == "low"


@pytest.mark.parametrize("changes,status", [
    ({"question_revision": OTHER}, "question_revision_changed"),
    ({"content_requested_locale": "en"}, "content_language_or_choices_changed"),
    ({"content_source_language": "en"}, "content_language_or_choices_changed"),
    ({"choice_source_languages": "cs"}, "content_language_or_choices_changed"),
    ({"choice_unknown_source_count": 1}, "unknown_content_metadata"),
    ({"analytics_payload_valid": False}, "invalid_followup"),
])
def test_next_answer_revision_language_and_integrity_boundaries_are_not_skipped(changes, status):
    result = report(content_event(), display_event(), repeat(**changes), repeat(
        timestamp="2026-10-05T10:00:00Z", training_session_id="training-3", answer_id="answer-3",
    ))
    assert result["outcomes"] == {status: 1}
    assert result["comparable_pairs"] == 0


def test_installations_are_never_joined_by_account_or_question():
    result = report(content_event(supabase_user_id="same-account"), display_event(),
                    repeat(app_user_id="usr_other", supabase_user_id="same-account"))
    assert result["outcomes"] == {"no_repeat_observed": 1}


@pytest.mark.parametrize("event_changes", [
    {"explanation_display_variant": "locked", "explanation_rendered_state": "locked",
     "explanation_display_revision": None, "explanation_display_matches_selected_field": None},
    {"explanation_rendered_state": "empty", "explanation_display_revision": None,
     "explanation_display_matches_selected_field": False},
])
def test_locked_or_empty_explanations_are_not_text_exposure(event_changes):
    result = report(content_event(), display_event(**event_changes), repeat())
    assert result["root_units"] == 0
    assert result["quality"]["non_text_explanation_observations"] == 1


def test_locked_answer_review_is_question_exposure_not_explanation_reading():
    result = report(content_event(), review(
        explanation_display_variant="locked", explanation_rendered_state="locked",
        explanation_display_revision=None, explanation_display_matches_selected_field=None,
    ), repeat())
    assert result["groups"][0]["exposure_kind"] == "answer_review_question_visible"
    assert result["groups"][0]["explanation_rendered_state"] == "locked"
    assert result["comparable_pairs"] == 1


def test_exposure_does_not_backfill_baseline_from_review_correctness_or_other_session():
    missing = report(review(), repeat())
    assert missing["root_units"] == 0
    assert missing["quality"]["baseline_unavailable_observations"] == 1
    assert missing["rate_status"] == "prohibited_coverage_or_integrity"
    intervening = report(content_event(), repeat(timestamp="2026-10-03T10:00:30Z"), review())
    assert intervening["root_units"] == 0
    assert intervening["quality"]["invalid_or_intervening_baseline_observations"] == 1


def test_missing_or_wrong_question_review_is_not_an_accepted_answer_review():
    result = report(content_event(), review(view_state="missing_question"), review(
        timestamp="2026-10-03T10:02:00Z", was_answered=False,
    ), repeat())
    assert result["root_units"] == 0
    assert result["quality"]["non_answer_review_observations"] == 2


def test_conflicting_business_answer_outcomes_are_not_last_write_wins():
    result = report(content_event(), display_event(), repeat(), repeat(
        timestamp="2026-10-04T10:01:00Z", is_correct=False,
    ))
    assert result["quality"]["conflicting_answer_units"] == 1
    assert result["outcomes"] == {"invalid_followup": 1}
    assert result["mature_repeat_correct_fraction"] is None


def test_same_timestamp_requires_shared_runtime_sequence_not_input_order():
    timestamp = "2026-10-03T10:00:00Z"
    before = content_event(timestamp=timestamp)
    exposure = display_event(timestamp)
    assert report(before, exposure, repeat())["root_units"] == 0
    assert report(exposure, before, repeat())["quality"]["ambiguous_order_observations"] == 1
    before = content_event(timestamp=timestamp, app_run_id="runtime-1", event_sequence=1)
    exposure = display_event(timestamp, app_run_id="runtime-1", event_sequence=2)
    assert report(exposure, repeat(), before)["comparable_pairs"] == 1
    exposure["properties"]["app_run_id"] = "runtime-other"
    assert report(before, exposure, repeat())["root_units"] == 0


def test_two_unordered_first_followups_are_not_resolved_using_list_order():
    first = repeat()
    other = repeat(answer_id="answer-other", training_session_id="other-session", is_correct=False)
    forward = report(content_event(), display_event(), first, other)
    backward = report(content_event(), display_event(), other, first)
    assert forward == backward
    assert forward["outcomes"] == {"ambiguous_followup_order": 1}
    assert forward["mature_repeat_correct_fraction"] is None


def test_unknown_rendered_source_and_incomplete_coverage_prohibit_fractions_not_raw_counts():
    result = report(content_event(), display_event(explanation_display_matches_selected_field=False), repeat())
    assert result["outcomes"] == {"unknown_rendered_source": 1}
    result = report(content_event(), display_event(), repeat(), complete=False)
    assert result["comparable_pairs"] == 1
    assert result["mature_repeat_correct_fraction"] is None
    assert result["rate_status"] == "prohibited_coverage_or_integrity"


def test_exam_slot_updates_are_not_repeat_questions_and_review_uses_latest_accepted_revision():
    first = exam_answer("2026-10-03T10:00:00Z")
    update = exam_answer("2026-10-03T10:01:00Z", rev="submission-2", answer_action="update", is_correct=True)
    exposure = review("2026-10-03T10:02:00Z", exam_session_id="exam-1", is_correct=True)
    exposure["event"] = "exam_answers_review_question_viewed"
    same_slot = exam_answer("2026-10-03T10:03:00Z", rev="submission-3", answer_action="update", is_correct=False)
    assert report(first, update, exposure, same_slot)["comparable_pairs"] == 0
    second_exam = exam_answer("2026-10-04T10:00:00Z", session="exam-2", answer="exam-2:1",
                              rev="submission-4", is_correct=True)
    result = report(first, update, exposure, same_slot, second_exam)
    assert result["comparable_pairs"] == 1
    assert result["groups"][0]["transitions"] == {"correct_to_correct": 1}


def test_exam_origin_rules_changed_or_unrecorded_are_a_control_boundary_not_current_config():
    first = exam_answer("2026-10-03T10:00:00Z")
    exposure = review(exam_session_id="exam-1")
    exposure["event"] = "exam_answers_review_question_viewed"
    changed = exam_answer("2026-10-04T10:00:00Z", session="exam-2", answer="exam-2:1",
                          rev="submission-2", exam_origin_profile_revision=OTHER)
    result = report(first, exposure, changed)
    assert result["outcomes"] == {"exam_rules_changed_or_unknown": 1}
    unknown = exam_answer("2026-10-04T10:00:00Z", session="exam-2", answer="exam-2:1",
                          rev="submission-2", exam_origin_profile_revision=None, exam_origin_profile_basis="not_recorded")
    assert report(first, exposure, unknown)["outcomes"] == {"exam_rules_changed_or_unknown": 1}


def test_update_of_an_old_other_exam_slot_is_not_a_new_repeat_after_training_exposure():
    old = exam_answer("2026-10-03T09:00:00Z")
    edit = exam_answer("2026-10-04T09:00:00Z", rev="submission-2", answer_action="update", is_correct=True)
    result = report(old, content_event(), display_event(), edit, repeat())
    assert result["groups"][0]["repeat_selection"]["mode"] == "wrong_answers"
    assert result["comparable_pairs"] == 1
    result = report(content_event(), display_event(), edit)
    assert result["outcomes"] == {"repeat_creation_unobserved": 1}
    assert result["mature_repeat_correct_fraction"] is None


def test_cross_runtime_duplicate_answer_order_is_quarantined_not_input_order_selected():
    first = content_event(app_run_id="runtime-1", event_sequence=1)
    duplicate = content_event(app_run_id="runtime-2", event_sequence=1)
    forward = report(first, duplicate, display_event(), repeat())
    backward = report(duplicate, first, display_event(), repeat())
    assert forward == backward
    assert forward["quality"]["conflicting_answer_units"] == 1


def test_reused_exam_submission_id_quarantines_both_logical_slots():
    first = exam_answer("2026-10-03T10:00:00Z")
    second = exam_answer("2026-10-04T10:00:00Z", session="exam-2", answer="exam-2:1")
    result = report(first, review(), second)
    assert result["quality"]["conflicting_answer_units"] == 2
    assert result["mature_repeat_correct_fraction"] is None


def test_exam_create_and_update_have_separate_overlay_meanings_without_rewriting_legacy():
    first = exam_answer("2026-10-03T10:00:00Z")
    edit = exam_answer("2026-10-03T10:01:00Z", rev="submission-2", answer_action="update")
    legacy = content_event("exam_question_answered")
    assert prepared(first).interpretation_id == "exam_answer_created_v3"
    assert prepared(edit).interpretation_id == "exam_answer_updated_v3"
    assert prepared(legacy).interpretation_id == "exam_answer"


def test_selection_fields_cannot_export_contact_or_arbitrary_mode_text():
    result = report(content_event(mode="learner@example.com", previous_times_seen="private text"),
                    display_event(), repeat())
    assert result["groups"][0]["baseline_selection"]["mode"] is None
    assert "learner@example.com" not in str(result)
    assert "private text" not in str(result)
    assert result["mature_repeat_correct_fraction"] is None


def test_contradictory_first_encounter_history_retains_counts_but_prohibits_fraction():
    result = report(content_event(first_encounter=True, previous_times_seen=3), display_event(), repeat())
    assert result["comparable_pairs"] == 1
    assert result["quality"]["invalid_selection_observations"] == 1
    assert result["mature_repeat_correct_fraction"] is None


def test_context_and_health_expose_repeat_analysis_with_identical_window_scope(tmp_path):
    raws = [content_event(), display_event(), repeat()]
    warehouse = tmp_path / "warehouse"
    for day in ("2026-10-03", "2026-10-04"):
        daily = [raw for raw in raws if raw["timestamp"].startswith(day)]
        ingest_dump(write_dump(tmp_path / f"{day}.json", day=day, exported_at="2026-10-05T08:00:00Z",
                               events=daily), warehouse)
    window = range_window("test", date(2026, 10, 3), date(2026, 10, 5))
    context = build_context(warehouse, window)
    health = build_health([prepared(raw) for raw in raws], window_start=window.start,
                          window_end=window.end, coverage_complete=True)
    assert context.repeat_answers == health.repeat_answers
    assert context.repeat_answers["comparable_pairs"] == 1
    assert context.repeat_answers["censored_units"] == 1
