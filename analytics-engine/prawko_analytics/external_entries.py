"""Same-visit external-entry observations, not delivery or causal attribution."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from prawko_analytics.content import revision as fingerprint
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import _parse_timestamp
from prawko_analytics.learning import meaningful_learning
from prawko_analytics.ordering import observed_before as _before
from prawko_analytics.quality import nonnegative_number, observation_usable


ROUTE_SCREENS = {
    "/": "app_entry", "/index": "app_entry", "/(tabs)": "home", "/(tabs)/index": "home",
    "/(tabs)/learn": "learn", "/learn": "learn", "/(tabs)/signs": "signs_home", "/signs": "signs_home",
    "/(tabs)/profile": "profile", "/profile": "profile", "/topics": "topics",
    "/trainer-modes": "trainer_modes", "/question": "question_training", "/practice": "practice",
    "/mistakes": "mistakes", "/exam": "exam_loading", "/exam/session": "exam_session",
    "/exam/result": "exam_result", "/exam/answers": "exam_answers", "/signs/search": "sign_search",
    "/signs/test": "sign_test", "/statistics": "statistics", "/paywall": "paywall",
    "/offline-mode": "offline_mode", "/modals/ai-chat": "ai_chat",
    "/modals/access-center": "access_center", "/modals/plan-adjust": "plan_adjust",
    "/+not-found": "not_found", "/unknown": "not_found", "/topic/[topicId]": "topic_detail",
    "/signs/category/[categoryId]/test": "sign_test", "/signs/category/[categoryId]": "sign_category",
    "/signs/[signId]/practice": "sign_practice", "/signs/[signId]": "sign_detail",
}
for _path, _screen in (
    ("language", "onboarding_language"), ("exam-country", "exam_country"), ("category", "onboarding_category"),
    ("exam-schedule", "onboarding_exam_schedule"), ("notifications", "onboarding_notifications"),
    ("minutes", "onboarding_minutes"), ("level", "onboarding_level"), ("school-code", "onboarding_school_code"),
    ("access", "onboarding_access"), ("preview", "onboarding_preview"),
):
    ROUTE_SCREENS[f"/{_path}"] = ROUTE_SCREENS[f"/(onboarding)/{_path}"] = _screen

SOURCE_EVENTS = {"app_entry_resolved", "notification_opened"}
DESTINATION_EVENTS = {"external_entry_destination_observed", "external_entry_destination_ended", "external_entry_ended"}
SCOPES = {
    "bound_visit", "awaiting_foreground", "cached_unattributed", "processing_visit_changed",
    "signal_horizon_elapsed", "observation_clock_invalid",
}
END_REASONS = {
    "superseded", "superseded_by_unobserved_signal", "superseded_by_unattributed_signal", "visit_changed",
    "visit_background", "observer_unmount", "foreground_not_observed", "observation_clock_invalid",
    "association_horizon_elapsed",
}
KNOWN_CLOSURES = END_REASONS - {"observer_unmount", "observation_clock_invalid", "foreground_not_observed"}
TARGET_BASES = {
    "normalized_static_route", "normalized_entity_id", "entity_unverified", "conflicting_entity_ids",
    "root_redirect", "unknown_route", "malformed_url", "notification_target_unspecified",
}
IMMUTABLE_FIELDS = (
    "entry_kind", "entry_signal_origin", "entry_signal_received_at", "entry_observed_at",
    "entry_target_route_pattern", "entry_target_screen_name", "entry_target_entity_revision",
    "entry_target_entity_required", "entry_target_basis", "notification_response_revision",
)


def _first(rows):
    moment = min(row.timestamp for row in rows)
    tied = [row for row in rows if row.timestamp == moment]
    return next((row for row in tied if all(row is other or _before(row, other) for other in tied)), tied[0])


def _timestamp(value):
    try:
        if not isinstance(value, str):
            return None
        if datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
            return None
        parsed = _parse_timestamp(value)
        return parsed if parsed.tzinfo is not None else None
    except (ValueError, TypeError, AttributeError):
        return None


def _route_key(route):
    key = re.sub(r"^/\((?:tabs|onboarding)\)(?=/|$)", "", route)
    return "/" if key in ("", "/index") else key


def _record(row):
    p = row.properties
    install, entry = safe_identity_id(p.get("app_user_id")), safe_identity_id(p.get("entry_observation_id"))
    received, observed = _timestamp(p.get("entry_signal_received_at")), _timestamp(p.get("entry_observed_at"))
    kind, origin, scope = p.get("entry_kind"), p.get("entry_signal_origin"), p.get("entry_scope_status")
    visit = safe_identity_id(p.get("entry_bound_app_visit_id"))
    route, screen, basis = p.get("entry_target_route_pattern"), p.get("entry_target_screen_name"), p.get("entry_target_basis")
    entity, response = fingerprint(p.get("entry_target_entity_revision")), fingerprint(p.get("notification_response_revision"))
    required = p.get("entry_target_entity_required")
    if not (
        observation_usable(p) and type(p.get("entry_observation_version")) is int and p["entry_observation_version"] == 1
        and install and entry and received and observed and received <= observed <= row.timestamp
        and p.get("entry_observation_time_basis") == "client_signal_processing_not_tap"
        and type(p.get("entry_destination_horizon_seconds")) is int and p["entry_destination_horizon_seconds"] == 60
        and type(p.get("entry_association_horizon_seconds")) is int and p["entry_association_horizon_seconds"] == 3600
        and isinstance(scope, str) and scope in SCOPES and type(required) is bool
        and isinstance(basis, str) and basis in TARGET_BASES
        and ((scope == "bound_visit" and visit) or (scope != "bound_visit" and p.get("entry_bound_app_visit_id") is None))
        and ((kind == "deep_link" and origin in ("initial_url", "live_url") and p.get("notification_response_revision") is None)
             or (kind == "notification" and origin in ("live_os_response", "cached_os_response") and response))
        and (origin != "cached_os_response" or scope == "cached_unattributed")
        and (scope != "cached_unattributed" or origin == "cached_os_response")
    ):
        return None
    if basis in ("unknown_route", "malformed_url", "notification_target_unspecified"):
        if route is not None or screen is not None or required or p.get("entry_target_entity_revision") is not None:
            return None
    elif not isinstance(route, str) or route not in ROUTE_SCREENS or screen != ROUTE_SCREENS[route]:
        return None
    if kind == "notification" and basis != "notification_target_unspecified":
        return None
    if kind == "deep_link" and basis == "notification_target_unspecified":
        return None
    if row.event == "notification_opened" and kind != "notification":
        return None
    if row.event in SOURCE_EVENTS and p.get("entry_reason") is not None and p["entry_reason"] != kind:
        return None
    if row.event in SOURCE_EVENTS and kind == "notification" and p.get("cached_response") is not None:
        if type(p["cached_response"]) is not bool or p["cached_response"] != (origin == "cached_os_response"):
            return None
    if basis == "normalized_entity_id" and not (required and entity):
        return None
    if basis != "normalized_entity_id" and p.get("entry_target_entity_revision") is not None:
        return None
    if basis == "normalized_static_route" and (required or "[" in route):
        return None
    if basis in ("entity_unverified", "conflicting_entity_ids") and not required:
        return None
    if basis == "root_redirect" and route not in ("/", "/index"):
        return None
    if row.event in DESTINATION_EVENTS:
        elapsed = p.get("entry_elapsed_ms")
        if elapsed is not None and not nonnegative_number(elapsed):
            return None
        if row.event == "external_entry_ended" and not (
            isinstance(p.get("entry_end_reason"), str) and p["entry_end_reason"] in END_REASONS
        ):
            return None
        if row.event == "external_entry_destination_ended" and not (
            isinstance(p.get("entry_destination_end_reason"), str)
            and p["entry_destination_end_reason"] in END_REASONS | {"destination_horizon_elapsed", "observation_limit"}
            and (p.get("entry_destination_target_observed") is None
                 or type(p["entry_destination_target_observed"]) is bool)
            and type(p.get("entry_destination_usable_observed")) is bool
        ):
            return None
    return {"install": install, "entry": entry, "visit": visit, "scope": scope, "received": received}


def _bound(row, key, visit):
    p = row.properties
    return (
        observation_usable(p) and safe_identity_id(p.get("app_user_id")) == key[0]
        and safe_identity_id(p.get("entry_observation_id")) == key[1]
        and p.get("entry_scope_status") == "bound_visit"
        and safe_identity_id(p.get("entry_bound_app_visit_id")) == visit
        and safe_identity_id(p.get("app_visit_id")) == visit and p.get("app_visibility") == "active"
    )


def _destination(row, source):
    p, target = row.properties, source.properties
    route, screen = p.get("entry_destination_route_pattern"), p.get("entry_destination_screen_name")
    entity = fingerprint(p.get("entry_destination_entity_revision"))
    if (
        not isinstance(route, str) or route not in ROUTE_SCREENS or screen != ROUTE_SCREENS[route]
        or screen == "app_entry"
        or (p.get("entry_destination_entity_revision") is not None and entity is None)
        or p.get("entry_destination_phase") not in ("route", "loading", "usable", "blocked", "error", "other")
        or p.get("entry_destination_basis") not in
            ("preexisting_route_snapshot", "foreground_route_transition", "foreground_view_state")
    ):
        return None
    expected = (
        "target_unspecified" if target["entry_target_basis"] == "notification_target_unspecified" else
        "redirect_landing" if target["entry_target_basis"] == "root_redirect" else
        "target_unknown" if target["entry_target_route_pattern"] is None else
        "different_route" if _route_key(target["entry_target_route_pattern"]) != _route_key(route) else
        "static_route" if not target["entry_target_entity_required"] else
        "entity_unverified" if not target["entry_target_entity_revision"] or not entity else
        "route_and_entity" if target["entry_target_entity_revision"] == entity else "different_entity"
    )
    return (
        route, entity, p["entry_destination_phase"], expected, p["entry_destination_basis"],
    ) if p.get("entry_destination_match") == expected else None


def _learning_rows(rows, quality):
    answers, completions = defaultdict(list), defaultdict(list)
    for row in rows:
        p = row.properties
        if row.event not in ("training_question_answered", "exam_question_answered",
                             "training_session_completed", "exam_session_completed"):
            continue
        kind = "training" if row.event.startswith("training_") else "exam"
        install, session = safe_identity_id(p.get("app_user_id")), safe_identity_id(p.get(f"{kind}_session_id"))
        if not install or not session or not observation_usable(p):
            quality["invalid_learning_observations"] += 1
            continue
        if row.event.endswith("_completed"):
            counts = ("accepted_unique_question_count",) if kind == "training" else ("answered_count", "question_total")
            if p.get("learning_outcome_rule_version") != "learning-v1" or any(
                type(p.get(field)) is not int or p[field] < 0 for field in counts
            ):
                quality["invalid_learning_observations"] += 1
                continue
            completions[(install, kind, session)].append(row)
        else:
            answer, question = safe_identity_id(p.get("answer_id")), safe_identity_id(p.get("question_id"))
            if not answer or not question or type(p.get("is_correct")) is not bool:
                quality["invalid_learning_observations"] += 1
                continue
            if kind == "exam" and p.get("answer_action") != "create":
                if p.get("answer_action") != "update":
                    quality["invalid_learning_observations"] += 1
                continue
            if kind == "exam" and not safe_identity_id(p.get("answer_revision_id")):
                quality["invalid_learning_observations"] += 1
                continue
            answers[(install, kind, session, answer)].append(row)
    accepted, completed = [], []
    for groups, output, fields in (
        (answers, accepted, ("question_id", "is_correct", "answer_revision_id")),
        (completions, completed, ("learning_outcome_rule_version", "completion_status", "accepted_unique_question_count",
                                   "answered_count", "question_total")),
    ):
        for _key, observations in groups.items():
            signatures = {json.dumps([row.properties.get(field) for field in fields], sort_keys=True) for row in observations}
            quality["duplicate_learning_observations"] += len(observations) - 1
            if len(signatures) != 1:
                quality["conflicting_learning_units"] += 1
                continue
            output.append(_first(observations))
    return accepted, completed


def external_entry_report(rows, *, start, end, coverage_complete=False):
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("External-entry report requires ordered timezone-aware window bounds.")
    rows = [row for row in rows if start <= row.timestamp < end]
    quality = Counter()
    sources, linked, invalid_scopes = defaultdict(list), defaultdict(list), set()
    for row in rows:
        p = row.properties
        if p.get("entry_observation_version") is None:
            if row.event in SOURCE_EVENTS:
                quality["legacy_source_observations"] += 1
            continue
        record = _record(row)
        if record is None:
            quality["invalid_entry_observations"] += 1
            key = (safe_identity_id(p.get("app_user_id")), safe_identity_id(p.get("entry_observation_id")))
            if all(key):
                invalid_scopes.add(key)
            continue
        key = (record["install"], record["entry"])
        linked[key].append(row)
        if row.event in SOURCE_EVENTS:
            sources[key].append(row)
    accepted, completed = _learning_rows(rows, quality) if sources else ([], [])
    visit_rows, completion_rows, answer_rows = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in rows:
        visit_rows[(safe_identity_id(row.properties.get("app_user_id")),
                    safe_identity_id(row.properties.get("app_visit_id")))].append(row)
    for row in completed:
        completion_rows[(safe_identity_id(row.properties.get("app_user_id")),
                         safe_identity_id(row.properties.get("entry_observation_id")))].append(row)
    for row in accepted:
        kind = "training" if row.event.startswith("training_") else "exam"
        answer_rows[(safe_identity_id(row.properties.get("app_user_id")),
                     kind, row.properties[f"{kind}_session_id"])].append(row)
    outcomes, scope_counts, destinations, kinds, notification_scopes = Counter(), Counter(), Counter(), Counter(), Counter()
    terminals, censor_reasons = Counter(), Counter()
    source_units = bound_units = mature = censored = achieved = observed_achieved = quarantined = 0
    for key, observations in sources.items():
        quality["duplicate_source_observations"] += len(observations) - 1
        signatures = {json.dumps([row.properties.get(field) for field in IMMUTABLE_FIELDS]) for row in linked[key]}
        visits = {row.properties["entry_bound_app_visit_id"] for row in linked[key]
                  if row.properties.get("entry_scope_status") == "bound_visit"}
        scopes = {row.properties["entry_scope_status"] for row in linked[key]}
        if len(signatures) != 1 or len(visits) > 1 or key in invalid_scopes or (
            scopes - {"awaiting_foreground", "bound_visit"} and len(scopes) > 1
        ):
            quality["conflicting_entry_units"] += 1
            quarantined += 1
            continue
        source = _first(observations)
        p, record = source.properties, _record(source)
        source_units += 1
        kinds[p["entry_kind"]] += 1
        for row in linked[key]:
            if row.event == "external_entry_destination_ended":
                terminals[row.properties["entry_destination_end_reason"]] += 1
        visit = next(iter(visits), None)
        if visit and record["scope"] == "awaiting_foreground":
            bindings = [row for row in linked[key] if row.properties.get("entry_scope_status") == "bound_visit"]
            if (_first(bindings).timestamp - record["received"]).total_seconds() >= 60:
                quality["late_foreground_binding_units"] += 1
                visit = None
        scope_counts["bound_visit" if visit else record["scope"]] += 1
        if not visit:
            outcomes[record["scope"]] += 1
            continue
        bound_units += 1
        horizon = record["received"] + timedelta(hours=1)
        closes = [row for row in linked[key] if row.event == "external_entry_ended"
                  and row.properties.get("entry_end_reason") in KNOWN_CLOSURES and _before(source, row)]
        closes += [row for row in visit_rows[(key[0], visit)] if row.event == "app_visit_ended"
                   and observation_usable(row.properties) and _before(source, row)]
        close = _first(closes) if closes else None
        cutoff = min(horizon, close.timestamp) if close else horizon
        censor_ends = [row for row in linked[key] if row.event == "external_entry_ended"
                       and row.properties.get("entry_end_reason") in ("observer_unmount", "observation_clock_invalid")
                       and _before(source, row) and row.timestamp < cutoff]
        checkpoints = [row for row in visit_rows[(key[0], visit)] if row.event == "app_visit_checkpoint"
                       and observation_usable(row.properties) and row.timestamp >= horizon]
        is_mature = not censor_ends and (close is not None or horizon <= end and bool(checkpoints))
        observation_stops = ([close] if close else []) + censor_ends
        observation_stop = _first(observation_stops) if observation_stops else None
        destination_stops = [row for row in linked[key] if row.event == "external_entry_destination_ended"
                             and _before(source, row)] + ([observation_stop] if observation_stop else [])
        destination_stop = _first(destination_stops) if destination_stops else None
        seen_destinations = set()
        usable = target_seen = False
        for row in linked[key]:
            if row.event != "external_entry_destination_observed":
                continue
            destination = _destination(row, source)
            age = (row.timestamp - record["received"]).total_seconds()
            if not (destination and _before(source, row) and _bound(row, key, visit) and 0 <= age < 60
                    and row.timestamp < horizon and (destination_stop is None or _before(row, destination_stop))):
                quality["invalid_destination_observations"] += 1
                continue
            dedupe = destination[:4]
            if dedupe in seen_destinations:
                quality["duplicate_destination_observations"] += 1
                continue
            seen_destinations.add(dedupe)
            route, _entity, phase, match, basis = destination
            destinations[(route, phase, match, basis)] += 1
            matched = match in ("static_route", "route_and_entity", "redirect_landing")
            target_seen |= matched
            usable |= phase == "usable" and (matched or match == "target_unspecified")
        outcomes["usable_destination_observed" if usable else "target_route_observed" if target_seen
                 else "destination_unobserved"] += 1
        if p["entry_kind"] != "notification":
            continue
        notification_scopes[(key[0], p["notification_response_revision"], visit)] += 1
        mature += int(is_mature)
        censored += int(not is_mature)
        if not is_mature:
            censor_reasons[_first(censor_ends).properties["entry_end_reason"] if censor_ends else
                          "report_window" if horizon > end else "unknown_visit_tail"] += 1
        found = False
        for done in completion_rows[key]:
            if not (meaningful_learning(done) and _before(source, done) and _bound(done, key, visit)
                    and done.timestamp < horizon and (observation_stop is None or _before(done, observation_stop))):
                continue
            kind = "training" if done.event.startswith("training_") else "exam"
            session = done.properties[f"{kind}_session_id"]
            starts = [row for row in linked[key] if row.event in (f"{kind}_session_started", f"{kind}_session_resumed")
                      and row.properties.get(f"{kind}_session_id") == session and _bound(row, key, visit)
                      and _before(source, row) and _before(row, done)]
            if any(
                answer.properties.get(f"{kind}_session_id") == session and _bound(answer, key, visit)
                and _before(source, answer) and _before(answer, done)
                and any(_before(begin, answer) for begin in starts)
                for answer in answer_rows[(key[0], kind, session)]
            ):
                found = True
                break
        achieved += int(found and is_mature)
        observed_achieved += int(found)
        quality["censored_learning_achievements"] += int(found and not is_mature)
    quality["orphan_entry_observations"] = sum(len(items) for key, items in linked.items() if key not in sources)
    quality["duplicate_notification_business_scopes"] = sum(count - 1 for count in notification_scopes.values())
    issue_count = sum(quality[key] for key in (
        "invalid_entry_observations", "conflicting_entry_units", "invalid_destination_observations",
        "invalid_learning_observations", "conflicting_learning_units", "orphan_entry_observations",
        "late_foreground_binding_units", "duplicate_notification_business_scopes",
    ))
    rate_allowed = coverage_complete and not issue_count and mature > 0
    return {
        "rule_version": "external-entry-v1", "grain": "installation_entry_observation_bound_visit",
        "status": "limited_integrity" if issue_count else "not_observed" if not sources
                  else "incomplete_coverage" if not coverage_complete else "observed",
        "coverage_complete": coverage_complete, "source_units": source_units, "bound_units": bound_units,
        "quarantined_units": quarantined, "kinds": dict(kinds), "scopes": dict(scope_counts), "outcomes": dict(outcomes),
        "destinations": [
            dict(zip(("route_pattern", "phase", "match", "basis"), key), observations=count)
            for key, count in sorted(destinations.items())
        ],
        "destination_terminal_observations": dict(terminals),
        "notification_learning": {
            "rule_version": "learning-v1", "association_horizon_seconds": 3600,
            "mature_units": mature, "censored_units": censored, "mature_achieved_units": achieved,
            "observed_achieved_units": observed_achieved, "censor_reasons": dict(censor_reasons),
            "mature_learning_fraction": achieved / mature if rate_allowed else None,
            "confidence_ceiling": "low", "time_basis": "client_signal_processing_not_tap",
        },
        "quality": dict(quality), "quality_issue_count": issue_count,
        "must_not_be_interpreted_as": [
            "notification_delivery", "dispatcher_success", "native_rendering_success", "causal_reminder_lift",
            "acquisition_attribution", "new_learning_from_old_result",
        ],
    }
