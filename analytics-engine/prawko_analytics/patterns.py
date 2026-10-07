"""Behavioral patterns. Associations are computed here and are never causal."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from prawko_analytics.interpret import values_equal
from prawko_analytics.models import EligibilityModel, FindingModel, ReasonModel, SegmentModel
from prawko_analytics.quality import observation_usable

MIN_CELL = 8
MEDIUM_CELL = 20
CONTRAST_FOR_MEDIUM = 0.10
WEAK_CONTRAST = 0.05
RESTART_WINDOW = timedelta(minutes=15)

TRAINING_CLAUSE = (
    "Completed training before the first exam is associated with the first-exam pass rate "
    "in this window. The segments show the direction. It does not show that training causes the result."
)
RESTART_CLAUSE = (
    "These shares describe what happened after a failed exam completion in this window. "
    "They do not show why the person started again."
)
CONTINUATION_CLAUSE = (
    "This is the share of people who started another exam after a failure. "
    "It does not show that the failure caused them to stop."
)
POSITION_CLAUSE = (
    "Wrong-answer rate by position inside the exam. It does not show that later questions "
    "are harder, or that the exam should be shorter."
)
VERSION_CLAUSE = (
    "Pass rate differs by app version in this window. It does not show that the release caused the difference."
)


def discover_patterns(rows: list, *, concentration_warning: bool) -> list[FindingModel]:
    primary = {row.analysis_key for row in rows if row.key_source == "primary" and row.analysis_key}
    usable = [row for row in rows if row.analysis_key in primary and row.key_source == "primary"
              and observation_usable(row.properties)]
    excluded = len({row.analysis_key for row in rows if row.analysis_key and row.analysis_key not in primary})
    builders = (
        _prior_training,
        _restart_after_failure,
        _continuation_after_failure,
        _wrong_rate_by_position,
        _pass_rate_by_version,
    )
    findings = []
    for builder in builders:
        finding = builder(usable, excluded_keys=excluded, concentration_warning=concentration_warning)
        if finding is not None:
            findings.append(finding)
    return findings


def _prior_training(rows: list, *, excluded_keys: int, concentration_warning: bool) -> FindingModel | None:
    exams: dict[str, list] = defaultdict(list)
    trainings: dict[str, list] = defaultdict(list)
    for row in rows:
        if row.event == "exam_session_completed":
            exams[row.analysis_key].append(row)
        elif row.event == "training_session_completed":
            trainings[row.analysis_key].append(row)
    if not exams:
        return None
    buckets = {"0": [0, 0], "1": [0, 0], "2+": [0, 0]}
    for key, attempts in exams.items():
        first = min(attempts, key=lambda row: row.timestamp)
        prior = sum(row.timestamp < first.timestamp for row in trainings.get(key, []))
        label = "0" if prior == 0 else "1" if prior == 1 else "2+"
        buckets[label][1] += 1
        buckets[label][0] += int(_passed(first))
    segments = [
        _segment(f"{label} completed training sessions before first exam", passed, total)
        for label, (passed, total) in buckets.items()
        if total
    ]
    return _finding(
        "first_exam_pass_by_prior_training",
        "analysis_key",
        segments,
        TRAINING_CLAUSE,
        ["training_causes_higher_pass_rate", "motivation_is_ruled_out"],
        excluded_keys,
        concentration_warning,
    )


def _restart_after_failure(rows: list, *, excluded_keys: int, concentration_warning: bool) -> FindingModel | None:
    completions: dict[str, list] = defaultdict(list)
    starts: dict[str, list] = defaultdict(list)
    for row in rows:
        if row.event == "exam_session_completed":
            completions[row.analysis_key].append(row)
        elif row.event == "exam_session_started":
            starts[row.analysis_key].append(row)
    counts = {"within_15_min": 0, "later_in_window": 0, "no_further_exam_start": 0}
    for key, attempts in completions.items():
        later_starts = sorted(row.timestamp for row in starts.get(key, []))
        for attempt in attempts:
            if _passed(attempt):
                continue
            nxt = next((moment for moment in later_starts if moment > attempt.timestamp), None)
            if nxt is None:
                counts["no_further_exam_start"] += 1
            elif nxt - attempt.timestamp <= RESTART_WINDOW:
                counts["within_15_min"] += 1
            else:
                counts["later_in_window"] += 1
    total = sum(counts.values())
    if total == 0:
        return None
    segments = [_segment(label, count, total) for label, count in counts.items()]
    return _finding(
        "restart_after_failed_exam",
        "failed_exam_completion",
        segments,
        RESTART_CLAUSE,
        ["failure_causes_restart", "each_restart_is_a_different_person"],
        excluded_keys,
        concentration_warning,
    )


def _continuation_after_failure(rows: list, *, excluded_keys: int, concentration_warning: bool) -> FindingModel | None:
    completions: dict[str, list] = defaultdict(list)
    starts: dict[str, list] = defaultdict(list)
    for row in rows:
        if row.event == "exam_session_completed":
            completions[row.analysis_key].append(row)
        elif row.event == "exam_session_started":
            starts[row.analysis_key].append(row)
    reached = {1: [0, 0], 2: [0, 0]}
    for key, attempts in completions.items():
        failures = sorted((row for row in attempts if not _passed(row)), key=lambda row: row.timestamp)
        start_times = sorted(row.timestamp for row in starts.get(key, []))
        for ordinal, bucket in reached.items():
            if len(failures) < ordinal:
                continue
            moment = failures[ordinal - 1].timestamp
            bucket[1] += 1
            bucket[0] += int(any(start > moment for start in start_times))
    segments = [
        _segment(f"started another exam after failure {ordinal}", started, total)
        for ordinal, (started, total) in reached.items()
        if total
    ]
    if not segments:
        return None
    return _finding(
        "continuation_after_nth_failure",
        "analysis_key",
        segments,
        CONTINUATION_CLAUSE,
        ["failure_causes_stopping"],
        excluded_keys,
        concentration_warning,
    )


def _wrong_rate_by_position(rows: list, *, excluded_keys: int, concentration_warning: bool) -> FindingModel | None:
    buckets = {"first_70_percent": [0, 0], "last_30_percent": [0, 0]}
    for row in rows:
        if row.event != "exam_question_answered":
            continue
        index = _int(row.properties.get("question_index"))
        total = _int(row.properties.get("question_total"))
        if index is None or total is None or total <= 0 or "is_correct" not in row.properties:
            continue
        label = "last_30_percent" if index / total > 0.7 else "first_70_percent"
        buckets[label][1] += 1
        buckets[label][0] += int(not values_equal(True, row.properties.get("is_correct")))
    if not any(total for _wrong, total in buckets.values()):
        return None
    segments = [
        _segment(label, wrong, total) for label, (wrong, total) in buckets.items() if total
    ]
    return _finding(
        "exam_wrong_rate_by_position",
        "exam_question_answered",
        segments,
        POSITION_CLAUSE,
        ["later_questions_are_harder", "exam_should_be_shorter"],
        excluded_keys,
        concentration_warning,
    )


def _pass_rate_by_version(rows: list, *, excluded_keys: int, concentration_warning: bool) -> FindingModel | None:
    buckets: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in rows:
        if row.event != "exam_session_completed" or not row.app_version:
            continue
        buckets[row.app_version][1] += 1
        buckets[row.app_version][0] += int(_passed(row))
    eligible = {version: counts for version, counts in buckets.items() if counts[1] >= MEDIUM_CELL}
    if len(eligible) < 2:
        return None
    segments = [
        _segment(version, passed, total)
        for version, (passed, total) in sorted(eligible.items())
    ]
    return _finding(
        "exam_pass_rate_by_app_version",
        "exam_session_completed",
        segments,
        VERSION_CLAUSE,
        ["release_caused_the_pass_rate_change"],
        excluded_keys,
        concentration_warning,
    )


def _finding(
    finding_id: str,
    grain: str,
    segments: list[SegmentModel],
    clause: str,
    do_not_claim: list[str],
    excluded_keys: int,
    concentration_warning: bool,
) -> FindingModel:
    rates = [segment.rate for segment in segments if segment.rate is not None and segment.denominator >= MIN_CELL]
    contrast = max(rates) - min(rates) if len(rates) >= 2 else None
    small = any(0 < segment.denominator < MIN_CELL for segment in segments)
    reasons: list[ReasonModel] = []
    ceiling = "low"
    if (
        contrast is not None
        and contrast >= CONTRAST_FOR_MEDIUM
        and all(segment.denominator >= MEDIUM_CELL for segment in segments if segment.denominator)
    ):
        ceiling = "medium"
    if small:
        reasons.append(ReasonModel(rule="small_cell"))
        ceiling = "low"
    elif any(segment.denominator < MEDIUM_CELL for segment in segments if segment.denominator):
        reasons.append(ReasonModel(rule="cell_below_20"))
        ceiling = "low"
    if contrast is not None and contrast < WEAK_CONTRAST:
        reasons.append(ReasonModel(rule="weak_contrast"))
        ceiling = "low"
    if concentration_warning and ceiling == "medium":
        reasons.append(ReasonModel(rule="event_concentration"))
        ceiling = "low"
    return FindingModel(
        id=finding_id,
        layer="behavior",
        evidence_class="association",
        grain=grain,
        segments=segments,
        eligibility=EligibilityModel(status="limited", reasons=reasons),
        confidence_ceiling=ceiling,
        non_causal_clause=clause,
        do_not_claim=do_not_claim,
        excluded_keys=excluded_keys,
        lead_visible=True,
    )


def _segment(label: str, numerator: int, denominator: int) -> SegmentModel:
    rate = None if denominator == 0 else numerator / denominator
    return SegmentModel(label=label, numerator=numerator, denominator=denominator, rate=rate)


def _passed(row) -> bool:
    return values_equal(True, row.properties.get("passed"))


def _int(value) -> int | None:
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
