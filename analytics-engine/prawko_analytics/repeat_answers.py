"""Ordered, revision-controlled repeat answers after observed explanations/review."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import timedelta

from prawko_analytics.content import content_record, display_record, exam_rule_record, content_observations_report
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.quality import observation_usable


ANSWER_EVENTS = {"training_question_answered", "exam_question_answered"}
EXPOSURE_EVENTS = {
    "answer_explanation_viewed", "training_answers_review_question_viewed", "exam_answers_review_question_viewed",
}
MODES = {
    "learning", "blitz", "new_questions", "weak_spots", "hard_questions", "high_points",
    "review_due", "seen_not_mastered", "wrong_answers", "saved", "saved_sprint", "exam_tomorrow",
    "mini_test", "initial_diagnostic", "exam",
}
HORIZON = timedelta(days=7)
COMPARISON_FIELDS = (
    "question_revision", "content_requested_locale", "content_text_field",
    "content_source_language", "content_source_kind", "choice_source_languages",
)


@dataclass
class Answer:
    row: object
    install: str
    question: str
    key: tuple | None
    content: dict | None
    valid: bool


def _before(left, right) -> bool:
    if left.timestamp != right.timestamp:
        return left.timestamp < right.timestamp
    lprops, rprops = left.properties, right.properties
    runtime = safe_identity_id(lprops.get("app_run_id"))
    lseq, rseq = lprops.get("event_sequence"), rprops.get("event_sequence")
    return bool(runtime and runtime == safe_identity_id(rprops.get("app_run_id"))
                and type(lseq) is int and type(rseq) is int and 0 <= lseq < rseq)


def _edge(items: list, *, latest: bool):
    if not items:
        return None
    moment = (max if latest else min)(item.timestamp for item in items)
    tied = [item for item in items if item.timestamp == moment]
    if len(tied) == 1:
        return tied[0]
    for candidate in tied:
        if all(
            candidate is other or (_before(other, candidate) if latest else _before(candidate, other))
            for other in tied
        ):
            return candidate
    return None


def _selection(props: dict) -> dict:
    mode = props.get("mode")
    seen = props.get("previous_times_seen")
    first = props.get("first_encounter")
    return {
        "mode": mode if isinstance(mode, str) and mode in MODES else None,
        "first_encounter": first if type(first) is bool else None,
        "previous_times_seen": seen if type(seen) is int and seen >= 0 else None,
        "is_plus": props.get("is_plus") if type(props.get("is_plus")) is bool else None,
    }


def _content_known(record: dict | None) -> bool:
    return bool(record and record["content_source_language"] is not None and record["choice_unknown_source_count"] == 0)


def _selection_valid(props: dict) -> bool:
    mode, seen, first = props.get("mode"), props.get("previous_times_seen"), props.get("first_encounter")
    return (
        (mode is None or (isinstance(mode, str) and mode in MODES))
        and (seen is None or (type(seen) is int and seen >= 0))
        and (first is None or type(first) is bool)
        and (first is None or seen is None or first == (seen == 0))
        and (props.get("is_plus") is None or type(props["is_plus"]) is bool)
    )


def _comparison(left: dict | None, right: dict | None) -> str | None:
    if not _content_known(left) or not _content_known(right):
        return "unknown_content_metadata"
    if left["question_revision"] != right["question_revision"]:
        return "question_revision_changed"
    if any(left[key] != right[key] for key in COMPARISON_FIELDS[1:]):
        return "content_language_or_choices_changed"
    return None


def _answers(rows) -> tuple[list[Answer], Counter]:
    quality = Counter()
    observations = defaultdict(list)
    boundaries = []
    revision_scopes = defaultdict(set)
    for row in rows:
        if row.event not in ANSWER_EVENTS:
            continue
        props = row.properties
        if not _selection_valid(props):
            quality["invalid_selection_observations"] += 1
        install = safe_identity_id(props.get("app_user_id"))
        question = safe_identity_id(props.get("question_id"))
        kind = "training" if row.event == "training_question_answered" else "exam"
        session = safe_identity_id(props.get(f"{kind}_session_id"))
        answer = safe_identity_id(props.get("answer_id"))
        rev = safe_identity_id(props.get("answer_revision_id")) if kind == "exam" else answer
        key = (install, kind, session, answer) if install and session and answer else None
        valid = observation_usable(props) and type(props.get("is_correct")) is bool and bool(key and question and rev)
        if kind == "exam":
            valid = valid and props.get("answer_action") in ("create", "update")
        if not valid:
            quality["invalid_answer_observations"] += 1
        if not install or not question:
            continue
        item = Answer(row, install, question, key, content_record(props), bool(valid))
        if key is None or rev is None:
            boundaries.append(item)
            continue
        observations[(key, rev)].append(item)
        if kind == "exam":
            revision_scopes[(install, rev)].add(key)
    conflicts = {key for scopes in revision_scopes.values() if len(scopes) > 1 for key in scopes}
    answers = list(boundaries)
    creates = Counter()
    for (key, _revision), items in observations.items():
        signatures = {
            json.dumps({
                "question": item.question, "content": item.content,
                "is_correct": item.row.properties.get("is_correct"),
                "action": item.row.properties.get("answer_action") if key[1] == "exam" else "create",
            }, sort_keys=True, default=lambda _value: "invalid")
            for item in items
        }
        if len(signatures) > 1 or any(not item.valid for item in items):
            conflicts.add(key)
        quality["duplicate_answer_observations"] += len(items) - 1
        earliest = _edge([item.row for item in items], latest=False)
        coordinates = {
            (item.row.timestamp, safe_identity_id(item.row.properties.get("app_run_id")),
             item.row.properties.get("event_sequence") if type(item.row.properties.get("event_sequence")) is int else None)
            for item in items
        }
        if earliest is None and len(coordinates) > 1:
            conflicts.add(key)
        # Identical coordinates are one observation; uncertain cross-runtime order is quarantined.
        chosen = next((item for item in items if item.row is earliest), items[0])
        answers.append(chosen)
        if key[1] == "exam" and chosen.row.properties.get("answer_action") == "create":
            creates[key] += 1
    conflicts.update(key for key, count in creates.items() if count > 1)
    for answer in answers:
        if answer.key in conflicts:
            answer.valid = False
    quality["conflicting_answer_units"] = len(conflicts)
    return answers, quality


def repeat_answer_report(rows, *, start, end, coverage_complete: bool = False, content_quality: dict | None = None) -> dict:
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("Repeat-answer report requires ordered timezone-aware window bounds.")
    rows = [row for row in rows if row.timestamp.tzinfo is not None and start <= row.timestamp < end]
    answers, quality = _answers(rows)
    by_question = defaultdict(list)
    for answer in answers:
        by_question[(answer.install, answer.question)].append(answer)
    roots = defaultdict(list)
    seen_exposures = set()
    for row in rows:
        if row.event not in EXPOSURE_EVENTS:
            continue
        props = row.properties
        quality["exposure_observations"] += 1
        if not _selection_valid(props):
            quality["invalid_selection_observations"] += 1
        record = content_record(props)
        displayed = display_record(props)
        kind = "exam" if row.event == "exam_answers_review_question_viewed" else "training"
        session = safe_identity_id(props.get(f"{kind}_session_id"))
        install = safe_identity_id(props.get("app_user_id"))
        question = safe_identity_id(props.get("question_id"))
        review = row.event != "answer_explanation_viewed"
        if not (observation_usable(props) and record and install and session and question):
            quality["invalid_or_uninstrumented_exposures"] += 1
            continue
        if review and (props.get("view_state") != "question" or props.get("was_answered") is not True
                       or not safe_identity_id(props.get("review_id"))):
            quality["non_answer_review_observations"] += 1
            continue
        if not review and not (displayed and displayed["explanation_rendered_state"] == "text"):
            quality["non_text_explanation_observations"] += 1
            continue
        candidates = by_question[(install, question)]
        tied = [answer for answer in candidates if answer.row.timestamp == row.timestamp
                and not _before(answer.row, row) and not _before(row, answer.row)]
        before = [answer for answer in candidates if _before(answer.row, row)]
        baseline_row = _edge([answer.row for answer in before], latest=True)
        if tied or (before and baseline_row is None):
            quality["ambiguous_order_observations"] += 1
            continue
        if baseline_row is None:
            quality["baseline_unavailable_observations"] += 1
            continue
        baseline = next(answer for answer in before if answer.row is baseline_row)
        if not baseline.valid or not baseline.key or baseline.key[1:3] != (kind, session):
            quality["invalid_or_intervening_baseline_observations"] += 1
            continue
        if props.get("is_correct") is not None and props["is_correct"] is not baseline.row.properties["is_correct"]:
            quality["baseline_correctness_disagreements"] += 1
            continue
        exposure_signature = (
            baseline.key, row.event, row.timestamp, safe_identity_id(props.get("app_run_id")),
            props.get("event_sequence") if type(props.get("event_sequence")) is int else None,
            json.dumps({"content": record, "display": displayed, "selection": _selection(props)}, sort_keys=True),
        )
        if exposure_signature in seen_exposures:
            quality["duplicate_exposure_observations"] += 1
            continue
        seen_exposures.add(exposure_signature)
        roots[baseline.key].append((row, baseline, record, displayed))
    units = []
    for _key, exposures in roots.items():
        first = _edge([item[0] for item in exposures], latest=False)
        if first is None:
            quality["ambiguous_order_observations"] += 1
            continue
        row, baseline, record, displayed = next(item for item in exposures if item[0] is first)
        horizon_end = row.timestamp + HORIZON
        mature = horizon_end <= end
        # An exam update edits the same logical slot; it is never a new repeated question.
        candidates = [
            answer for answer in by_question[(baseline.install, baseline.question)]
            if answer.key != baseline.key and row.timestamp <= answer.row.timestamp < horizon_end
            and (
                not answer.key or answer.key[1] != "exam"
                or answer.row.properties.get("answer_action") != "update"
                or not any(
                    earlier.key == answer.key and earlier.row.properties.get("answer_action") == "create"
                    and _before(earlier.row, answer.row)
                    for earlier in by_question[(baseline.install, baseline.question)]
                )
            )
        ]
        tied = [answer for answer in candidates if answer.row.timestamp == row.timestamp
                and not _before(row, answer.row) and not _before(answer.row, row)]
        after = [answer for answer in candidates if _before(row, answer.row)]
        next_row = _edge([answer.row for answer in after], latest=False)
        followup = next((answer for answer in after if answer.row is next_row), None)
        status = _comparison(baseline.content, record)
        if row.event == "answer_explanation_viewed" and displayed:
            if displayed["explanation_display_matches_selected_field"] is not True or record["explanation_source_language"] is None:
                status = status or "unknown_rendered_source"
        if not status:
            if tied or (after and next_row is None):
                status = "ambiguous_followup_order"
            elif followup is None:
                status = "no_repeat_observed" if mature else "censored"
            elif not followup.valid:
                status = "invalid_followup"
            elif followup.key[1] == "exam" and followup.row.properties.get("answer_action") == "update":
                status = "repeat_creation_unobserved"
            else:
                status = _comparison(record, followup.content) or "comparable_repeat"
                if baseline.key[1] == "exam" and followup.key[1] == "exam":
                    before_rules = exam_rule_record(baseline.row.properties)
                    after_rules = exam_rule_record(followup.row.properties)
                    if (
                        not before_rules or not after_rules
                        or before_rules["exam_origin_profile_revision"] is None
                        or after_rules["exam_origin_profile_revision"] is None
                        or before_rules != after_rules
                    ):
                        status = "exam_rules_changed_or_unknown"
        units.append({
            "baseline": baseline, "exposure": row, "content": record, "display": displayed, "followup": followup,
            "status": status, "mature": mature, "exposure_count": len(exposures),
        })
    source_quality = content_quality if content_quality is not None else content_observations_report(rows, coverage_complete=coverage_complete)
    quality["conflicting_source_bindings"] = source_quality["provenance"]["conflicting_source_bindings"]
    quality["exam_rule_quarantined_sessions"] = source_quality["exam_rules"]["quarantined_sessions"]
    integrity_keys = (
        "invalid_answer_observations", "conflicting_answer_units", "invalid_or_uninstrumented_exposures",
        "ambiguous_order_observations", "invalid_or_intervening_baseline_observations",
        "baseline_correctness_disagreements", "conflicting_source_bindings", "exam_rule_quarantined_sessions",
        "baseline_unavailable_observations",
        "invalid_selection_observations",
    )
    blocked = sum(quality[key] for key in integrity_keys) + sum(
        unit["status"] in {
            "invalid_followup", "ambiguous_followup_order", "unknown_content_metadata",
            "unknown_rendered_source", "repeat_creation_unobserved",
        }
        for unit in units
    )
    rates_allowed = coverage_complete and not blocked
    buckets = {}
    statuses = Counter()
    comparable = mature_comparable = repeat_correct = 0
    followup_keys = set()
    for unit in units:
        baseline, exposure, record = unit["baseline"], unit["exposure"], unit["content"]
        displayed, followup, status = unit["display"], unit["followup"], unit["status"]
        statuses[status] += 1
        is_pair = status == "comparable_repeat"
        mature_pair = is_pair and unit["mature"]
        correct = is_pair and followup.row.properties["is_correct"]
        comparable += is_pair
        mature_comparable += mature_pair
        repeat_correct += mature_pair and correct
        if is_pair:
            followup_keys.add(followup.key)
        group = {
            "question_id": baseline.question, "question_revision": record["question_revision"],
            "content_requested_locale": record["content_requested_locale"],
            "content_source_language": record["content_source_language"],
            "choice_source_languages": record["choice_source_languages"],
            "exposure_event": exposure.event,
            "exposure_kind": "explanation_text_visible" if exposure.event == "answer_explanation_viewed" else "answer_review_question_visible",
            "explanation_revision": record["explanation_revision"],
            "explanation_display_revision": displayed["explanation_display_revision"] if displayed else None,
            "explanation_display_variant": displayed["explanation_display_variant"] if displayed else None,
            "explanation_rendered_state": displayed["explanation_rendered_state"] if displayed else "not_recorded",
            "baseline_selection": _selection(baseline.row.properties),
            "exposure_is_plus": _selection(exposure.properties)["is_plus"],
            "repeat_selection": _selection(followup.row.properties) if followup else None,
            "comparison_status": status,
        }
        key = json.dumps(group, sort_keys=True)
        bucket = buckets.setdefault(key, {
            **group, "units": 0, "mature_units": 0, "censored_units": 0, "comparable_pairs": 0,
            "mature_comparable_pairs": 0, "mature_repeat_correct": 0, "transitions": Counter(), "installs": set(),
            "additional_exposure_observations": 0,
            "baseline_to_exposure_seconds": [], "repeat_delay_seconds": [],
        })
        bucket["units"] += 1
        bucket["mature_units"] += unit["mature"]
        bucket["censored_units"] += not unit["mature"]
        bucket["comparable_pairs"] += is_pair
        bucket["mature_comparable_pairs"] += mature_pair
        bucket["mature_repeat_correct"] += mature_pair and correct
        bucket["installs"].add(baseline.install)
        bucket["additional_exposure_observations"] += unit["exposure_count"] - 1
        bucket["baseline_to_exposure_seconds"].append((exposure.timestamp - baseline.row.timestamp).total_seconds())
        if is_pair:
            bucket["repeat_delay_seconds"].append((followup.row.timestamp - exposure.timestamp).total_seconds())
            before = "correct" if baseline.row.properties["is_correct"] else "wrong"
            bucket["transitions"][f"{before}_to_{'correct' if correct else 'wrong'}"] += 1
    groups = []
    for _key, bucket in sorted(buckets.items()):
        installs = bucket.pop("installs")
        bucket["installations"] = len(installs)
        bucket["transitions"] = dict(sorted(bucket["transitions"].items()))
        for field in ("baseline_to_exposure_seconds", "repeat_delay_seconds"):
            values = bucket.pop(field)
            bucket[f"min_{field}"] = min(values, default=None)
            bucket[f"max_{field}"] = max(values, default=None)
        bucket["mature_repeat_correct_fraction"] = (
            bucket["mature_repeat_correct"] / bucket["mature_comparable_pairs"]
            if rates_allowed and bucket["mature_comparable_pairs"] else None
        )
        bucket["confidence_ceiling"] = "low" if bucket["mature_comparable_pairs"] < 30 else "medium"
        groups.append(bucket)
    return {
        "observation_version": 1, "rule_version": "repeat-answer-v1",
        "status": "not_observed" if not quality["exposure_observations"] else (
            "limited" if not rates_allowed or quality["baseline_unavailable_observations"] else "observed"
        ),
        "grain": "installation_scoped_baseline_logical_answer", "identity_grain": "app_user_id_installation",
        "horizon_seconds": int(HORIZON.total_seconds()), "coverage_complete": coverage_complete,
        "history_scope": "provided_window_only_no_pre_window_baseline_backfill",
        "root_units": len(units), "comparable_pairs": comparable, "unique_repeat_answers": len(followup_keys),
        "mature_units": sum(unit["mature"] for unit in units),
        "censored_units": sum(not unit["mature"] for unit in units),
        "mature_comparable_pairs": mature_comparable,
        "mature_repeat_correct_fraction": repeat_correct / mature_comparable if rates_allowed and mature_comparable else None,
        "rate_status": "observed_descriptive" if rates_allowed and mature_comparable else (
            "no_mature_comparable_pairs" if rates_allowed else "prohibited_coverage_or_integrity"
        ),
        "quality_issue_count": blocked,
        "evidence_class": "descriptive_observation",
        "confidence_ceiling": "low" if mature_comparable < 30 else "medium",
        "non_causal_clause": "Observed self-selected pairs do not identify explanation/review effects.",
        "quality": {key: quality[key] for key in (*integrity_keys, "duplicate_answer_observations",
            "exposure_observations", "duplicate_exposure_observations", "non_answer_review_observations",
            "non_text_explanation_observations")},
        "outcomes": dict(sorted(statuses.items())), "groups": groups,
        "limitations": [
            "Visible explanation/review is not proof of reading, comprehension or study time.",
            "The next distinct logical answer within seven days is compared; exam slot updates are not repeat learning.",
            "Missing baselines and changed revisions/languages/rules remain explicit, never linked by timing alone.",
            "Only mature same-content pairs with verified coverage and clean observation integrity have descriptive fractions.",
            "Modes, first-encounter/history and Plus context describe self-selection, not random assignment.",
            "No untreated/control cohort is inferred; transitions and fractions are not causal effects or explanation lift.",
            "Exposure/repeat delays are event-time intervals, not focused viewing or study duration.",
            "Missing repeats can be censored or outside the provided window; they are not learner failure or goal completion.",
        ],
    }
