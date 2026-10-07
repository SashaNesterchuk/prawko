"""Cross-partition observation/business integrity and observed receipt lag."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from math import ceil
from statistics import median

from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import WARSAW, load_events, partition_days
from prawko_analytics.ordering import observed_before
from prawko_analytics.payload_validation import invalid_client_payload, payload_validation_report
from prawko_analytics.paywall_contract import (
    COMPLETED, ELIGIBILITY_EVENTS, PRODUCT_FIELDS, REQUEST_FIELDS, RESOLVED, STARTED,
    TERMINAL_FIELDS, valid_eligibility_payload,
)
from prawko_analytics.quality import nonnegative_number, observation_integrity_issue, observation_usable


@dataclass(frozen=True)
class BusinessRule:
    ids: tuple[str, ...]
    fields: tuple[str, ...]
    required: tuple[str, ...] = ()
    compare_only: tuple[str, ...] = ()


ANSWER_METADATA = (
    "question_revision", "explanation_revision", "content_requested_locale", "content_provenance_version",
    "content_observation_status", "content_revision_algorithm", "content_text_field",
    "content_source_language", "content_source_kind", "content_source_language_basis",
    "explanation_text_field", "explanation_source_language", "explanation_source_kind",
    "explanation_source_language_basis", "choice_source_languages", "choice_unknown_source_count",
    "mode", "first_encounter", "previous_times_seen",
)


RULES = {
    STARTED: BusinessRule(("eligibility_request_id",), (*REQUEST_FIELDS, "eligibility_started_at")),
    RESOLVED: BusinessRule(("eligibility_request_id", "eligibility_product_id"), PRODUCT_FIELDS),
    COMPLETED: BusinessRule(("eligibility_request_id",), TERMINAL_FIELDS),
    "training_session_started": BusinessRule(("training_session_id",), ("mode", "question_total")),
    "exam_session_started": BusinessRule(("exam_session_id",), ("mode", "question_total")),
    "training_question_answered": BusinessRule(
        ("training_session_id", "answer_id"), ("question_id", "is_correct"), ("question_id", "is_correct"),
        ANSWER_METADATA,
    ),
    "exam_question_answered": BusinessRule(
        ("exam_session_id", "answer_revision_id"),
        ("answer_id", "question_id", "answer_action", "is_correct"),
        ("answer_id", "question_id", "answer_action", "is_correct"),
        ANSWER_METADATA,
    ),
    "training_session_completed": BusinessRule(
        ("training_session_id",),
        ("mode", "answered_count", "accepted_unique_question_count", "correct_count", "incorrect_count",
         "passed", "question_total", "score_percent", "learning_outcome_rule_version"),
    ),
    "exam_session_completed": BusinessRule(
        ("exam_session_id",),
        ("mode", "answered_count", "correct_count", "wrong_count", "passed", "completion_status",
         "question_total", "score_points", "total_points_target", "learning_outcome_rule_version"),
    ),
    "purchase_started": BusinessRule(("purchase_attempt_id",), ("product_id", "checkout_view_id")),
    "purchase_succeeded": BusinessRule(
        ("purchase_attempt_id",), ("product_id", "transaction_id", "checkout_view_id", "native_purchase_completed"),
    ),
    "purchase_access_confirmed": BusinessRule(
        ("purchase_attempt_id",), ("product_id", "transaction_id", "checkout_view_id"),
    ),
    "purchase_cancelled": BusinessRule(("purchase_attempt_id",), ("product_id", "checkout_view_id")),
    "purchase_failed": BusinessRule(("purchase_attempt_id",), ("product_id", "checkout_view_id", "error_code")),
    "purchase_preparation_failed": BusinessRule(("purchase_attempt_id",), ("product_id", "checkout_view_id", "error_code")),
    "restore_started": BusinessRule(("restore_attempt_id",), ("checkout_view_id",)),
    "restore_succeeded": BusinessRule(("restore_attempt_id",), ("restore_outcome", "entitlement_active")),
    "restore_failed": BusinessRule(("restore_attempt_id",), ("error_code",)),
    "onboarding_flow_completed": BusinessRule(("onboarding_attempt_id",), ("onboarding_completed_at", "flow_context")),
    "onboarding_home_arrived": BusinessRule(
        ("onboarding_attempt_id",), ("onboarding_completed_at", "onboarding_home_observed_at", "home_arrival_basis"),
    ),
    "notification_schedule_resolved": BusinessRule(
        ("operation_id",), ("operation", "outcome", "scheduled_count", "enabled", "confirmation_scope"),
    ),
    "question_media_ready": BusinessRule(("media_load_id",), ("question_id", "media_type")),
    "question_media_playback_started": BusinessRule(("media_load_id",), ("question_id", "media_type")),
    "question_media_playback_ended": BusinessRule(("media_load_id",), ("question_id", "media_type")),
    "paywall_offer_load_started": BusinessRule(
        ("paywall_view_id", "offer_load_id"), ("offer_request_id", "load_reason"),
    ),
    "paywall_offer_ready": BusinessRule(
        ("paywall_view_id", "offer_load_id"),
        ("offer_request_id", "load_reason", "product_id", "package_id", "subscription_period"),
        compare_only=("price", "currency", "plan"),
    ),
    "paywall_offer_failed": BusinessRule(
        ("paywall_view_id", "offer_load_id"), ("offer_request_id", "load_reason", "failure_reason", "error_code"),
    ),
    "offline_pack_download_started": BusinessRule(("operation_id",), ("category", "question_count", "action")),
    "offline_pack_download_completed": BusinessRule(
        ("operation_id",), ("category", "question_count", "downloaded_asset_count", "downloaded_bytes", "operation_stage"),
    ),
    "offline_pack_download_cancelled": BusinessRule(
        ("operation_id",), ("category", "question_count", "operation_stage", "error_code"),
    ),
    "offline_pack_download_failed": BusinessRule(
        ("operation_id",), ("category", "question_count", "operation_stage", "operation", "error_code"),
    ),
    "offline_pack_removed": BusinessRule(("operation_id",), ("category",)),
    "progress_reset_started": BusinessRule(("reset_operation_id",), ("source",)),
    "progress_reset_confirmed": BusinessRule(("reset_operation_id",), ("source", "completion_scope")),
    "progress_reset_failed": BusinessRule(("reset_operation_id",), ("source", "error_code")),
}


@dataclass(frozen=True)
class BusinessScope:
    ids: tuple[str, ...]
    events: frozenset[str]
    fields: tuple[str, ...]
    exclusive_terminals: frozenset[str] = frozenset()


SCOPES = {
    "trial_eligibility_request": BusinessScope(
        ("eligibility_request_id",), ELIGIBILITY_EVENTS, REQUEST_FIELDS,
    ),
    "training_session": BusinessScope(
        ("training_session_id",), frozenset({"training_session_started", "training_session_completed"}),
        ("mode", "question_total"),
    ),
    "exam_session": BusinessScope(
        ("exam_session_id",), frozenset({"exam_session_started", "exam_session_completed"}),
        ("mode", "question_total"),
    ),
    "training_answer": BusinessScope(
        ("answer_id",), frozenset({"training_question_answered"}), ("training_session_id", "question_id"),
    ),
    "exam_answer_revision": BusinessScope(
        ("answer_revision_id",), frozenset({"exam_question_answered"}), ("exam_session_id", "answer_id", "question_id"),
    ),
    "purchase_attempt": BusinessScope(
        ("purchase_attempt_id",),
        frozenset({"purchase_started", "purchase_succeeded", "purchase_access_confirmed",
                   "purchase_cancelled", "purchase_failed", "purchase_preparation_failed"}),
        ("product_id", "checkout_view_id", "transaction_id"),
        # Access confirmation is not a second charge or a definitive native outcome.
        frozenset({"purchase_succeeded", "purchase_cancelled", "purchase_failed", "purchase_preparation_failed"}),
    ),
    "restore_attempt": BusinessScope(
        ("restore_attempt_id",), frozenset({"restore_started", "restore_succeeded", "restore_failed"}),
        ("checkout_view_id",), frozenset({"restore_succeeded", "restore_failed"}),
    ),
    "offer_load": BusinessScope(
        ("paywall_view_id", "offer_load_id"),
        frozenset({"paywall_offer_load_started", "paywall_offer_ready", "paywall_offer_failed"}),
        ("offer_request_id", "load_reason"), frozenset({"paywall_offer_ready", "paywall_offer_failed"}),
    ),
    "offline_operation": BusinessScope(
        ("operation_id",),
        frozenset({"offline_pack_download_started", "offline_pack_download_completed", "offline_pack_download_cancelled",
                   "offline_pack_download_failed", "offline_pack_removed"}),
        ("category", "question_count"),
        frozenset({"offline_pack_download_completed", "offline_pack_download_cancelled",
                   "offline_pack_download_failed", "offline_pack_removed"}),
    ),
    "progress_reset": BusinessScope(
        ("reset_operation_id",), frozenset({"progress_reset_started", "progress_reset_confirmed", "progress_reset_failed"}),
        ("source",), frozenset({"progress_reset_confirmed", "progress_reset_failed"}),
    ),
}
NUMBERS = {
    "answered_count", "accepted_unique_question_count", "correct_count", "incorrect_count", "wrong_count",
    "question_total", "score_percent", "score_points", "total_points_target", "scheduled_count",
    "question_count", "downloaded_asset_count", "downloaded_bytes",
    "trial_eligibility_observation_version", "eligibility_requested_product_count",
    "eligibility_distinct_product_count", "eligibility_resolved_product_count", "eligibility_duration_ms",
}
BOOLEANS = {
    "is_correct", "passed", "native_purchase_completed", "entitlement_active", "enabled",
    "eligibility_native_query_invoked",
}
ENUMS = {
    "answer_action": {"create", "update"},
    "learning_outcome_rule_version": {"learning-v1"},
    "flow_context": {"onboarding", "settings", "product"},
    "media_type": {"image", "video", "none"},
    "mode": {"learning", "blitz", "new_questions", "weak_spots", "hard_questions", "high_points",
             "review_due", "seen_not_mastered", "wrong_answers", "saved", "saved_sprint", "exam_tomorrow",
             "mini_test", "initial_diagnostic", "exam"},
}


def _time(value):
    try:
        if not isinstance(value, str):
            return None
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else None
    except (ValueError, TypeError):
        return None


def _field_valid(field, value):
    if value is None:
        return True
    if field in BOOLEANS:
        return type(value) is bool
    if field in NUMBERS:
        return nonnegative_number(value) and (field in {"score_percent", "eligibility_duration_ms"} or type(value) is int)
    if field in ENUMS:
        return isinstance(value, str) and value in ENUMS[field]
    if field.endswith("_at"):
        return _time(value) is not None
    if field == "error_code":
        return safe_identity_id(value) is not None or type(value) is int
    return safe_identity_id(value) is not None


def _body(row):
    p = {key: value for key, value in row.properties.items()
         if not key.startswith(("$", "_warehouse_")) and key != "_export_provider_received_at"}
    return hashlib.sha256(json.dumps(
        [row.event, row.timestamp.astimezone(timezone.utc).isoformat(), row.distinct_id, p], sort_keys=True, default=str,
    ).encode()).hexdigest()


def _first(rows, coordinates):
    moment = min(row.timestamp for row in rows)
    tied = [row for row in rows if row.timestamp == moment]
    positions = {
        (safe_identity_id(row.properties.get("app_run_id")),
         row.properties.get("event_sequence") if type(row.properties.get("event_sequence")) is int else None)
        for row in tied
    }
    if len(positions) == 1:
        return min(tied, key=lambda row: (coordinates[id(row)], row.dump_id)), False
    ordered = next((row for row in tied if all(
        row is other or observed_before(row, other)
        or (row.properties.get("app_run_id"), row.properties.get("event_sequence")) ==
           (other.properties.get("app_run_id"), other.properties.get("event_sequence"))
        for other in tied
    )), None)
    # A deterministic representative does not prove cross-runtime ordering.
    return ordered or min(tied, key=lambda row: (coordinates[id(row)], row.dump_id)), ordered is None


def _business_key(row):
    rule = RULES.get(row.event)
    if not rule:
        return None
    install = safe_identity_id(row.properties.get("app_user_id"))
    ids = tuple(safe_identity_id(row.properties.get(field)) for field in rule.ids)
    return (install, row.event, *ids) if install and all(ids) else None


def _invalid_business(row):
    if row.event in ELIGIBILITY_EVENTS:
        return not valid_eligibility_payload(row.event, row.properties, row.timestamp)
    rule = RULES.get(row.event)
    return bool(rule and (
        any(row.properties.get(field) is not None and safe_identity_id(row.properties[field]) is None
            for field in ("app_user_id", *rule.ids))
        or (_business_key(row) is not None and any(row.properties.get(field) is None for field in rule.required))
        or any(not _field_valid(field, row.properties.get(field)) for field in rule.fields)
    ))


def _conflicting_fields(rows, fields):
    return any(len({
        json.dumps(row.properties[field], sort_keys=True, default=str)
        for row in rows if row.properties.get(field) is not None
    }) > 1 for field in fields)


def _lag(rows):
    counts, buckets = Counter(), Counter()
    delays, proxy_delays, drift = [], [], []
    for row in rows:
        receipt_raw = next((value for value in (
            row.received_at, row.properties.get("_export_provider_received_at"), row.properties.get("$received_at"),
        ) if value is not None), None)
        receipt = _time(receipt_raw)
        client_raw = row.client_occurred_at if row.client_occurred_at is not None else row.properties.get("client_occurred_at")
        client = _time(client_raw)
        if client:
            drift.append(abs((row.timestamp - client).total_seconds()))
            counts["event_client_time_disagreement_rows"] += row.timestamp != client
        elif client_raw is not None:
            counts["invalid_client_occurrence_rows"] += 1
        else:
            counts["client_occurrence_unavailable_rows"] += 1
        if receipt_raw is None:
            counts["receipt_unavailable_rows"] += 1
            continue
        if receipt is None:
            counts["invalid_receipt_rows"] += 1
            continue
        occurred = client or row.timestamp
        delay = (receipt - occurred).total_seconds()
        if delay < 0:
            counts["receipt_precedes_occurrence_rows"] += 1
            continue
        if client:
            delays.append(delay)
            counts["client_occurrence_and_receipt_rows"] += 1
            buckets["under_60s" if delay < 60 else "60s_to_1h" if delay < 3600
                    else "1h_to_24h" if delay < 86400 else "at_least_24h"] += 1
        elif client_raw is None:
            proxy_delays.append(delay)
            counts["provider_event_time_proxy_rows"] += 1
    return {
        "basis": "observed_provider_receipt_minus_client_occurrence",
        "counts": dict(counts), "client_lag_buckets": dict(buckets),
        "median_client_lag_seconds": median(delays) if delays else None,
        "p95_client_lag_seconds": sorted(delays)[ceil(len(delays) * .95) - 1] if delays else None,
        "max_client_lag_seconds": max(delays) if delays else None,
        "median_provider_event_time_proxy_seconds": median(proxy_delays) if proxy_delays else None,
        "max_event_client_time_drift_seconds": max(drift) if drift else None,
        "population": "raw_current_window_observations", "native_delivery": "not_verified", "export_time_is_receipt": False,
        "thresholds_are": "diagnostic_buckets_not_delivery_slo",
    }


def observe_data_quality(rows, *, start, end, history=None, coverage_complete=False, history_scope="supplied_rows_only"):
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("Data-quality report requires ordered timezone-aware window bounds.")
    current = [row for row in rows if start <= row.timestamp < end]
    history = [row for row in (history if history is not None else rows) if row.timestamp < end]
    coordinates = {id(row): (row.event_id, _body(row)) for row in history + current}
    history_coordinates = {coordinates[id(row)] for row in history}
    history.extend(row for row in current if coordinates[id(row)] not in history_coordinates)
    provider, clients, business, scopes = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    invalid, unjoinable = set(), set()
    for row in history:
        provider_id = safe_identity_id(row.event_id)
        client_id = safe_identity_id(row.client_event_id or row.properties.get("event_id"))
        install = safe_identity_id(row.properties.get("app_user_id"))
        if provider_id:
            provider[provider_id].append(row)
        if install and client_id:
            clients[(install, client_id)].append(row)
        key = _business_key(row)
        if row.event in RULES and key is None:
            unjoinable.add(coordinates[id(row)])
        if _invalid_business(row):
            invalid.add(coordinates[id(row)])
        if key:
            business[key].append(row)
        for name, scope in SCOPES.items():
            if row.event not in scope.events:
                continue
            ids = tuple(safe_identity_id(row.properties.get(field)) for field in scope.ids)
            if install and all(ids):
                scopes[(install, name, *ids)].append(row)
    identity_conflicts, identity_duplicates, before_window, uncertain_order = set(), set(), set(), set()
    for groups in (provider, clients):
        for items in groups.values():
            bodies = {coordinates[id(row)][1] for row in items}
            if len(bodies) > 1:
                identity_conflicts.update(coordinates[id(row)] for row in items)
            else:
                first_row, _uncertain = _first(items, coordinates)
                first = coordinates[id(first_row)]
                identity_duplicates.update(coordinates[id(row)] for row in items if coordinates[id(row)] != first)
                if first_row.timestamp < start:
                    before_window.update(coordinates[id(row)] for row in items)
    business_conflicts, business_duplicates = set(), set()
    conflicting_scope_units = 0
    for key, items in scopes.items():
        scope = SCOPES[key[1]]
        if (_conflicting_fields(items, scope.fields)
                or len({row.event for row in items} & scope.exclusive_terminals) > 1):
            business_conflicts.update(coordinates[id(row)] for row in items)
            conflicting_scope_units += 1
    conflicting_business_units = 0
    for key, items in business.items():
        rule = RULES[key[1]]
        if _conflicting_fields(items, rule.fields + rule.compare_only) or any(
            coordinates[id(row)] in invalid or coordinates[id(row)] in identity_conflicts
            or coordinates[id(row)] in business_conflicts
            or any(row.properties.get(marker) is True for marker in (
                "_warehouse_import_conflict", "_warehouse_business_conflict", "_warehouse_business_invalid",
            ))
            for row in items
        ):
            business_conflicts.update(coordinates[id(row)] for row in items)
            conflicting_business_units += 1
        else:
            first_row, uncertain = _first(items, coordinates)
            tied = [row for row in items if row.timestamp == first_row.timestamp]
            snapshots = {
                json.dumps([row.properties.get(field) for field in rule.fields + rule.compare_only], sort_keys=True, default=str)
                for row in tied
            }
            if len(snapshots) > 1 and not all(
                coordinates[id(first_row)] == coordinates[id(other)] or observed_before(first_row, other) for other in tied
            ):
                uncertain = True
            first = coordinates[id(first_row)]
            business_duplicates.update(coordinates[id(row)] for row in items if coordinates[id(row)] != first)
            if first_row.timestamp < start:
                before_window.update(coordinates[id(row)] for row in items)
            if uncertain:
                uncertain_order.update(coordinates[id(row)] for row in items)
    if history_scope == "supplied_rows_only" and any(
        row.properties.get("_warehouse_business_duplicate_before_window") is True for row in current
    ):
        history_scope = "supplied_rows_with_retained_historical_replay_annotations"
    counts = Counter(dict.fromkeys((
        "raw_observation_rows", "analysis_observation_rows", "duplicate_observation_rows", "pre_window_duplicate_rows",
        "import_conflict_rows", "cross_partition_identity_conflict_rows", "conflicting_business_rows",
        "invalid_business_rows", "uncertain_business_order_rows", "invalid_client_payload_rows",
    ), 0))
    by_event = defaultdict(Counter)
    annotated, seen = [], set()
    for row in current:
        coordinate = coordinates[id(row)]
        p = dict(row.properties)
        if coordinate in identity_conflicts:
            p["_warehouse_import_conflict"] = True
            counts["cross_partition_identity_conflict_rows"] += 1
        if coordinate in business_conflicts:
            p["_warehouse_business_conflict"] = True
        if coordinate in invalid:
            p["_warehouse_business_invalid"] = True
        if coordinate in uncertain_order:
            p["_warehouse_business_order_uncertain"] = True
        duplicate = coordinate in identity_duplicates | business_duplicates or coordinate in seen
        if duplicate:
            p["_warehouse_business_duplicate"] = True
        if coordinate in before_window:
            p["_warehouse_business_duplicate_before_window"] = True
        if p.get("_warehouse_business_duplicate_before_window") is True:
            p["_warehouse_business_duplicate"] = True
        seen.add(coordinate)
        annotated.append(replace(row, properties=p))
        counts["raw_observation_rows"] += 1
        counts["duplicate_observation_rows"] += int(p.get("_warehouse_business_duplicate") is True)
        counts["pre_window_duplicate_rows"] += int(p.get("_warehouse_business_duplicate_before_window") is True)
        counts["import_conflict_rows"] += int(p.get("_warehouse_import_conflict") is True)
        counts["invalid_client_payload_rows"] += int(invalid_client_payload(p))
        counts["conflicting_business_rows"] += int(p.get("_warehouse_business_conflict") is True)
        counts["invalid_business_rows"] += int(p.get("_warehouse_business_invalid") is True)
        counts["uncertain_business_order_rows"] += int(p.get("_warehouse_business_order_uncertain") is True)
        if row.event in RULES:
            by_event[row.event]["raw_observations"] += 1
            by_event[row.event]["unjoinable_observations"] += int(coordinate in unjoinable)
            by_event[row.event]["duplicate_observations"] += int(p.get("_warehouse_business_duplicate") is True)
            by_event[row.event]["conflicting_observations"] += int(p.get("_warehouse_business_conflict") is True)
            by_event[row.event]["invalid_observations"] += int(p.get("_warehouse_business_invalid") is True)
            by_event[row.event]["pre_window_duplicates"] += int(p.get("_warehouse_business_duplicate_before_window") is True)
    canonical = canonical_observations(annotated)
    counts["analysis_observation_rows"] = len(canonical)
    counts["usable_analysis_observation_rows"] = sum(observation_usable(row.properties) for row in canonical)
    issues = sum(observation_integrity_issue(row.properties) for row in annotated)
    report = {
        "rule_version": "data-quality-v1", "status": "limited_integrity" if issues else
            "incomplete_coverage" if not coverage_complete else "observed",
        "coverage_complete": coverage_complete, "history_scope": history_scope,
        "raw_observation_basis": "retained_warehouse_rows_after_provider_client_import_merge",
        "historical_delivery_as_of": "not_verified", "counts": dict(counts),
        "conflicting_business_units_in_available_history": conflicting_business_units,
        "conflicting_scope_units_in_available_history": conflicting_scope_units,
        "business_rules": [
            {"event": event, "grain": ["app_user_id", *RULES[event].ids], **dict(values)}
            for event, values in sorted(by_event.items())
        ],
        "quality_issue_count": issues, "receipt_lag": _lag(current),
        "client_payload_validation": payload_validation_report(annotated),
        "must_not_be_interpreted_as": [
            "native_queue_delivery", "complete_installation_history", "historical_delivery_as_of",
            "settled_money", "receipt_from_export_time",
        ],
    }
    return annotated, report


def canonical_observations(rows):
    return [row for row in rows if row.properties.get("_warehouse_business_duplicate") is not True
            and row.properties.get("_warehouse_business_duplicate_before_window") is not True]


def diagnostic_observations(rows):
    """Keep same-window duplicate/conflict evidence, but never replay earlier activity."""
    return [row for row in rows if row.properties.get("_warehouse_business_duplicate_before_window") is not True]


@dataclass(frozen=True)
class _RawObservation:
    event_id: str
    event: str
    timestamp: datetime
    properties: dict
    distinct_id: str | None
    dump_id: str
    client_event_id: object = None
    client_occurred_at: object = None
    received_at: object = None


def observe_raw_data_quality(rows, *, start, end, coverage_complete=False):
    """Annotate source history without depending on interpretation/context models."""
    prepared = []
    for row in rows:
        p = row["properties"]
        p = json.loads(p) if isinstance(p, str) else p
        prepared.append(_RawObservation(
            event_id=str(row.get("event_id") or ""), event=str(row["event"]), timestamp=row["timestamp"],
            properties=p, distinct_id=row.get("distinct_id"), dump_id=str(row.get("dump_id") or ""),
            client_event_id=p.get("event_id"), client_occurred_at=p.get("client_occurred_at"),
            received_at=row.get("received_at"),
        ))
    annotated, report = observe_data_quality(
        prepared, start=start, end=end, coverage_complete=coverage_complete,
        history_scope="available_source_history_rows_not_installation_lifetime",
    )
    current = [row for row in rows if start <= row["timestamp"] < end]
    return [{**raw, "properties": row.properties} for raw, row in zip(current, annotated, strict=True)], report


def warehouse_data_quality(warehouse, rows, *, start, end, prepare, coverage_complete=False):
    days = []
    for path in (warehouse / "events").glob("day=*/events.parquet"):
        try:
            day = datetime.fromisoformat(path.parent.name.removeprefix("day=")).replace(tzinfo=WARSAW)
            if day < end:
                days.append(day)
        except ValueError:
            continue
    if not days:
        return observe_data_quality(rows, start=start, end=end, coverage_complete=coverage_complete)
    history_start = min(days)
    partitions = partition_days(warehouse, history_start, end)
    history = [prepare(raw) for raw in load_events(
        [path for _day, path, _meta in partitions if path is not None], history_start, end,
    )]
    annotated, report = observe_data_quality(
        rows, start=start, end=end, history=history, coverage_complete=coverage_complete,
        history_scope="available_partitions_before_window_end_not_installation_lifetime",
    )
    report["history_available_from"] = history_start.isoformat()
    report["history_partitions_complete"] = bool(partitions) and all(
        path is not None and meta is not None and meta.get("metadata_version") == 2 and meta.get("complete") is True
        for _day, path, meta in partitions
    )
    return annotated, report
