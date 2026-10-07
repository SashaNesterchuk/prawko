"""Persistent onboarding and first-observed activation; never physical installs."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from statistics import median

from prawko_analytics.acquisition import _anchors, _application_scope, _install, _learning_issue, _moment
from prawko_analytics.client_source import application_covered, available_client_history
from prawko_analytics.data_quality import canonical_observations, observe_data_quality
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import WARSAW
from prawko_analytics.learning import meaningful_learning
from prawko_analytics.ordering import observed_before
from prawko_analytics.quality import nonnegative_number, observation_usable

RULE = "onboarding-activation-v1"
FLOW = {"onboarding_flow_viewed", "onboarding_flow_completed", "onboarding_home_arrived"}
OUTCOMES = {"training_session_completed", "exam_session_completed"}
ANSWERS = {"training_question_answered", "exam_question_answered"}
ENTRIES = {"training_session_started", "exam_session_started", "training_session_resumed", "exam_session_resumed"}
DIMENSIONS = ("exam_country", "category", "locale", "bank_revision")


def _windows(start, end, through):
    if (
        any(not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None
            for value in (start, end, through))
        or not start < end or through < end
    ):
        raise ValueError("Onboarding cohorts require ordered aware bounds and observe_through >= end.")


def _application(row):
    p = row.properties
    return safe_identity_id(p.get("application_id")) if p.get("application_id_basis") == "native_application_id" else None


def _dimensions(rows):
    first = min((row.timestamp for row in rows if observation_usable(row.properties)), default=None)
    values = {tuple(safe_identity_id(row.properties.get(field)) for field in DIMENSIONS)
              for row in rows if row.timestamp == first and observation_usable(row.properties)}
    return next(iter(values)) if len(values) == 1 else (None,) * len(DIMENSIONS)


def _snapshot(row):
    p = row.properties
    started, completed, home = (_moment(p.get(field)) for field in (
        "onboarding_started_at", "onboarding_completed_at", "onboarding_home_observed_at",
    ))
    reset = p.get("reset_operation_id")
    valid = (
        observation_usable(p) and type(p.get("onboarding_observation_version")) is int
        and p["onboarding_observation_version"] == 1 and p.get("flow_version") == "category_schedule_v1"
        and p.get("flow_context") == "onboarding" and safe_identity_id(p.get("onboarding_attempt_id"))
        and started is not None and started <= row.timestamp and p.get("onboarding_clock_order_valid") is True
        and p.get("onboarding_storage_status") == "persistent"
        and p.get("onboarding_detection_method") in ("new_observation", "restored")
        and safe_identity_id(p.get("start_reason"))
        and (reset is None or safe_identity_id(reset))
        and (p.get("start_reason") != "progress_reset" or reset is not None)
        and (p.get("onboarding_completed_at") is None or completed is not None)
        and (p.get("onboarding_home_observed_at") is None or home is not None)
        and (completed is None or started <= completed <= row.timestamp)
        and (home is None or completed is not None and completed <= home <= row.timestamp)
        and all(field in p for field in ("onboarding_completed_at", "onboarding_home_observed_at", "reset_operation_id"))
    )
    if row.event == "onboarding_flow_viewed":
        valid = valid and completed is None and home is None
    elif row.event == "onboarding_flow_completed":
        valid = valid and completed is not None and (
            p.get("completion_scope") == "local_store_operations_returned" and p.get("completion_source") == "finalize_local"
        )
    elif row.event == "onboarding_home_arrived":
        valid = valid and home is not None and p.get("home_arrival_basis") == "foreground_route_observed" \
            and p.get("screen_name") == "home"
    return {"started": started, "completed": completed, "home": home, "valid": bool(valid)}


def _units(rows, start, end):
    by_install, by_attempt, attempt_owners, observation_owners = defaultdict(list), defaultdict(list), defaultdict(set), defaultdict(set)
    excluded, unknown_roots = Counter(), defaultdict(Counter)
    unjoinable_declarations, known_roots = [], set()

    def restrict_population(population, source):
        field = "first_observed_at" if population == "first_observed" else "onboarding_started_at"
        clocks = [(row, _moment(row.properties.get(field))) for row in source]
        declared = [value for row, value in clocks if value is not None and value <= row.timestamp]
        if not (
            any(start <= value < end for value in declared)
            or any(row.timestamp >= start and (value is None or value > row.timestamp) for row, value in clocks)
        ):
            return
        # Potential scopes restrict denominators; they never create an app join.
        applications = {_application(row) for row in source} - {None}
        for application in applications or {None}:
            unknown_roots[population, application]["root_population_membership_unverified"] += 1

    for row in rows:
        owner = _install(row)
        if owner is not None:
            by_install[owner].append(row)
            observation = safe_identity_id(row.properties.get("installation_observation_id"))
            if observation:
                observation_owners[observation].add(owner)
        elif row.properties.get("observation_detection_method") == "first_local_observation":
            unjoinable_declarations.append(row)
        if row.event not in FLOW or row.properties.get("flow_context") == "settings":
            continue
        attempt = safe_identity_id(row.properties.get("onboarding_attempt_id"))
        if owner is None or attempt is None:
            excluded["unjoinable_onboarding_observations"] += 1
            if row.properties.get("onboarding_observation_version") == 1:
                restrict_population("onboarding_attempt", [row])
            continue
        by_attempt[owner, attempt].append(row)
        attempt_owners[attempt].add(owner)
    installs, attempts = [], []
    for owner, source in sorted(by_install.items()):
        anchor, issue = _anchors(source)
        if anchor is None:
            if any(start <= row.timestamp < end for row in source):
                excluded[issue or "first_observed_anchor_not_observed"] += 1
            if any(row.properties.get("observation_detection_method") == "first_local_observation" for row in source):
                restrict_population("first_observed", source)
            continue
        observation, at = anchor
        application, scope = _application_scope(source)
        if scope == "observed" and len(observation_owners[observation]) == 1:
            known_roots.add((observation, at, application))
        if not start <= at < end:
            continue
        issues = Counter()
        if scope != "observed":
            issues[scope] += 1
            restrict_population("first_observed", source)
        if len(observation_owners[observation]) != 1:
            issues["installation_observation_shared_by_owners"] += 1
        declarations = [row for row in source if row.properties.get("installation_observation_id") == observation]
        earliest = min(row.timestamp for row in declarations)
        if any(_application(row) is None for row in declarations if row.timestamp == earliest):
            issues["origin_application_scope_not_observed"] += 1
        installs.append({
            "population": "first_observed", "owner": owner, "application": application, "id": observation,
            "anchor": at, "issues": issues, "dimensions": _dimensions(declarations), "next_attempt": None,
        })
    for row in unjoinable_declarations:
        p = row.properties
        observation, first = safe_identity_id(p.get("installation_observation_id")), _moment(p.get("first_observed_at"))
        # Matching root evidence limits membership uncertainty, never joins the outcome.
        if (
            row.event not in FLOW | {"install_observation_resolved"} and type(p.get("observation_contract_version")) is int
            and p["observation_contract_version"] == 1 and first is not None and first <= row.timestamp
            and (observation, first, _application(row)) in known_roots
        ):
            continue
        restrict_population("first_observed", [row])
        excluded["unjoinable_first_observed_declarations"] += 1
    for (owner, attempt), source in sorted(by_attempt.items()):
        clocks = [(row, _moment(row.properties.get("onboarding_started_at"))) for row in source]
        times = {at for row, at in clocks}
        declared = times - {None}
        if not declared:
            excluded["onboarding_start_clock_not_observed"] += 1
            if any(row.properties.get("onboarding_observation_version") == 1 for row in source):
                restrict_population("onboarding_attempt", source)
            continue
        at = min(declared)
        issues = Counter()
        if len(times) != 1:
            issues["onboarding_start_clock_conflict"] += 1
        if any(at is None or at > row.timestamp for row, at in clocks):
            restrict_population("onboarding_attempt", source)
        if len(attempt_owners[attempt]) != 1:
            issues["onboarding_attempt_shared_by_owners"] += 1
        bindings = {(safe_identity_id(row.properties.get("start_reason")), safe_identity_id(row.properties.get("reset_operation_id")))
                    for row in source}
        if len(bindings) != 1:
            issues["onboarding_origin_binding_conflict"] += 1
        reason, reset_id = next(iter(bindings)) if len(bindings) == 1 else (None, None)
        application, scope = _application_scope(source)
        if scope != "observed":
            issues[scope] += 1
            restrict_population("onboarding_attempt", source)
        views = [row for row in canonical_observations(source) if row.event == "onboarding_flow_viewed"]
        if not views:
            issues["onboarding_view_not_observed"] += 1
        if any(not _snapshot(row)["valid"] for row in source if row.event == "onboarding_flow_viewed"):
            issues["invalid_onboarding_origin_observation"] += 1
        attempts.append({
            "population": "onboarding_attempt", "owner": owner, "application": application, "id": attempt,
            "anchor": at, "issues": issues, "dimensions": _dimensions(views),
            "reason": reason, "reset_id": reset_id,
            "source": source, "selected": any(start <= value < end for value in declared), "next_attempt": None,
        })
    unowned_associations = canonical_observations([
        row for row in rows if _install(row) is None
        and row.event in {"onboarding_flow_viewed", "progress_reset_started", "progress_reset_confirmed"}
        and row.properties.get("flow_context") != "settings"
    ])
    for unit in attempts:
        others = [other for other in attempts if other["owner"] == unit["owner"] and other["id"] != unit["id"]]
        if any(other["anchor"] == unit["anchor"] for other in others):
            unit["association_issues"] = {"tied_onboarding_attempt_order_unproven": 1}
        else:
            unit["association_issues"] = {}
        boundaries = [other["anchor"] for other in others if other["anchor"] > unit["anchor"] and not other["issues"]]
        uncertain = {(other["anchor"], "unverified_onboarding_supersession") for other in others
                     if other["anchor"] >= unit["anchor"] and other["issues"]}
        source = canonical_observations(by_install[unit["owner"]]) + [
            row for row in unowned_associations if _application(row) in (None, unit["application"])
        ]
        resets = [row for row in source if (
            row.event == "progress_reset_confirmed" and row.timestamp >= unit["anchor"]
            and observation_usable(row.properties) and safe_identity_id(row.properties.get("reset_operation_id"))
            and _install(row) == unit["owner"] and _application(row) == unit["application"]
        )]
        for row in source:
            if row.event == "onboarding_flow_viewed" and row.properties.get("flow_context") != "settings" \
                    and row.properties.get("onboarding_observation_version") == 1:
                record = _snapshot(row)
                at = record["started"]
                if at is None or at > row.timestamp:
                    at = row.timestamp
                attempt = safe_identity_id(row.properties.get("onboarding_attempt_id"))
                if at >= unit["anchor"] and (attempt != unit["id"] or at != unit["anchor"]) and (
                    not record["valid"] or _install(row) is None
                ):
                    uncertain.add((at, "unverified_onboarding_supersession"))
            elif row.event == "progress_reset_confirmed" and row.timestamp >= unit["anchor"]:
                if row not in resets:
                    uncertain.add((row.timestamp, "unverified_reset_supersession"))
            elif row.event == "progress_reset_started" and row.timestamp >= unit["anchor"]:
                operation = safe_identity_id(row.properties.get("reset_operation_id"))
                if not operation or _install(row) is None or not any(
                    reset.properties["reset_operation_id"] == operation and reset.timestamp >= row.timestamp
                    for reset in resets
                ):
                    uncertain.add((row.timestamp, "reset_intent_without_verified_confirmation"))
        if any(row.timestamp == unit["anchor"] and row.properties["reset_operation_id"] != unit["reset_id"]
               for row in resets):
            unit["association_issues"]["tied_reset_attempt_order_unproven"] = 1
        boundaries.extend(row.timestamp for row in resets if row.timestamp > unit["anchor"])
        unit["next_attempt"] = min(boundaries, default=None)
        unit["association_uncertainties"] = sorted(uncertain)
    selected = installs + [unit for unit in attempts if unit["selected"]]
    for unit in selected:
        for application in {unit["application"], None}:
            unit["issues"].update(unknown_roots[unit["population"], application])
    return selected, excluded


def _session(row):
    kind = "training" if row.event.startswith("training_") else "exam" if row.event.startswith("exam_") else row.properties.get("feature")
    identifier = safe_identity_id(row.properties.get(f"{kind}_session_id")) if kind in ("training", "exam") else None
    return (kind, identifier) if identifier else None


def _domain(row):
    return "opened" if row.event == "app_visit_started" else "learning_entry" if row.event in ENTRIES else \
        "usable_question" if row.event == "learning_screen_ready" else "accepted_answer" if row.event in ANSWERS else \
        "meaningful" if row.event in OUTCOMES else None


def _learning(rows):
    flags, issues, sessions = {}, defaultdict(Counter), defaultdict(lambda: defaultdict(list))
    for row in rows:
        domain = _domain(row)
        if domain is None:
            continue
        p, session = row.properties, _session(row)
        valid = observation_usable(p) and (domain == "opened" or session is not None)
        if domain == "opened":
            valid = valid and safe_identity_id(p.get("app_visit_id"))
        elif domain == "usable_question":
            valid = valid and safe_identity_id(p.get("question_id")) and p.get("media_readiness") == "not_measured" \
                and p.get("ready_duration_scope") in ("current_focus_entry", "foreground_observation") \
                and p.get("ready_reason") in ("focused_ready", "foreground_return") \
                and all(nonnegative_number(p.get(field)) for field in ("ready_foreground_ms", "ready_wall_ms"))
        elif domain == "accepted_answer":
            if p.get("timed_out") is True or row.event == "exam_question_answered" and p.get("answer_action") == "update":
                continue
            valid = valid and safe_identity_id(p.get("answer_id")) and safe_identity_id(p.get("question_id")) \
                and type(p.get("is_correct")) is bool
            if row.event == "exam_question_answered":
                valid = valid and p.get("answer_action") == "create" and safe_identity_id(p.get("answer_revision_id"))
        elif domain == "meaningful":
            valid = valid and not _learning_issue(row)
        if not valid:
            issues[domain]["invalid_observation"] += 1
            continue
        if domain == "meaningful" and not meaningful_learning(row):
            continue
        flags.setdefault(domain, row.timestamp)
        if session is not None:
            sessions[session][domain].append(row)
    chains = []
    for session, stages in sessions.items():
        ready = [row for row in stages["usable_question"] if any(
            observed_before(entry, row) for entry in stages["learning_entry"]
        )]
        answered = [row for row in stages["accepted_answer"] if any(observed_before(other, row) for other in ready)]
        for outcome in stages["meaningful"]:
            if any(observed_before(answer, outcome) for answer in answered):
                chains.append(outcome.timestamp)
            elif all(stages[name] for name in ("learning_entry", "usable_question", "accepted_answer")):
                issues["ordered_learning_chain"]["learning_chain_order_unproven_or_contradictory"] += 1
    if chains:
        flags["ordered_learning_chain"] = min(chains)
    issues["ordered_learning_chain"].update(
        reason for domain in ("learning_entry", "usable_question", "accepted_answer", "meaningful")
        for reason in issues[domain]
    )
    return flags, issues


def _onboarding(unit, left, right):
    flags, issues, completed, homes = {}, defaultdict(Counter), [], []
    for row in canonical_observations(unit["source"]):
        record = _snapshot(row)
        domain = "local_completed" if row.event == "onboarding_flow_completed" else \
            "home_observed" if row.event == "onboarding_home_arrived" else None
        if domain is None:
            continue
        if not record["valid"] or _application(row) is None or _application(row) != unit["application"]:
            at = record["completed" if domain == "local_completed" else "home"]
            if at is None or not unit["anchor"] <= at <= row.timestamp:
                at = row.timestamp
            if left <= at < right:
                issues[domain]["invalid_observation"] += 1
            continue
        if domain == "local_completed":
            if left <= record["completed"] < right:
                completed.append(record["completed"])
        else:
            if left <= record["home"] < right:
                homes.append((record["home"], record["completed"]))
    if len(set(completed)) > 1:
        issues["local_completed"]["conflicting_accepted_completion_clocks"] += 1
    if len(set(homes)) > 1:
        issues["home_observed"]["conflicting_home_clocks_or_binding"] += 1
    if completed:
        flags["local_completed"] = min(completed)
    if homes:
        home, accepted = min(homes)
        flags["home_observed"] = home
        if accepted in completed:
            flags["ordered_home"] = home
        else:
            issues["ordered_home"]["matching_explicit_local_completion_not_observed"] += 1
    issues["ordered_home"].update(issues["local_completed"])
    issues["ordered_home"].update(issues["home_observed"])
    for key in ("local_completed", "home_observed", "ordered_home"):
        issues[key]
    return flags, issues


def _measure(unit, rows, left, right, through, coverage):
    clipped = min(right, through)
    common = Counter(unit["issues"])
    if not unit["application"] or not left < clipped or not coverage(unit["application"], left, clipped):
        common["client_application_coverage_unverified"] += 1
    prefix = "after_home_" if unit["population"] == "onboarding_attempt" else ""
    onboarding_flags, onboarding_issues = _onboarding(unit, left, clipped) if prefix else ({}, defaultdict(Counter))
    home = onboarding_flags.get("home_observed")
    association_end = min(clipped, unit["next_attempt"]) if unit["next_attempt"] else clipped
    association_issues = Counter(unit.get("association_issues", {}))
    if prefix:
        association_issues.update(reason for at, reason in unit["association_uncertainties"]
                                  if left <= at < association_end)
    associated, scope_issues = [], defaultdict(Counter)
    for row in rows:
        if not left <= row.timestamp < clipped:
            continue
        domain = _domain(row)
        if domain is None or prefix and (home is None or row.timestamp < home or row.timestamp >= association_end):
            continue
        owner, application = _install(row), _application(row)
        if owner == unit["owner"]:
            if application != unit["application"] or application is None:
                scope_issues[domain]["client_application_scope_unavailable_or_disagrees"] += 1
            elif prefix and row.timestamp == home and not any(
                other.event == "onboarding_home_arrived" and _snapshot(other)["valid"]
                and other.timestamp == home and observed_before(other, row) for other in unit["source"]
            ):
                scope_issues[domain]["home_learning_order_unproven"] += 1
            else:
                associated.append(row)
        elif owner is None and (application is None or application == unit["application"]):
            scope_issues[domain]["unjoinable_installation_observation"] += 1
    learning_flags, learning_issues = _learning(sorted(associated, key=lambda row: row.timestamp))
    flags = {**{key: at for key, at in onboarding_flags.items() if left <= at < clipped},
             **{f"{prefix}{key}": at for key, at in learning_flags.items()}}
    issues = {key: dict(value) for key, value in onboarding_issues.items()}
    for key in ("opened", "learning_entry", "usable_question", "accepted_answer", "meaningful", "ordered_learning_chain"):
        defects = learning_issues[key] + scope_issues[key]
        if key == "ordered_learning_chain":
            defects.update(reason for domain in ("learning_entry", "usable_question", "accepted_answer", "meaningful")
                           for reason in scope_issues[domain])
        if prefix:
            defects.update(association_issues)
            defects.update(onboarding_issues["home_observed"])
        issues[f"{prefix}{key}"] = dict(defects)
    first = flags.get(f"{prefix}meaningful")
    return {
        "window_start": left.isoformat(), "window_end": right.isoformat(), "observed_through": clipped.isoformat(),
        "mature": right <= through, "common_issues": dict(common), "metric_issues": issues,
        "milestones": {key: value.isoformat() for key, value in flags.items()},
        "ttv_seconds": (first - unit["anchor"]).total_seconds() if first is not None else None,
        "association_end": association_end.isoformat() if prefix else None,
    }


def _aggregate(measurements):
    mature = [item for item in measurements if item["mature"]]
    common = Counter(reason for item in mature for reason in item["common_issues"])
    metrics = {}
    names = {key for item in measurements for key in item["metric_issues"] | item["milestones"]}
    for name in sorted(names):
        issues = Counter(reason for item in mature for reason in item["metric_issues"].get(name, {}))
        observed = sum(name in item["milestones"] for item in mature)
        metrics[name] = {"observed_units": observed, "mature_units": len(mature),
                         "fraction": observed / len(mature) if mature and not common and not issues else None,
                         "issues": dict(issues)}
    times = [item["ttv_seconds"] for item in measurements if item["ttv_seconds"] is not None]
    timing_clean = all(not item["common_issues"] and not item["metric_issues"].get(
        "after_home_meaningful" if "after_home_meaningful" in item["metric_issues"] else "meaningful"
    ) for item in measurements)
    return {
        "units": len(measurements), "mature_units": len(mature), "censored_units": len(measurements) - len(mature),
        "common_issues": dict(common), "metrics": metrics,
        "status": "censored" if not mature else "limited" if common or any(item["issues"] for item in metrics.values()) else
            "partially_mature" if len(mature) != len(measurements) else "observed_mature_as_of",
        "ttv_observed_achievers": len(times), "ttv_not_achieved_as_of": len(measurements) - len(times),
        "median_achieved_seconds": median(times) if times and timing_clean else None,
        "median_scope": "observed_achievers_only_not_whole_cohort_or_study_time",
    }


def observed_onboarding(rows, *, start, end, observe_through=None, coverage=None):
    through = observe_through or end
    _windows(start, end, through)
    rows = [row for row in rows if row.timestamp < through]
    rows, quality = observe_data_quality(
        rows, start=min([start, *(row.timestamp for row in rows)]), end=through, coverage_complete=False,
        history_scope="available_onboarding_activation_client_history",
    )
    units, excluded = _units(rows, start, end)
    canonical = canonical_observations(rows)
    coverage = coverage or (lambda app, left, right: False)
    details, groups = [], defaultdict(list)
    for unit in units:
        frames = {}
        for name, days in (("activation_24h", 1), ("d7", 7), ("d30", 30)):
            try:
                right = unit["anchor"].astimezone(timezone.utc) + timedelta(days=days)
            except OverflowError:
                excluded["unrepresentable_horizon"] += 1
                continue
            frames[name] = _measure(unit, canonical, unit["anchor"], right, through, coverage)
        first = _moment(frames.get("d30", {}).get("milestones", {}).get("meaningful"))
        if unit["population"] == "first_observed" and first is not None:
            prefix = _measure(unit, canonical, unit["anchor"], first + timedelta(microseconds=1), through, coverage)
            if not prefix["common_issues"] and not prefix["metric_issues"]["meaningful"]:
                for day in (1, 7):
                    try:
                        left = datetime.combine(first.astimezone(WARSAW).date() + timedelta(days=day), time.min, tzinfo=WARSAW)
                        right = datetime.combine(left.date() + timedelta(days=1), time.min, tzinfo=WARSAW)
                    except OverflowError:
                        continue
                    frames[f"post_activation_calendar_d{day}"] = _measure(unit, canonical, left, right, through, coverage)
                    frames[f"post_activation_calendar_d{day}"]["ttv_seconds"] = None
        detail = {
            "population": unit["population"], "grain_id": unit["id"], "app_user_id": unit["owner"],
            "application_id": unit["application"], "anchor_at": unit["anchor"].isoformat(),
            "start_reason": unit.get("reason"), "reset_operation_id": unit.get("reset_id"),
            **dict(zip(DIMENSIONS, unit["dimensions"])), "origin_issues": dict(unit["issues"]), "frames": frames,
            "superseded_at": unit["next_attempt"].isoformat() if unit["next_attempt"] else None,
        }
        details.append(detail)
        groups[(unit["population"], unit["application"], unit.get("reason"), *unit["dimensions"])].append(detail)
    cohorts = [{
        **{key: members[0][key] for key in ("population", "application_id", "start_reason", *DIMENSIONS)},
        "start_candidates": len(members), "verified_start_candidates": sum(not item["origin_issues"] for item in members),
        "frames": {name: _aggregate([item["frames"][name] for item in members if name in item["frames"]])
                   for name in sorted({key for item in members for key in item["frames"]})},
    } for members in groups.values()]
    return {
        "rule_version": RULE, "window_start": start.isoformat(), "window_end": end.isoformat(),
        "observe_through": through.isoformat(), "cohorts": cohorts, "units": details, "excluded": dict(excluded),
        "status": "limited" if excluded or any(frame["status"] != "observed_mature_as_of" for row in cohorts
                                             for frame in row["frames"].values()) else "observed" if units else "no_observed_roots",
        "grains": {"first_observed": "installation_observation_id", "onboarding_attempt": "installation_scoped_onboarding_attempt_id"},
        "learning_rule": "learning-v1", "post_activation_timezone": "Europe/Warsaw",
        "history_scope": "available_client_partitions_not_installation_lifetime",
        "historical_delivery_as_of": "not_verified", "source_verification": "producer_coverage_assertion_not_native_delivery",
        "onboarding_clock_basis": "declared_record_creation_acceptance_and_home_observation_not_physical_storage_flush",
        "learning_association": "same_installation_after_home_until_next_observed_attempt_or_reset_not_direct_attempt_or_causal_join",
        "overlapping_membership": "first_observed_and_onboarding_attempt_cohorts_are_not_additive_unique_people",
        "source_quality_counts": quality["counts"],
        "must_not_claim": ["physical_new_install", "unique_people", "home_is_learning", "step_is_flow_completion",
                          "physical_storage_flush", "native_delivery", "missing_is_abandon", "study_minutes",
                          "causal_onboarding_lift", "automatic_account_join"],
    }


def warehouse_onboarding_report(warehouse, *, start, end, observe_through=None, contract=None):
    from prawko_analytics.contract import load_contract

    through = observe_through or end
    _windows(start, end, through)
    rows, available_from = available_client_history(warehouse, start, through, contract or load_contract())
    report = observed_onboarding(
        rows, start=start, end=end, observe_through=through,
        coverage=lambda app, left, right: application_covered(warehouse, app, left, right),
    )
    report["client_history_available_from"] = available_from
    return report
