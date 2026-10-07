"""Declared content provenance and persisted exam rules, never language detection."""

from __future__ import annotations

import re
from collections import Counter, defaultdict

from prawko_analytics.identity import safe_identity_id
from prawko_analytics.quality import nonnegative_number, observation_usable


CONTENT_LOCALES = {"pl", "ua", "en", "de", "cs", "el", "sk"}
REQUESTED_LOCALES = CONTENT_LOCALES | {"es"}
SOURCE_KINDS = {"question_content", "ai_explanation", "legacy_explanation"}
SOURCE_BASES = {
    "no_text", "not_recorded", "mapper_fallback_provenance",
    "provenance_revision_mismatch", "unverified_mapper_output", "observation_failed",
}
CONTENT_EVENTS = {
    "training_question_viewed", "training_question_answered",
    "exam_question_viewed", "exam_question_answered", "answer_explanation_viewed",
    "training_answers_review_question_viewed", "exam_answers_review_question_viewed",
    "question_problem_report_requested", "question_bookmark_changed", "premium_gate_viewed",
}
EXAM_EVENTS = {
    "exam_session_started", "exam_session_resumed", "exam_session_completed", "exam_session_ended",
    "exam_question_viewed", "exam_question_answered", "exam_answers_review_question_viewed",
    "exam_result_viewed", "exam_empty_exit",
}
CONTENT_FIELDS = (
    "question_id", "question_revision", "explanation_revision", "content_requested_locale",
    "content_text_field", "content_source_language", "content_source_kind", "content_source_language_basis",
    "explanation_text_field", "explanation_source_language", "explanation_source_kind",
    "explanation_source_language_basis", "choice_source_languages", "choice_unknown_source_count",
)
DISPLAY_FIELDS = (
    "question_id", "question_revision", "explanation_revision", "content_requested_locale",
    "explanation_text_field", "explanation_source_language", "explanation_source_language_basis",
    "explanation_display_revision", "explanation_display_variant", "explanation_rendered_state",
    "explanation_display_matches_selected_field",
)
RULE_FIELDS = (
    "exam_session_rules_revision", "exam_origin_profile_revision", "exam_origin_profile_basis",
    "exam_origin_country", "exam_origin_category", "exam_origin_mode", "exam_origin_question_total",
    "exam_origin_total_points", "exam_origin_pass_points", "exam_origin_duration_seconds", "exam_origin_navigation",
)


def revision(value) -> str | None:
    return value if isinstance(value, str) and re.fullmatch(r"content-v1:[a-f0-9]{16}", value) else None


def _member(value, choices: set) -> bool:
    return isinstance(value, str) and value in choices


def _version(value) -> bool:
    return type(value) is int and value == 1


def _number(value, *, positive=False) -> bool:
    return nonnegative_number(value) and (not positive or value > 0)


def _source_valid(props: dict, prefix: str) -> bool:
    if not all(f"{prefix}_{suffix}" in props for suffix in (
        "text_field", "source_language", "source_kind", "source_language_basis", "language",
    )):
        return False
    field = props.get(f"{prefix}_text_field")
    language = props.get(f"{prefix}_source_language")
    kind = props.get(f"{prefix}_source_kind")
    basis = props.get(f"{prefix}_source_language_basis")
    if not _member(basis, SOURCE_BASES) or field != props.get(f"{prefix}_language"):
        return False
    if basis == "mapper_fallback_provenance":
        return _member(field, CONTENT_LOCALES) and _member(language, CONTENT_LOCALES) and _member(kind, SOURCE_KINDS)
    if language is not None or kind is not None:
        return False
    return field is None if basis == "no_text" else (
        _member(field, CONTENT_LOCALES) and basis != "observation_failed"
    )


def content_record(props: dict) -> dict | None:
    """Return only bounded declared metadata. Old/failed observations are not inferred."""
    if not (
        observation_usable(props) and _version(props.get("content_provenance_version"))
        and props.get("content_observation_status") == "observed"
        and props.get("content_revision_algorithm") == "content-v1"
        and props.get("content_language_basis") == "selected_text_field"
        and props.get("content_source_language_verification") == "declared_input_locale_not_language_detection"
        and safe_identity_id(props.get("app_user_id")) and safe_identity_id(props.get("question_id"))
        and all(key in props for key in CONTENT_FIELDS)
        and revision(props.get("question_revision")) and revision(props.get("explanation_revision"))
        and _member(props.get("content_requested_locale"), REQUESTED_LOCALES)
        and _source_valid(props, "content") and _source_valid(props, "explanation")
        and type(props.get("choice_unknown_source_count")) is int and props["choice_unknown_source_count"] >= 0
    ):
        return None
    choices = props.get("choice_source_languages")
    if choices is not None:
        if not isinstance(choices, str):
            return None
        languages = choices.split(",")
        if not all(_member(language, CONTENT_LOCALES) for language in languages) or languages != sorted(set(languages)):
            return None
    return {key: props.get(key) for key in CONTENT_FIELDS}


def display_record(props: dict) -> dict | None:
    if not (
        observation_usable(props) and _version(props.get("explanation_display_observation_version"))
        and safe_identity_id(props.get("app_user_id")) and safe_identity_id(props.get("question_id"))
        and all(key in props for key in (
            "explanation_display_variant", "explanation_rendered_state", "explanation_display_revision",
            "explanation_display_revision_basis", "explanation_display_matches_selected_field",
        ))
        and _member(props.get("explanation_display_variant"), {"full", "free_topic_marked", "locked"})
    ):
        return None
    variant = props["explanation_display_variant"]
    state = props.get("explanation_rendered_state")
    basis = props.get("explanation_display_revision_basis")
    value = props.get("explanation_display_revision")
    matches = props.get("explanation_display_matches_selected_field")
    if state == "not_observed":
        valid = basis == "observation_failed" and value is None and matches is None
    elif state == "locked":
        valid = variant == "locked" and basis == "rendered_text_value" and value is None and matches is None
    else:
        valid = variant != "locked" and basis == "rendered_text_value" and type(matches) is bool and (
            (state == "text" and revision(value) is not None) or (state == "empty" and value is None)
        )
    if not valid:
        return None
    content = content_record(props)
    # A display observation is still observable when old/failed source metadata is unknown.
    return {
        **{key: content.get(key) if content else None for key in DISPLAY_FIELDS},
        "question_id": props["question_id"],
        **{key: props.get(key) for key in DISPLAY_FIELDS if key.startswith("explanation_display_")},
        "explanation_rendered_state": state,
    }


def exam_rule_record(props: dict) -> dict | None:
    if not (
        observation_usable(props) and _version(props.get("exam_rules_observation_version"))
        and safe_identity_id(props.get("app_user_id")) and safe_identity_id(props.get("exam_session_id"))
        and props.get("exam_session_rules_status") == "observed"
        and props.get("exam_session_rules_revision_basis") == "persisted_session_parameters"
        and revision(props.get("exam_session_rules_revision"))
        and all(key in props for key in RULE_FIELDS)
    ):
        return None
    origin_basis = props.get("exam_origin_profile_basis")
    origin_revision = props.get("exam_origin_profile_revision")
    if origin_basis == "persisted_creation_profile":
        if not revision(origin_revision):
            return None
    elif not _member(origin_basis, {"not_recorded", "origin_parameters_unverified"}) or origin_revision is not None:
        return None
    country = props.get("exam_origin_country")
    category = props.get("exam_origin_category")
    mode = props.get("exam_origin_mode")
    total = props.get("exam_origin_question_total")
    points = props.get("exam_origin_total_points")
    passed = props.get("exam_origin_pass_points")
    duration = props.get("exam_origin_duration_seconds")
    navigation = props.get("exam_origin_navigation")
    if not (
        (country is None or _member(country, {"PL", "CZ", "SK"}))
        and _member(category, {"AM", "A1", "A2", "A", "B1", "B", "C1", "C", "D1", "D", "T"})
        and _member(mode, {"exam", "mini_test", "exam_tomorrow"})
        and _number(total, positive=True) and _number(points, positive=True) and _number(passed) and passed <= points
        and (duration is None or _number(duration))
        and (navigation is None or _member(navigation, {"forward_only", "free"}))
    ):
        return None
    return {key: props.get(key) for key in RULE_FIELDS}


def _groups(records: list[tuple], fields: tuple, *, sessions=False) -> list[dict]:
    buckets = {}
    for record, install, event, session in records:
        key = tuple(record.get(field) for field in fields)
        bucket = buckets.setdefault(key, {"events": Counter(), "installs": set(), "sessions": set()})
        bucket["events"][event] += 1
        bucket["installs"].add(install)
        if session:
            bucket["sessions"].add((install, session))
    return [{
        **dict(zip(fields, key)), "event_rows": sum(bucket["events"].values()),
        "installations": len(bucket["installs"]), "event_counts": dict(sorted(bucket["events"].items())),
        **({"sessions": len(bucket["sessions"])} if sessions else {}),
    } for key, bucket in sorted(buckets.items(), key=lambda pair: repr(pair[0]))]


def content_observations_report(rows, *, coverage_complete: bool = False) -> dict:
    provenance = Counter()
    displays = Counter()
    rules = Counter()
    records = []
    rendered = []
    rule_records = []
    source_signatures = defaultdict(set)
    session_signatures = defaultdict(set)
    profile_signatures = defaultdict(set)
    invalid_sessions = set()
    unobserved_rules = Counter()
    for row in rows:
        props = row.properties
        install = safe_identity_id(props.get("app_user_id"))
        session = safe_identity_id(props.get("exam_session_id"))
        if row.event in CONTENT_EVENTS and (
            "question_id" in props or "content_provenance_version" in props
        ):
            if "content_provenance_version" not in props:
                provenance["legacy_events"] += 1
            elif props.get("content_observation_status") == "failed" and _version(props.get("content_provenance_version")) and observation_usable(props):
                provenance["failed_observations"] += 1
            else:
                record = content_record(props)
                if record is None:
                    provenance["invalid_observations"] += 1
                else:
                    records.append((record, install, row.event, session))
                    provenance["observed_events"] += 1
                    for prefix in ("content", "explanation"):
                        language = record[f"{prefix}_source_language"]
                        field = record[f"{prefix}_text_field"]
                        basis = record[f"{prefix}_source_language_basis"]
                        provenance[f"unknown_{prefix}_source_rows"] += language is None
                        provenance[f"{prefix}_source_field_difference_rows"] += language is not None and language != field
                        provenance["stale_provenance_rows"] += basis == "provenance_revision_mismatch"
                        if language is not None:
                            key = (
                                record["question_id"], record["question_revision"],
                                record["explanation_revision"] if prefix == "explanation" else None, field, prefix,
                            )
                            source_signatures[key].add((language, record[f"{prefix}_source_kind"]))
        if row.event in CONTENT_EVENTS and "explanation_display_observation_version" in props:
            record = display_record(props)
            if record is None:
                displays["invalid_observations"] += 1
            else:
                rendered.append((record, install, row.event, session))
                displays["observed_events"] += 1
                displays["source_metadata_unknown_rows"] += record["question_revision"] is None
                displays["rendered_variant_differs_rows"] += record["explanation_display_matches_selected_field"] is False
                displays["failed_observations"] += record["explanation_rendered_state"] == "not_observed"
        if row.event in EXAM_EVENTS or (session and "exam_rules_observation_version" in props):
            if "exam_rules_observation_version" not in props:
                rules["legacy_events"] += 1
                continue
            state = props.get("exam_session_rules_status")
            if state in ("snapshot_not_cached", "observation_failed", "invalid_parameters") and (
                observation_usable(props) and _version(props.get("exam_rules_observation_version"))
                and install and session and props.get("exam_session_rules_revision") is None
                and props.get("exam_origin_profile_revision") is None
                and _member(props.get("exam_origin_profile_basis"), {"not_recorded", "origin_parameters_unverified"})
                and props.get("exam_session_rules_revision_basis") == (
                    "persisted_session_parameters" if state == "invalid_parameters" else "unavailable"
                )
            ):
                unobserved_rules[state] += 1
                continue
            record = exam_rule_record(props)
            if record is None:
                rules["invalid_observations"] += 1
                if install and session:
                    invalid_sessions.add((install, session))
            else:
                rule_records.append((
                    record, install, row.event if row.event in EXAM_EVENTS | CONTENT_EVENTS else "other_exam_observation", session,
                ))
                scope = (install, session)
                session_signatures[scope].add(tuple(record[key] for key in RULE_FIELDS if not key.startswith("exam_origin_profile_")))
                if record["exam_origin_profile_revision"]:
                    profile_signatures[scope].add(record["exam_origin_profile_revision"])
                rules["origin_profile_unknown_rows"] += record["exam_origin_profile_revision"] is None
    conflicts = {
        scope for scope, signatures in session_signatures.items()
        if len(signatures) > 1 or len(profile_signatures[scope]) > 1
    }
    quarantined = conflicts | invalid_sessions
    clean_rules = [entry for entry in rule_records if (entry[1], entry[3]) not in quarantined]
    provenance["conflicting_source_bindings"] = sum(len(signatures) > 1 for signatures in source_signatures.values())
    rules["conflicting_sessions"] = len(conflicts)
    rules["quarantined_sessions"] = len(quarantined)
    rules["quarantined_parameter_rows"] = len(rule_records) - len(clean_rules)
    rules["observed_parameter_rows"] = len(clean_rules)
    problems = (
        provenance["invalid_observations"] + provenance["failed_observations"]
        + provenance["stale_provenance_rows"] + provenance["conflicting_source_bindings"]
        + displays["invalid_observations"] + displays["failed_observations"]
        + rules["invalid_observations"] + rules["quarantined_sessions"]
    )
    count = len(records) + len(rendered) + len(rule_records)
    incomplete_metadata = (
        provenance["legacy_events"] + provenance["unknown_content_source_rows"]
        + provenance["unknown_explanation_source_rows"] + displays["source_metadata_unknown_rows"]
        + rules["legacy_events"] + rules["origin_profile_unknown_rows"] + sum(unobserved_rules.values())
    )
    return {
        "observation_version": 1,
        "status": "not_observed" if not count and not problems else (
            "limited" if problems or incomplete_metadata or not coverage_complete else "observed"
        ),
        "grain": "bounded_content_event_observation", "identity_grain": "app_user_id_installation",
        "coverage_complete": coverage_complete,
        "quality_issue_count": problems,
        "provenance": {
            **{key: provenance[key] for key in (
                "observed_events", "legacy_events", "failed_observations", "invalid_observations",
                "unknown_content_source_rows", "unknown_explanation_source_rows",
                "content_source_field_difference_rows", "explanation_source_field_difference_rows",
                "stale_provenance_rows", "conflicting_source_bindings",
            )},
            "groups": _groups(records, CONTENT_FIELDS),
        },
        "explanations": {
            **{key: displays[key] for key in (
                "observed_events", "invalid_observations", "failed_observations",
                "source_metadata_unknown_rows", "rendered_variant_differs_rows",
            )},
            "groups": _groups(rendered, DISPLAY_FIELDS),
        },
        "exam_rules": {
            **{key: rules[key] for key in (
                "observed_parameter_rows", "legacy_events", "origin_profile_unknown_rows", "invalid_observations",
                "conflicting_sessions", "quarantined_sessions", "quarantined_parameter_rows",
            )},
            "unobserved_status_counts": dict(sorted(unobserved_rules.items())),
            "binding_basis": "installation_scoped_client_declared_persisted_parameters",
            "groups": _groups(clean_rules, RULE_FIELDS, sessions=True),
        },
        "limitations": [
            "Source language is declared mapper provenance, not linguistic detection or proof of a translation.",
            "Fingerprints are non-security comparisons, not server revision provenance or verification of media bytes.",
            "Selected locale fields and rendered explanation values remain separate; locked/empty are not text exposure.",
            "Current exam_rules_revision and current app category are never historical origin evidence.",
            "Exam bindings check consistency within available installation/session observations, not lifetime history.",
            "Unknown origins are not backfilled even when another event in the session records a profile.",
            "Counts are observations, not complete accuracy/report rates, verified delivery or causal learning effects.",
        ],
    }
