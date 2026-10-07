"""Meaningful learning is a versioned observation rule, not a product gate."""

from __future__ import annotations

from datetime import datetime
from statistics import median
from typing import TYPE_CHECKING

from prawko_analytics.ingest import _parse_timestamp
from prawko_analytics.models import LearningTimingModel
from prawko_analytics.quality import nonnegative_number, observation_integrity_issue, observation_usable
from prawko_analytics.data_quality import canonical_observations
from prawko_analytics.paywall_contract import ELIGIBILITY_EVENTS

if TYPE_CHECKING:
    from prawko_analytics.context import PreparedRow


def _number(value) -> float:
    return value if nonnegative_number(value) else 0


def meaningful_learning(row: PreparedRow) -> bool:
    props = row.properties
    if not observation_usable(props) or props.get("learning_outcome_rule_version") != "learning-v1":
        return False
    if row.event == "training_session_completed":
        return bool(props.get("training_session_id")) and _number(props.get("accepted_unique_question_count")) >= 5
    if row.event == "exam_session_completed":
        total = _number(props.get("question_total"))
        return (
            bool(props.get("exam_session_id")) and props.get("completion_status") == "completed"
            and total > 0 and _number(props.get("answered_count")) >= total
        )
    return False


def _anchor_metadata(row: PreparedRow) -> datetime | None:
    props = row.properties
    if (
        row.key_source != "primary" or not row.analysis_key
        or not props.get("installation_observation_id")
        or props.get("observation_detection_method") != "first_local_observation"
        or props.get("observation_contract_version") != 1
    ):
        return None
    try:
        first = _parse_timestamp(props["first_observed_at"])
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    return first if first <= row.timestamp else None


def observation_anchor(row: PreparedRow) -> datetime | None:
    return _anchor_metadata(row) if observation_usable(row.properties) else None


def observation_anchors(rows: list[PreparedRow]):
    anchors: dict[tuple, datetime] = {}
    conflicting: set[tuple] = set()
    excluded: set[tuple] = set()
    for row in rows:
        observation_id = row.properties.get("installation_observation_id")
        if not row.analysis_key or not isinstance(observation_id, str) or not observation_id:
            continue
        key = (row.analysis_key, observation_id)
        first = observation_anchor(row)
        if first is None:
            excluded.add(key)
            continue
        if key in anchors and anchors[key] != first:
            conflicting.add(key)
        anchors.setdefault(key, first)
    for key in conflicting:
        anchors.pop(key, None)
    return anchors, (excluded - anchors.keys()) | conflicting


def learning_source_dependency(row: PreparedRow, anchors: dict[tuple, datetime]) -> bool:
    if row.event in ("install_observation_resolved", "training_session_completed", "exam_session_completed"):
        return True
    props = row.properties
    if props.get("installation_observation_id") is None and props.get("first_observed_at") is None:
        return False
    observation_id = props.get("installation_observation_id")
    if not isinstance(observation_id, str) or not observation_id:
        return True
    key = (row.analysis_key, observation_id)
    # Unrelated payload failures cannot erase an independently confirmed root.
    # Unmatched/malformed root evidence still limits the learning report.
    declared = _anchor_metadata(row)
    return declared is None or anchors.get(key) != declared


def learning_time_to_value(
    rows: list[PreparedRow], *, start: datetime, end: datetime, complete: bool,
) -> LearningTimingModel:
    rows = [row for row in rows if row.event not in ELIGIBILITY_EVENTS]
    source_rows = rows
    rows = canonical_observations(rows)
    candidates, excluded = observation_anchors(rows)
    invalid_rows = sum(
        observation_integrity_issue(row.properties) and learning_source_dependency(row, candidates)
        for row in source_rows
    )
    anchors = {key: first for key, first in candidates.items() if start <= first < end}
    achieved: dict[tuple, float] = {}
    for row in sorted(rows, key=lambda item: item.timestamp):
        if not meaningful_learning(row):
            continue
        observation_id = row.properties.get("installation_observation_id")
        if not isinstance(observation_id, str) or not observation_id:
            continue
        key = (row.analysis_key, observation_id)
        first = anchors.get(key)
        if first is None or key in achieved or not first <= row.timestamp < end:
            continue
        achieved[key] = (row.timestamp - first).total_seconds()
    return LearningTimingModel(
        status="incomplete_coverage" if not complete else "limited_integrity" if invalid_rows else "observed",
        observations=len(anchors), achieved=len(achieved), censored=len(anchors) - len(achieved),
        excluded_observations=len(excluded),
        invalid_observation_rows=invalid_rows,
        median_achieved_seconds=median(achieved.values()) if achieved and complete and not invalid_rows else None,
        as_of=end,
    )
