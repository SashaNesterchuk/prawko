from datetime import datetime, timedelta, timezone

from prawko_analytics.context import PreparedRow, build_context, day_window
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.patterns import discover_patterns
from tests.support import event, write_dump

START = datetime(2026, 9, 12, 8, 0, tzinfo=timezone.utc)


def _row(name: str, user: str, minutes: int, source: str = "primary", version: str = "1.0.23", **props):
    properties = {"app_version": version}
    properties.update(props)
    return PreparedRow(
        event_id=f"{name}-{user}-{minutes}",
        event=name,
        timestamp=START + timedelta(minutes=minutes),
        dump_id="test",
        properties=properties,
        analysis_key=user,
        key_source=source,
        app_version=version,
        schema=None,
        interpretation_id=None,
        match_status="no_contract",
    )


def _by_id(findings, finding_id):
    return next(item for item in findings if item.id == finding_id)


def test_prior_training_is_an_association_not_a_cause():
    rows = []
    for index in range(10):
        user = f"trained-{index}"
        rows.append(_row("training_session_completed", user, 0))
        rows.append(_row("training_session_completed", user, 10))
        rows.append(_row("exam_session_completed", user, 30, passed=True))
    for index in range(10):
        rows.append(_row("exam_session_completed", f"direct-{index}", 30, passed=False))
    finding = _by_id(discover_patterns(rows, concentration_warning=False), "first_exam_pass_by_prior_training")
    trained = next(segment for segment in finding.segments if segment.label.startswith("2+"))
    direct = next(segment for segment in finding.segments if segment.label.startswith("0 "))
    assert trained.numerator == 10 and trained.denominator == 10
    assert direct.numerator == 0 and direct.denominator == 10
    assert finding.confidence_ceiling == "low"
    assert "training_causes_higher_pass_rate" in finding.do_not_claim
    assert "does not show that training causes" in finding.non_causal_clause
    assert finding.lead_visible is True


def test_legacy_key_without_app_user_id_does_not_enter_the_association():
    rows = [_row("exam_session_completed", "legacy", 30, source="fallback", passed=False)]
    for index in range(10):
        rows.append(_row("training_session_completed", f"trained-{index}", 0))
        rows.append(_row("training_session_completed", f"trained-{index}", 10))
        rows.append(_row("exam_session_completed", f"trained-{index}", 30, passed=True))
    finding = _by_id(discover_patterns(rows, concentration_warning=False), "first_exam_pass_by_prior_training")
    assert finding.excluded_keys == 1
    assert sum(segment.denominator for segment in finding.segments) == 10


def test_restart_within_15_minutes_is_counted_per_failed_completion():
    rows = []
    for index in range(6):
        user = f"retry-{index}"
        rows.append(_row("exam_session_completed", user, 0, passed=False))
        rows.append(_row("exam_session_started", user, 5))
    rows.append(_row("exam_session_completed", "stopped", 0, passed=False))
    finding = _by_id(discover_patterns(rows, concentration_warning=False), "restart_after_failed_exam")
    within = next(segment for segment in finding.segments if segment.label == "within_15_min")
    none = next(segment for segment in finding.segments if segment.label == "no_further_exam_start")
    assert within.numerator == 6 and within.denominator == 7
    assert none.numerator == 1 and none.denominator == 7
    assert "failure_causes_restart" in finding.do_not_claim


def test_wrong_answers_later_in_the_exam_stay_non_causal():
    rows = []
    for index in range(1, 21):
        rows.append(
            _row("exam_question_answered", "user", index, question_index=index, question_total=32, is_correct=True)
        )
    for index in range(25, 33):
        rows.append(
            _row(
                "exam_question_answered",
                "user",
                40 + index,
                question_index=index,
                question_total=32,
                is_correct=False,
            )
        )
    finding = _by_id(discover_patterns(rows, concentration_warning=False), "exam_wrong_rate_by_position")
    early = next(segment for segment in finding.segments if segment.label == "first_70_percent")
    late = next(segment for segment in finding.segments if segment.label == "last_30_percent")
    assert early.numerator == 0 and early.denominator == 20
    assert late.numerator == late.denominator
    assert "later_questions_are_harder" in finding.do_not_claim
    assert finding.confidence_ceiling == "low"


def test_version_contrast_needs_two_versions_with_enough_completions():
    rows = [
        _row("exam_session_completed", f"only-{index}", index, passed=index % 2 == 0) for index in range(25)
    ]
    assert not any(
        item.id == "exam_pass_rate_by_app_version"
        for item in discover_patterns(rows, concentration_warning=False)
    )
    mixed = []
    for index in range(20):
        mixed.append(_row("exam_session_completed", f"old-{index}", index, version="1.0.23", passed=False))
        mixed.append(_row("exam_session_completed", f"new-{index}", index, version="1.0.24", passed=True))
    finding = _by_id(discover_patterns(mixed, concentration_warning=False), "exam_pass_rate_by_app_version")
    assert {segment.label for segment in finding.segments} == {"1.0.23", "1.0.24"}
    assert "release_caused_the_pass_rate_change" in finding.do_not_claim
    assert finding.confidence_ceiling == "medium"


def test_degraded_identity_excludes_only_the_legacy_key(tmp_path):
    events = [event(
        "paywall_viewed", "2026-09-12T10:00:00Z", f"usr_{index}", paywall_view_id=f"view_{index}",
    ) for index in range(40)]
    events.append(
        {
            "uuid": "legacy",
            "event": "paywall_viewed",
            "timestamp": "2026-09-12T11:00:00Z",
            "distinct_id": "legacy-distinct",
            "properties": {"app_version": "1.0.19"},
        }
    )
    dump = write_dump(
        tmp_path / "dump.json",
        day="2026-09-12",
        exported_at="2026-09-13T01:00:00Z",
        events=events,
    )
    warehouse = tmp_path / "warehouse"
    ingest_dump(dump, warehouse)
    context = build_context(warehouse, day_window(datetime(2026, 9, 12).date()))
    assert context.identity.quality == "degraded"
    assert any(item.id == "identity_degraded" and item.severity == "WARNING" for item in context.qa)
    paywall = next(item for item in context.metrics if item.id == "paywall_purchase_conversion")
    assert paywall.denominator == 40
    assert paywall.eligibility.status == "allowed"
    assert not any(reason.rule == "identity_degraded" for reason in paywall.eligibility.reasons)
