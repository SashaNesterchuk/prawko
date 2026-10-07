from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from prawko_analytics.context import PreparedRow
from prawko_analytics.health import build_health, describe_drills, presentation, reconstruct_attempts

UTC = ZoneInfo("UTC")
WARSAW = ZoneInfo("Europe/Warsaw")
START = datetime(2026, 9, 12, 10, 0, tzinfo=UTC)
WINDOW_START = datetime(2026, 9, 12, 0, 0, tzinfo=WARSAW)
WINDOW_END = datetime(2026, 9, 20, 0, 0, tzinfo=WARSAW)


def _row(event: str, user: str, minutes: int, **props) -> PreparedRow:
    properties = {"app_user_id": user}
    properties.update(props)
    return PreparedRow(
        event_id=f"{event}-{user}-{minutes}",
        event=event,
        timestamp=START + timedelta(minutes=minutes),
        dump_id="test",
        properties=properties,
        analysis_key=user,
        key_source="primary",
        app_version="1.0.23",
        schema=None,
        interpretation_id=None,
        match_status="no_contract",
        distinct_id=f"d-{user}",
    )


def _install(user: str, minutes: int = -30) -> PreparedRow:
    return PreparedRow(
        event_id=f"install-{user}",
        event="Application Installed",
        timestamp=START + timedelta(minutes=minutes),
        dump_id="test",
        properties={},
        analysis_key=f"d-{user}",
        key_source="fallback",
        app_version=None,
        schema=None,
        interpretation_id=None,
        match_status="no_contract",
        distinct_id=f"d-{user}",
    )


def _health(rows):
    return build_health(rows, window_start=WINDOW_START, window_end=WINDOW_END, coverage_complete=True)


def _metric(health, metric_id):
    return next(item for item in health.metrics if item.id == metric_id)


def test_install_links_through_distinct_id_and_revenue_stays_unknown():
    rows = [
        _install("a"),
        _row("screen_viewed", "a", 0, screen_name="home"),
        _row("training_question_answered", "a", 5),
        _row("paywall_viewed", "a", 9),
    ]
    health = _health(rows)
    activation = next(item for item in health.funnels if item.id == "activation")
    assert [step.users for step in activation.steps] == [1, 1, 1]
    assert health.monetization["revenuecat"] == "not_loaded"
    assert health.monetization["purchase_events"] == 0
    assert health.monetization["paywall_users"] == 1
    assert _metric(health, "paywall_purchase").reliable is False
    assert _metric(health, "revenuecat_revenue").tone == "unknown"


def test_majority_activation_is_good_when_the_sample_is_large_enough():
    rows = []
    for index in range(30):
        user = f"u{index}"
        rows.append(_install(user))
        rows.append(_row("screen_viewed", user, 1, screen_name="home"))
        rows.append(_row("training_question_answered", user, 2))
        rows.append(_row("training_session_completed", user, 3))
    health = _health(rows)
    assert _metric(health, "question_after_install").tone == "good"
    assert _metric(health, "question_after_install").numerator == 30
    assert all(drop.funnel_id != "activation" for drop in health.drops)


def test_largest_drop_is_the_step_that_loses_at_least_ten_people():
    rows = []
    for index in range(40):
        user = f"u{index}"
        rows.append(_install(user))
        rows.append(_row("screen_viewed", user, 1, screen_name="home"))
        if index < 10:
            rows.append(_row("training_question_answered", user, 2))
    health = _health(rows)
    assert health.drops[0].label == "Opened Home → Answered a question"
    assert health.drops[0].lost_users == 30
    assert _metric(health, "largest_drop").tone == "loss"


def test_next_day_return_uses_the_install_calendar_day():
    rows = [
        _install("a", minutes=0),
        _row("screen_viewed", "a", 0, screen_name="home"),
        _row("screen_viewed", "a", 24 * 60, screen_name="home"),
        _install("b", minutes=0),
        _row("screen_viewed", "b", 0, screen_name="home"),
    ]
    health = _health(rows)
    metric = _metric(health, "d1_return")
    assert metric.numerator == 1
    assert metric.denominator == 2
    assert metric.reliable is False


def test_training_then_exam_is_a_transition_not_a_leak():
    rows = []
    for index in range(40):
        user = f"u{index}"
        rows.append(_row("training_session_completed", user, 1))
        if index < 20:
            rows.append(_row("exam_session_started", user, 30))
    health = _health(rows)
    _strong, drops, _unscored = presentation(health)
    assert all(drop.funnel_id != "exam" for drop in drops)
    assert health.transitions[0].from_users == 40
    assert health.transitions[0].to_users == 20
    assert "Not a loss" in health.transitions[0].note


def test_a_later_completion_does_not_erase_an_earlier_abandoned_attempt():
    rows = [
        _row("exam_session_started", "a", 0),
        _row("exam_session_ended", "a", 1, end_reason="miss_click_empty_exit", answered_count=0),
        _row("exam_session_started", "a", 10),
        _row("exam_question_answered", "a", 12, question_index=1, question_total=20),
        _row("exam_session_completed", "a", 20, passed=False),
    ]
    drills = describe_drills(rows)
    exam = next(item for item in drills if item["id"] == "exam_unfinished")
    assert exam["people"] == 0
    assert "2 starts, 1 completed" in exam["note"]
    assert "reconstructed exam attempts" in exam["cohort"]
    nxt = next(group for group in exam["groups"] if group["title"] == "What happened next")
    assert sum(row["count"] for row in nxt["rows"]) == 1
    assert {row["label"]: row["count"] for row in nxt["rows"]}["New exam, within 15 minutes"] == 1


def test_a_majority_that_is_also_a_drop_is_only_listed_as_leakage():
    rows = []
    for index in range(40):
        user = f"u{index}"
        rows.append(_row("training_question_answered", user, 1))
        if index < 30:
            rows.append(_row("training_session_completed", user, 2))
    health = _health(rows)
    strong, drops, _unscored = presentation(health)
    assert any(drop.funnel_id == "learning" and drop.lost_users == 10 for drop in drops)
    assert all(metric.id != "finished_after_question" for metric in strong)
    learning = next(item for item in health.funnels if item.id == "learning")
    assert learning.steps[0].cohort == "all people in the window"
    assert learning.steps[0].users == 40


def test_exam_gap_separates_empty_exit_from_an_early_end():
    rows = [
        _row("exam_session_started", "empty", 0),
        _row("exam_session_ended", "empty", 1, end_reason="miss_click_empty_exit", answered_count=0),
        _row("exam_session_started", "early", 0),
        _row("exam_question_answered", "early", 2, question_index=1, question_total=32),
        _row("exam_question_answered", "early", 3, question_index=2, question_total=32),
        _row("exam_session_ended", "early", 4, end_reason="user_ended_early", answered_count=2, question_total=32),
        _row("exam_session_started", "done", 0),
        _row("exam_question_answered", "done", 2, question_index=1, question_total=20),
        _row("exam_session_completed", "done", 5, passed=False),
    ]
    drills = describe_drills(rows)
    exam = next(item for item in drills if item["id"] == "exam_unfinished")
    assert exam["people"] == 2
    depth = {
        row["label"]: row["count"]
        for row in next(group["rows"] for group in exam["groups"] if group["title"] == "No later learning — answers")
    }
    assert depth["0 answers"] == 1
    assert depth["1–5 questions"] == 1
    nxt = next(group for group in exam["groups"] if group["title"] == "What happened next")
    assert sum(row["count"] for row in nxt["rows"]) == 2
    zero = next(group for group in exam["groups"] if group["title"] == "0 answers — on the exam screen")
    recorded = {row["label"]: row["count"] for row in zero["rows"]}
    assert recorded["Paywall or ad before the exit"] == 0
    assert recorded["Technical error before the exit"] == 0


def test_training_after_an_abandoned_exam_can_lead_to_another_exam():
    rows = [
        _row("exam_session_started", "a", 0),
        _row("exam_session_ended", "a", 1, end_reason="miss_click_empty_exit", answered_count=0),
        _row("training_session_started", "a", 5),
        _row("exam_session_started", "a", 30),
        _row("exam_session_completed", "a", 40, passed=False),
        _row("exam_session_started", "b", 0),
        _row("exam_session_ended", "b", 1, end_reason="miss_click_empty_exit", answered_count=0),
        _row("screen_viewed", "b", 24 * 60, screen_name="home"),
    ]
    drills = describe_drills(rows, window_end=WINDOW_END.date())
    exam = next(item for item in drills if item["id"] == "exam_unfinished")
    assert exam["people"] == 1
    assert exam["tailPeople"] == 1
    loop = next(group for group in exam["groups"] if group["title"] == "After training, a later exam")
    recorded = {row["label"]: row["count"] for row in loop["rows"]}
    assert recorded["Later exam within 24 hours"] == 1
    assert sum(recorded.values()) == 1
    day = next(group for group in exam["groups"] if group["title"] == "No later learning — next calendar day")
    back = {row["label"]: row["count"] for row in day["rows"]}
    assert back["Back the next calendar day"] == 1


def test_a_paywall_after_the_exit_is_not_exam_entry_friction():
    rows = [
        _row("exam_session_started", "after", 0),
        _row("screen_viewed", "after", 0, screen_name="exam_session"),
        _row("exam_session_ended", "after", 1, end_reason="miss_click_empty_exit", answered_count=0),
        _row("ad_shown", "after", 2, placement="training"),
        _row("exam_session_started", "during", 0),
        _row("paywall_viewed", "during", 0, source="exam_limit"),
        _row("exam_session_ended", "during", 1, end_reason="miss_click_empty_exit", answered_count=0),
    ]
    drills = describe_drills(rows)
    exam = next(item for item in drills if item["id"] == "exam_unfinished")
    checklist = next(group for group in exam["groups"] if group["title"] == "0 answers — on the exam screen")
    recorded = {row["label"]: row["count"] for row in checklist["rows"]}
    assert recorded["Paywall or ad before the exit"] == 1
    assert recorded["Exam screen opened"] == 1
    zero = next(group for group in exam["groups"] if group["title"] == "0 answers — what happened next")
    assert sum(row["count"] for row in zero["rows"]) == 2


def test_another_training_after_an_incomplete_attempt_is_not_a_drop_off():
    rows = [
        _row("training_session_started", "a", 0),
        _row("training_session_abandoned", "a", 2, answered_count=1),
        _row("training_session_started", "a", 5),
    ]
    drills = describe_drills(rows)
    training = next(item for item in drills if item["id"] == "activity_unfinished")
    assert "not scored as a drop-off" in training["note"]
    nxt = next(group for group in training["groups"] if group["title"] == "What happened next")
    recorded = {row["label"]: row["count"] for row in nxt["rows"]}
    assert recorded["Another training"] == 1
    assert sum(recorded.values()) == 2


def test_exam_after_training_requires_the_exam_to_follow():
    rows = [
        _row("training_session_completed", "early", 0),
        _row("exam_session_started", "early", 10),
        _row("exam_session_started", "before", 0),
        _row("exam_session_completed", "before", 5, passed=False),
        _row("training_session_completed", "before", 20),
    ]
    health = _health(rows)
    exam = next(item for item in health.funnels if item.id == "exam")
    assert [step.users for step in exam.steps] == [2, 1]


def test_session_ids_prevent_completion_of_another_attempt_or_installation():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_started", "a", 2, exam_session_id="exam-b"),
        _row("exam_session_completed", "a", 3, exam_session_id="exam-a", passed=True),
        _row("exam_session_started", "b", 0, exam_session_id="exam-a"),
    ]
    attempts = reconstruct_attempts(list(reversed(rows)))
    states = {(item.person, item.attempt_id): item.completed for item in attempts}
    assert states == {("a", "exam-a"): True, ("a", "exam-b"): False, ("b", "exam-a"): False}
    metric = _metric(_health(rows), "exam_attempt_completion")
    assert (metric.numerator, metric.denominator) == (1, 3)
    drill = next(item for item in describe_drills(rows) if item["id"] == "exam_unfinished")
    assert "No exam_session_id" not in drill["cohort"]
    assert drill["joinQuality"] == {"session_id": 3}


def test_missing_completion_id_is_not_attached_to_a_known_start():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_completed", "a", 1, passed=True),
    ]
    assert reconstruct_attempts(rows)[0].completed is False
    health = _health(rows)
    assert _metric(health, "exam_attempt_completion").numerator == 0
    assert _metric(health, "exam_attempt_completion").reliable is False
    assert health.attempt_quality["missing_exam_join_rows"] == 1


def test_legacy_completion_does_not_take_an_explicit_session_id_outcome():
    rows = [
        _row("exam_session_started", "a", 0),
        _row("exam_session_completed", "a", 1, exam_session_id="different", passed=True),
    ]
    attempt = reconstruct_attempts(rows)[0]
    assert attempt.join_basis == "legacy_time_pairing"
    assert attempt.completed is False


def test_replayed_start_and_answer_updates_do_not_add_attempts_or_questions():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_started", "a", 1, exam_session_id="exam-a"),
        _row("exam_question_answered", "a", 2, exam_session_id="exam-a", answer_id="exam-a:20", question_index=20),
        _row("exam_question_answered", "a", 3, exam_session_id="exam-a", answer_id="exam-a:20", question_index=20),
        _row("exam_question_answered", "a", 4, exam_session_id="exam-a", answer_id="exam-a:3", question_index=3),
    ]
    attempts = reconstruct_attempts(rows)
    assert len(attempts) == 1
    assert attempts[0].answers == 2


def test_completion_before_start_and_equal_timestamp_sequence_are_checked():
    before = [
        _row("exam_session_completed", "a", 0, exam_session_id="exam-a", passed=True),
        _row("exam_session_started", "a", 1, exam_session_id="exam-a"),
    ]
    attempt = reconstruct_attempts(before)[0]
    assert attempt.completed is False
    assert "completion_order_unproven" in attempt.join_issues
    same = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a", app_run_id="run", event_sequence=1),
        _row("exam_session_completed", "a", 0, exam_session_id="exam-a", app_run_id="run", event_sequence=2),
    ]
    assert reconstruct_attempts(same)[0].completed is True
    same[1].properties["event_sequence"] = 0
    assert reconstruct_attempts(same)[0].completed is False


def test_invalid_payload_or_conflicting_terminal_status_cannot_complete_attempt():
    for extra in (
        [_row("exam_session_completed", "a", 2, exam_session_id="exam-a", analytics_payload_valid=False)],
        [_row("exam_session_completed", "a", 2, exam_session_id="exam-a"),
         _row("exam_session_ended", "a", 1, exam_session_id="exam-a", status="abandoned")],
    ):
        rows = [_row("exam_session_started", "a", 0, exam_session_id="exam-a"), *extra]
        assert reconstruct_attempts(rows)[0].completed is False
        assert _metric(_health(rows), "exam_attempt_completion").reliable is False


def test_training_can_resume_same_id_after_a_visit_abandonment():
    rows = [
        _row("training_session_started", "a", 0, training_session_id="training-a"),
        _row("training_session_abandoned", "a", 2, training_session_id="training-a", answered_count=1),
        _row("training_session_resumed", "a", 10, training_session_id="training-a"),
        _row("training_session_completed", "a", 12, training_session_id="training-a", answered_count=5),
    ]
    attempts = reconstruct_attempts(rows)
    assert len(attempts) == 1
    assert attempts[0].completed is True
    assert attempts[0].answers == 5


def test_resuming_a_different_training_is_not_labelled_same_training():
    rows = [
        _row("training_session_started", "a", 0, training_session_id="training-a"),
        _row("training_session_abandoned", "a", 2, training_session_id="training-a", answered_count=1),
        _row("training_session_resumed", "a", 10, training_session_id="training-b"),
    ]
    attempt = reconstruct_attempts(rows)[0]
    assert attempt.next_action == "Another training"
    assert attempt.next_detail.startswith("Training,")


def test_unverified_coverage_never_produces_reliable_health_rates_or_drops():
    rows = []
    for index in range(40):
        user = f"user-{index}"
        rows.extend([_install(user), _row("screen_viewed", user, 0, screen_name="home")])
    health = build_health(rows, window_start=WINDOW_START, window_end=WINDOW_END)
    assert health.coverage_complete is False
    assert health.drops == []
    assert all(not metric.reliable for metric in health.metrics if metric.unit == "rate")
    assert _metric(health, "home_after_install").tone == "unknown"


def test_immature_attempts_are_censored_even_if_a_completion_is_already_visible():
    near_end = WINDOW_END.astimezone(UTC) - timedelta(hours=1)
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_completed", "a", 1, exam_session_id="exam-a"),
    ]
    rows[0].timestamp = near_end
    rows[1].timestamp = near_end + timedelta(minutes=1)
    health = _health(rows)
    assert health.attempt_quality["exam_censored"] == 1
    metric = _metric(health, "exam_attempt_completion")
    assert metric.numerator == metric.denominator == 0


def test_conflicting_distinct_id_does_not_link_an_install_marker_by_last_write():
    rows = [
        _install("shared"),
        _row("screen_viewed", "a", 0, screen_name="home"),
        _row("screen_viewed", "b", 1, screen_name="home"),
    ]
    rows[1].distinct_id = rows[2].distinct_id = "d-shared"
    assert _health(rows).installs == 0


def test_replayed_start_after_a_failure_is_not_a_new_exam_restart():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_completed", "a", 1, exam_session_id="exam-a", passed=False),
        _row("exam_session_started", "a", 2, exam_session_id="exam-a"),
    ]
    metric = _metric(_health(rows), "retry_after_fail")
    assert (metric.numerator, metric.denominator) == (0, 1)


def test_unknown_passed_value_does_not_become_a_failed_exam():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_session_completed", "a", 1, exam_session_id="exam-a"),
    ]
    assert _metric(_health(rows), "first_exam_pass").denominator == 0


def test_same_slot_does_not_double_count_when_answer_id_is_added_later():
    rows = [
        _row("exam_session_started", "a", 0, exam_session_id="exam-a"),
        _row("exam_question_answered", "a", 1, exam_session_id="exam-a", question_index=1),
        _row("exam_question_answered", "a", 2, exam_session_id="exam-a", answer_id="exam-a:1", question_index=1),
    ]
    assert reconstruct_attempts(rows)[0].answers == 1
