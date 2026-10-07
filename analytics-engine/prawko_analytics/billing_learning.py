"""Observed billing-start learning cohorts, never current paid access or money."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from statistics import median

from prawko_analytics.acquisition import _learning_issue
from prawko_analytics.acquisition_finance import _same_scope, _scope_summary, _time, allocate_billing_lineages
from prawko_analytics.acquisition_mapping import _hash, moment
from prawko_analytics.billing_mapping import billing_mapping_declarations, select_billing_mapping
from prawko_analytics.client_source import application_covered, available_client_history
from prawko_analytics.data_quality import canonical_observations, observe_data_quality
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import WARSAW
from prawko_analytics.learning import meaningful_learning
from prawko_analytics.quality import observation_usable
from prawko_analytics.revenuecat import STORES, financial_report, financial_scope_covered

RULE = "billing-learning-v1"
OUTCOMES = {"training_session_completed", "exam_session_completed"}
ANSWERS = {"training_question_answered", "exam_question_answered"}
STARTS = {"training_session_started", "exam_session_started"}
CONTEXT_FIELDS = ("exam_country", "category", "locale", "bank_revision")


def _trial_period(origin, originals, group, first_paid):
    anchor = moment(origin["generated_at"])
    initial = _time(origin.get("expires_at"))
    issues, revisions = Counter(), []
    if len({item["expires_at"] for item in originals}) != 1:
        issues["trial_origin_expiry_disagreement"] += 1
    if initial is None:
        issues["trial_initial_expiry_not_observed"] += 1
    elif initial <= anchor:
        issues["trial_expiry_not_after_start"] += 1
    boundaries = [moment(first_paid["generated_at"])] if first_paid is not None else []
    for item in sorted(group, key=lambda item: (item["generated_at"], item["event_id"])):
        if (
            item["event_type"] == "EXPIRATION" and item["period_type"] == "TRIAL"
            and item["verified"] and not item["provider_conflict"]
        ):
            at = moment(item["generated_at"])
            if first_paid is not None and at >= moment(first_paid["generated_at"]):
                continue
            if boundaries and at > min(boundaries):
                continue
            if item["transaction_id"] != origin["transaction_id"] or item["product_id"] != origin["product_id"]:
                issues["trial_expiration_contract_disagrees"] += 1
            else:
                boundaries.append(at)
    terminal = min(boundaries, default=None)
    if terminal is not None and terminal <= anchor:
        issues["trial_terminal_not_after_start"] += 1
    extensions = defaultdict(list)
    for item in group:
        at = moment(item["generated_at"])
        if item["event_type"] == "SUBSCRIPTION_EXTENDED" and (terminal is None or at < terminal):
            extensions[at].append(item)
    expiry = initial
    for at, items in sorted(extensions.items()):
        # A later normal renewal's extension does not rewrite the original trial.
        if expiry is not None and at >= expiry and all(item["period_type"] != "TRIAL" for item in items):
            continue
        contracts = {(item["period_type"], item["transaction_id"], item["product_id"], item["expires_at"])
                     for item in items}
        if len(contracts) != 1:
            issues["simultaneous_trial_extension_contract_conflict"] += 1
            continue
        item = items[0]
        extended = _time(item.get("expires_at"))
        if not all(item["verified"] and not item["provider_conflict"] for item in items):
            issues["trial_extension_source_unverified_or_conflicting"] += 1
        elif (
            not origin["product_id"] or item["period_type"] != "TRIAL"
            or item["transaction_id"] != origin["transaction_id"]
            or item["product_id"] != origin["product_id"]
        ):
            issues["trial_extension_period_contract_disagrees"] += 1
        elif expiry is None or at < anchor or at >= expiry:
            issues["trial_extension_continuity_unproven"] += 1
        elif extended is None or extended < expiry:
            issues["trial_extension_expiry_not_observed_or_regresses"] += 1
        else:
            revisions.append({
                "provider_event_ids": sorted(item["event_id"] for item in items),
                "observed_at": at.isoformat(), "previous_expiry_at": expiry.isoformat(),
                "declared_expiry_at": extended.isoformat(),
            })
            expiry = extended
    end = min(expiry, terminal) if expiry is not None and terminal is not None else expiry
    return {
        "end": end if not issues else None, "initial_expiry_at": initial.isoformat() if initial else None,
        "product_id": origin["product_id"],
        "status": "expiry_revision_unverified" if issues else "declared_expiry_revisions_or_earlier_observed_terminal",
        "issues": dict(issues), "revisions": revisions,
    }


def _aware_windows(start, end, through, as_of):
    if (
        any(value.tzinfo is None or value.utcoffset() is None for value in (start, end, through))
        or not start < end or through < end
        or (as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None))
    ):
        raise ValueError("Billing learning requires ordered aware windows and observe_through >= end.")


def _source_units(financial, start, end, through):
    history = financial.get("history", {})
    observations = [
        item for item in history.get("observations", [])
        if moment(item["generated_at"]) < through and item["environment"] == "PRODUCTION"
        and item["store"] in STORES and item["app_id"] is not None and item["is_family_share"] is not True
    ]
    scopes = {tuple(item[field] for field in ("project_id", "app_id", "store")) for item in observations}
    units = []
    excluded = Counter(
        "billing_scope_unavailable_start_observations" for item in history.get("observations", [])
        if start <= moment(item["generated_at"]) < end and item["environment"] != "SANDBOX"
        and item["is_family_share"] is not True
        and (item["event_type"] == "INITIAL_PURCHASE" or item["money_kind"] == "charge" or item["money_issue"])
        and (item["environment"] != "PRODUCTION" or item["store"] not in STORES or item["app_id"] is None)
    )
    excluded["billing_start_lineage_missing"] = sum(
        start <= moment(item["generated_at"]) < end
        and item["environment"] == "PRODUCTION" and item["is_family_share"] is not True
        and item["event_type"] in ("INITIAL_PURCHASE", "NON_RENEWING_PURCHASE")
        and (item["transaction_id"] is None or (
            item["event_type"] == "INITIAL_PURCHASE" and item["original_transaction_id"] is None
        ))
        for item in observations
    )
    for project, app, store in sorted(scopes):
        scope = {"revenuecat_project_id": project, "revenuecat_app_id": app, "store": store, "environment": "PRODUCTION"}
        allocation = allocate_billing_lineages(financial, scope, through, require_clean_money_lineage=False)
        scoped = [item for item in observations if _same_scope(item, scope)]
        for origin in allocation["origin_observations"]:
            lineage, originals = origin["lineage_id"], origin["observations"]
            group = [
                item for item in scoped
                if item["original_transaction_id"] == lineage or item["transaction_id"] == lineage
            ]
            if not originals:
                excluded["lineages_without_observed_origin"] += 1
                continue
            first_origin = min(originals, key=lambda item: (item["generated_at"], item["event_id"]))
            owner = origin["owner"]
            base = Counter(origin["issues"])
            base.update(allocation["scope_issues"])
            if owner is not None:
                base |= Counter(allocation["identity_issues"][owner])
            else:
                base["origin_installation_not_unambiguous"] += 1
            if len({(item["period_type"], item["product_id"]) for item in originals}) != 1:
                base["origin_contract_disagreement"] += 1
            charges = [
                item for item in history.get("canonical_effects", [])
                if _same_scope(item, scope) and item["kind"] == "charge"
                and (item["original_transaction_id"] == lineage or item["transaction_id"] == lineage)
                and moment(item["generated_at"]) < through
            ]
            raw_charges = [
                item for item in group if item["money_kind"] == "charge"
                or (item["event_type"] in ("INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "RENEWAL") and item["money_issue"])
            ]
            first_paid = min(charges, key=lambda item: (item["generated_at"], item["event_id"])) if charges else None
            trial = first_origin["event_type"] == "INITIAL_PURCHASE" and first_origin["period_type"] == "TRIAL"
            trial_period = _trial_period(first_origin, originals, group, first_paid) if trial else None
            starts = []
            if trial:
                starts.append(("trial", "trial_started", first_origin, False))
            paid_start = first_paid or (min(raw_charges, key=lambda item: (item["generated_at"], item["event_id"]))
                                       if raw_charges else None)
            if paid_start is not None:
                paid_observation = next((item for item in group if item["event_id"] == paid_start["event_id"]), None)
                start_type = "non_recurring_paid" if first_origin["event_type"] == "NON_RENEWING_PURCHASE" else \
                    "trial_conversion" if trial and paid_observation and paid_observation["is_trial_conversion"] is True else \
                    "first_observed_paid_after_trial" if trial else \
                    "direct_paid" if paid_start["event_type"] == "INITIAL_PURCHASE" else "first_observed_paid"
                starts.append(("paid", start_type, paid_start, first_paid is None))
            for kind, start_type, event, uncertain_paid in starts:
                anchor = moment(event["generated_at"])
                if not start <= anchor < end:
                    continue
                issues = Counter(base)
                if uncertain_paid:
                    issues["canonical_paid_charge_not_observed"] += 1
                if anchor < moment(first_origin["generated_at"]):
                    issues["billing_start_precedes_observed_origin"] += 1
                for at, reason in allocation["timed_scope_issues"] + allocation["timed_identity_issues"][owner]:
                    if at == anchor:
                        issues[reason] += 1
                trial_end = trial_period["end"] if trial_period is not None else None
                cancels = [
                    item for item in group if item["event_type"] == "CANCELLATION"
                    and item["cancel_reason"] == "UNSUBSCRIBE" and item["period_type"] == "TRIAL"
                    and item["verified"] and not item["provider_conflict"]
                    and anchor <= moment(item["generated_at"])
                    and (trial_end is None or moment(item["generated_at"]) < trial_end)
                ] if kind == "trial" else []
                units.append({
                    "unit_id": _hash([project, app, store, lineage, kind, anchor.isoformat()]),
                    "kind": kind, "start_type": start_type, "scope": scope, "lineage_id": lineage,
                    "owner": owner, "anchor": anchor, "trial_end": trial_end, "issues": issues,
                    "cancellations": cancels, "trial_period": trial_period,
                    "phase_timed_issues": allocation["timed_scope_issues"] + allocation["timed_identity_issues"][owner],
                })
    return units, excluded


def _native(row):
    value = safe_identity_id(row.properties.get("application_id"))
    return value if row.properties.get("application_id_basis") == "native_application_id" else None


def _primary(row):
    value = safe_identity_id(row.properties.get("app_user_id"))
    return value if row.key_source == "primary" and row.analysis_key == value else None


def _answer_key(row):
    props = row.properties
    session_field = "training_session_id" if row.event == "training_question_answered" else "exam_session_id"
    if (
        not observation_usable(props) or not safe_identity_id(props.get(session_field))
        or not safe_identity_id(props.get("answer_id")) or not safe_identity_id(props.get("question_id"))
        or type(props.get("is_correct")) is not bool or props.get("timed_out") is True
    ):
        return None
    if row.event == "exam_question_answered":
        if props.get("answer_action") != "create" or not safe_identity_id(props.get("answer_revision_id")):
            return None
    return row.event, props[session_field], props["answer_id"]


def _measure(unit, rows, mappings, financial, coverage, left, right, through, *, trial_phase=False):
    clipped = min(right, through)
    issues = Counter(unit["issues"])
    if trial_phase:
        issues.update(reason for at, reason in unit["phase_timed_issues"] if left <= at < clipped)
    answer_issues, open_issues, outcome_issues, start_issues = Counter(), Counter(), Counter(), Counter()
    scope = unit["scope"]
    binding, mapping_status = select_billing_mapping(
        mappings, project_id=scope["revenuecat_project_id"], app_id=scope["revenuecat_app_id"],
        store=scope["store"], start=left, end=max(left + timedelta(microseconds=1), clipped),
    )
    if binding is None:
        issues[mapping_status] += 1
    app = binding["scope"]["application_id"] if binding is not None else unit.get("application_id")
    associated, observed_open = [], False
    base_valid = not unit["issues"] and binding is not None and unit["owner"] is not None
    if base_valid:
        for row in rows:
            if not left <= row.timestamp < clipped:
                continue
            event_domain = row.event in OUTCOMES or row.event in ANSWERS or row.event in STARTS
            opening = row.event == "app_visit_started"
            if not event_domain and not opening:
                continue
            domain = open_issues if opening else answer_issues if row.event in ANSWERS else \
                outcome_issues if row.event in OUTCOMES else start_issues
            identity, native = _primary(row), _native(row)
            if identity == unit["owner"]:
                if native != app:
                    domain["client_application_scope_missing_or_disagrees"] += 1
                elif opening:
                    if observation_usable(row.properties):
                        observed_open = True
                    else:
                        open_issues["invalid_open_observation"] += 1
                else:
                    associated.append(row)
            elif identity is None and (native is None or native == app):
                domain["unjoinable_learning_installation"] += 1
    complete = bool(base_valid and left < clipped and coverage(app, left, clipped) and financial_scope_covered(
        financial, project_id=scope["revenuecat_project_id"], app_id=scope["revenuecat_app_id"], start=left, end=clipped,
    ))
    if not complete:
        issues["client_or_billing_scope_coverage_unverified"] += 1
    bad_outcomes = [row for row in associated if row.event in OUTCOMES and _learning_issue(row)]
    outcome_issues["invalid_learning_outcome"] += len(bad_outcomes)
    outcomes = [row for row in associated if row.event in OUTCOMES and not _learning_issue(row)]
    meaningful = [row for row in outcomes if meaningful_learning(row)]
    accepted = set()
    for row in associated:
        if row.event not in ANSWERS:
            continue
        key = _answer_key(row)
        if key is None:
            # Revisions and automatic timeouts are not new accepted answers.
            if row.properties.get("timed_out") is not True and not (
                row.event == "exam_question_answered" and row.properties.get("answer_action") == "update"
            ):
                answer_issues["invalid_accepted_answer"] += 1
        else:
            accepted.add(key)
    started = []
    for row in associated:
        if row.event not in STARTS:
            continue
        session = row.properties.get("training_session_id" if row.event == "training_session_started" else "exam_session_id")
        if safe_identity_id(session) and observation_usable(row.properties):
            started.append(row)
        else:
            start_issues["invalid_learning_start"] += 1
    first = min((row.timestamp for row in meaningful), default=None)
    return {
        "window_start": left.isoformat(), "window_end": right.isoformat(), "observed_through": clipped.isoformat(),
        "mature": right <= through, "coverage_complete": complete,
        "common_issues": {key: count for key, count in issues.items() if count},
        "issues": {key: count for key, count in (issues + outcome_issues).items() if count},
        "answer_issues": dict(answer_issues), "observed_started": bool(started),
        "open_issues": dict(open_issues), "observed_open": observed_open,
        "start_issues": dict(start_issues),
        "accepted_answers": len(accepted), "observed_answering": bool(accepted),
        "completed_training_sessions": len({row.properties["training_session_id"] for row in outcomes
                                            if row.event == "training_session_completed"}),
        "completed_exam_sessions": len({row.properties["exam_session_id"] for row in outcomes
                                        if row.event == "exam_session_completed"}),
        "meaningful_completions": len(meaningful), "first_meaningful_at": first.isoformat() if first else None,
        "observed_time_to_value_seconds": (first - unit["anchor"]).total_seconds() if first else None,
    }


def _aggregate(measurements):
    mature = [item for item in measurements if item["mature"]]
    issues = Counter(reason for item in mature for reason in item["issues"])
    common = Counter(reason for item in mature for reason in item["common_issues"])
    answers = Counter(reason for item in mature for reason in item["answer_issues"])
    opens = Counter(reason for item in mature for reason in item["open_issues"])
    starts = Counter(reason for item in mature for reason in item["start_issues"])
    clean = bool(mature) and not issues
    common_clean = bool(mature) and not common
    achieved = sum(item["meaningful_completions"] > 0 for item in mature)
    times = [item["observed_time_to_value_seconds"] for item in measurements
             if item["observed_time_to_value_seconds"] is not None]
    timing_clean = all(not item["issues"] for item in measurements)
    return {
        "units": len(measurements), "mature_units": len(mature), "censored_units": len(measurements) - len(mature),
        "status": "censored" if not mature else "limited" if not clean else
            "partially_mature" if len(mature) != len(measurements) else "observed_mature_as_of",
        "observed_started_units": sum(item["observed_started"] for item in mature),
        "observed_answering_units": sum(item["observed_answering"] for item in mature),
        "observed_meaningful_units": achieved,
        "meaningful_learning_fraction": achieved / len(mature) if clean else None,
        "accepted_answer_fraction": sum(item["observed_answering"] for item in mature) / len(mature)
            if common_clean and not answers else None,
        "observed_open_units": sum(item["observed_open"] for item in mature),
        "observed_open_fraction": sum(item["observed_open"] for item in mature) / len(mature)
            if common_clean and not opens else None,
        "observed_start_fraction": sum(item["observed_started"] for item in mature) / len(mature)
            if common_clean and not starts else None,
        "observed_completed_training_sessions": sum(item["completed_training_sessions"] for item in mature),
        "observed_completed_exam_sessions": sum(item["completed_exam_sessions"] for item in mature),
        "observed_accepted_answers": sum(item["accepted_answers"] for item in mature),
        "issues": dict(issues), "common_issues": dict(common),
        "answer_issues": dict(answers), "open_issues": dict(opens), "start_issues": dict(starts),
        "ttv_observed_achievers": len(times), "ttv_not_achieved_as_of": len(measurements) - len(times),
        "median_achieved_seconds": median(times) if times and timing_clean else None,
        "median_scope": "observed_achievers_only_not_whole_cohort",
    }


def observed_billing_learning(rows, *, financial, mappings, start, end, observe_through=None, coverage=None):
    through = observe_through or end
    _aware_windows(start, end, through, None)
    coverage = coverage or (lambda app, left, right: False)
    rows = [row for row in rows if row.timestamp < through]
    history_start = min([start, *(row.timestamp for row in rows)])
    rows, quality = observe_data_quality(
        rows, start=history_start, end=through, coverage_complete=False,
        history_scope="available_billing_learning_client_history",
    )
    rows = canonical_observations(rows)
    units, excluded = _source_units(financial, start, end, through)
    groups, details = defaultdict(list), []
    for unit in units:
        scope, anchor = unit["scope"], unit["anchor"]
        point_binding, point_status = select_billing_mapping(
            mappings, project_id=scope["revenuecat_project_id"], app_id=scope["revenuecat_app_id"],
            store=scope["store"], start=anchor, end=anchor + timedelta(microseconds=1),
        )
        unit["application_id"] = point_binding["scope"]["application_id"] if point_binding else None
        if point_binding is None:
            unit["issues"][point_status] += 1
        context = [row for row in rows if _primary(row) == unit["owner"] and _native(row) == unit["application_id"]
                   and row.timestamp <= anchor and observation_usable(row.properties)]
        latest = max((row.timestamp for row in context), default=None)
        snapshots = [tuple(safe_identity_id(row.properties.get(field)) for field in CONTEXT_FIELDS)
                     for row in context if row.timestamp == latest]
        dimensions = snapshots[0] if snapshots and len(set(snapshots)) == 1 else (None,) * len(CONTEXT_FIELDS)
        frames = {}
        for name, span in (("activation_24h", 1), ("d7", 7), ("d30", 30)):
            try:
                right = anchor.astimezone(timezone.utc) + timedelta(days=span)
            except OverflowError:
                excluded["unrepresentable_horizon"] += 1
                continue
            frames[name] = _measure(unit, rows, mappings, financial, coverage, anchor, right, through)
        if unit["kind"] == "trial":
            unit["trial_period_status"] = unit["trial_period"]["status"]
            if unit["trial_end"] is None:
                if "trial_initial_expiry_not_observed" in unit["trial_period"]["issues"]:
                    unit["trial_period_status"] = "expiry_not_observed"
            else:
                frames["trial_phase"] = _measure(
                    unit, rows, mappings, financial, coverage, anchor, unit["trial_end"], through, trial_phase=True,
                )
        cancels = []
        for item in unit["cancellations"]:
            at = moment(item["generated_at"])
            measurement = _measure(unit, rows, mappings, financial, coverage, anchor, at, through, trial_phase=True)
            known = not measurement["common_issues"] and not measurement["answer_issues"]
            cancel_contract_valid = (
                item["transaction_id"] == unit["lineage_id"]
                and unit["trial_period"]["product_id"] is not None
                and item["product_id"] == unit["trial_period"]["product_id"]
            )
            known = known and cancel_contract_valid and not unit["trial_period"]["issues"]
            cancels.append({
                "provider_event_id": item["event_id"],
                "period_contract_status": "original_trial" if cancel_contract_valid else "unknown_or_disagrees",
                "cancel_intent_at": at.isoformat(), "usage_basis": "accepted_answers_before_observed_cancel_intent",
                "usage": "used" if known and measurement["accepted_answers"] else "unused" if known else "unknown",
                "measurement": measurement, "does_not_mean": "access_revoked_or_subscription_churn",
            })
        first = _time(frames.get("d30", {}).get("first_meaningful_at"))
        activation_evidence = _measure(
            unit, rows, mappings, financial, coverage, anchor, first + timedelta(microseconds=1), through,
        ) if first is not None else None
        if first is not None and not activation_evidence["issues"]:
            for day in (1, 7):
                try:
                    left = datetime.combine(first.astimezone(WARSAW).date() + timedelta(days=day), time.min, tzinfo=WARSAW)
                    right = datetime.combine(left.date() + timedelta(days=1), time.min, tzinfo=WARSAW)
                except OverflowError:
                    continue
                measurement = _measure(unit, rows, mappings, financial, coverage, left, right, through)
                measurement["observed_time_to_value_seconds"] = None
                frames[f"post_activation_calendar_d{day}"] = measurement
        detail = {
            "unit_id": unit["unit_id"], "cohort_kind": unit["kind"], "start_type": unit["start_type"],
            "original_lineage_id": unit["lineage_id"],
            "billing_start_at": anchor.isoformat(), "app_user_id": unit["owner"],
            "application_id": unit["application_id"], **scope, **dict(zip(CONTEXT_FIELDS, dimensions)),
            "context_basis": "latest_unambiguous_client_snapshot_at_or_before_billing_generation_not_country_inference",
            "mapping": _scope_summary(point_binding) if point_binding else None,
            "start_issues": dict(unit["issues"]), "frames": frames, "trial_cancellations": cancels,
            "trial_period_status": unit.get("trial_period_status"),
            "trial_period": {key: value for key, value in unit["trial_period"].items() if key != "end"}
                if unit["kind"] == "trial" else None,
        }
        details.append(detail)
        key = (unit["kind"], unit["start_type"], unit["application_id"], *scope.values(), *dimensions)
        groups[key].append(detail)
    cohorts = []
    for members in groups.values():
        first = members[0]
        frames = {name: _aggregate([item["frames"][name] for item in members if name in item["frames"]])
                  for name in sorted({name for item in members for name in item["frames"]})}
        cohorts.append({
            **{field: first[field] for field in (
                "cohort_kind", "start_type", "application_id", "revenuecat_project_id", "revenuecat_app_id",
                "store", "environment", *CONTEXT_FIELDS,
            )}, "start_candidates": len(members),
            "verified_start_candidates": sum(not item["start_issues"] for item in members), "frames": frames,
            "trial_cancel_usage": dict(Counter(item["usage"] for member in members for item in member["trial_cancellations"])),
            "trial_cancel_observed_units": sum(bool(member["trial_cancellations"]) for member in members),
            "trial_phase_unknown_units": sum(
                member["cohort_kind"] == "trial" and "trial_phase" not in member["frames"] for member in members
            ),
        })
    return {
        "rule_version": RULE, "status": "billing_source_not_loaded" if financial.get("status") == "not_loaded" else
            "billing_source_unavailable_as_of" if not financial.get("source_coverage") else
            "mapping_not_loaded" if not mappings else "limited" if not units and any(excluded.values()) else
            "no_observed_starts" if not units else
            "limited" if any(excluded.values()) or any(row["trial_phase_unknown_units"] for row in cohorts)
            or any(item["status"] != "observed_mature_as_of" for row in cohorts for item in row["frames"].values())
            else "observed",
        "window_start": start.isoformat(), "window_end": end.isoformat(), "observe_through": through.isoformat(),
        "financial_as_of": financial.get("as_of"), "grain": "revenuecat_scope_original_lineage_start_kind",
        "anchor_basis": "observed_trial_start_or_first_available_canonical_positive_charge_with_observed_origin",
        "start_population_scope": "observed_qualifying_lineage_candidates_not_all_subscribers",
        "overlapping_membership": "trial_paid_and_lineage_cohorts_are_not_additive_unique_people_or_session_counts",
        "history_scope": "available_archives_and_client_partitions_not_installation_lifetime",
        "source_verification": "producer_and_mapping_assertions_not_authenticated_by_engine",
        "posthog_application_coverage_basis": "explicit_coverage_application_ids_not_inferred_from_events",
        "learning_rule": "learning-v1", "post_activation_return_timezone": "Europe/Warsaw",
        "time_basis": "normalized_client_event_time_and_revenuecat_generation_not_proven_synchronized_clocks",
        "trial_phase_basis": "declared_initial_expiry_with_verified_continuous_revisions_or_earlier_paid_start_or_trial_expiration",
        "trial_cancellation_grain": "revenuecat_provider_event_not_unique_cancel_cycles_or_subscribers",
        "historical_client_delivery_as_of": "not_verified", "cohorts": cohorts, "units": details,
        "excluded": dict(excluded), "source_quality_counts": quality["counts"],
        "must_not_claim": [
            "current_entitlement", "active_paid_access", "cancellation_revokes_access", "unique_people",
            "physical_new_paid_customers", "settled_revenue", "study_minutes", "causal_paid_or_trial_lift",
            "historical_client_delivery_as_of", "automatic_alias_or_account_join",
        ],
    }


def warehouse_billing_learning_report(warehouse, *, start, end, observe_through=None, as_of=None, contract=None):
    from prawko_analytics.contract import load_contract

    through = observe_through or end
    _aware_windows(start, end, through, as_of)
    contract = contract or load_contract()
    rows, available_from = available_client_history(warehouse, start, through, contract)
    financial = financial_report(warehouse, start=start, end=through, as_of=as_of, include_history=True)
    cutoff = as_of if as_of is not None else _time(financial.get("as_of"))
    mappings = billing_mapping_declarations(warehouse, as_of=cutoff)

    def covered(application_id, left, right):
        return application_covered(warehouse, application_id, left, right)

    report = observed_billing_learning(
        rows, financial=financial, mappings=mappings, start=start, end=end, observe_through=through, coverage=covered,
    )
    report["mapping_as_of"] = cutoff.isoformat() if cutoff else None
    report["client_history_available_from"] = available_from
    return report
