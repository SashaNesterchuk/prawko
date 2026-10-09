"""Installation-scoped ASA observations, never visit attribution or money."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

from prawko_analytics.data_quality import canonical_observations, observe_data_quality
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import WARSAW, load_events, partition_days
from prawko_analytics.learning import meaningful_learning
from prawko_analytics.quality import nonnegative_number, observation_integrity_issue, observation_usable

TERMINAL = "apple_search_ads_attribution_resolved"
RULE = "asa-installation-v1"
POPULATION = "primary_installation_identities_observed_in_window_not_new_installs"
MAX_ID = 2**53 - 1
ID_FIELDS = (
    "asa_org_id", "asa_campaign_id", "asa_ad_group_id", "asa_keyword_id", "asa_ad_id",
)
ENUM_FIELDS = {
    "asa_claim_type": {"Click", "Impression"},
    "asa_conversion_type": {"Download", "Redownload"},
}
DATE_FIELDS = ("asa_click_date", "asa_impression_date")
DIMENSIONS = ("asa_result", *ID_FIELDS, *ENUM_FIELDS)
LEARNING_EVENTS = {"training_session_completed", "exam_session_completed"}
PURCHASE_EVENTS = {"purchase_succeeded"}
ANSWER_EVENTS = {"training_question_answered", "exam_question_answered"}
FUNNEL_STEPS = (
    "first_useful_action", "practice_exam_completed", "paywall_viewed",
    "purchase_started", "purchase_succeeded",
)
FUNNEL_HORIZON = timedelta(days=30)
SUBSCRIPTION_PERIODS = {"P1W", "P1M", "P3M"}
ANCHOR_ISSUES = {
    "invalid_observation_anchor", "conflicting_observation_anchor", "conflicting_observation_anchor_identity",
}


def _moment(value):
    if not isinstance(value, str):
        return None
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return moment if moment.tzinfo is not None and moment.utcoffset() is not None else None
    except ValueError:
        return None


def _install(row):
    install = safe_identity_id(row.properties.get("app_user_id"))
    return install if row.key_source == "primary" and row.analysis_key == install else None


def _learning_issue(row):
    props = row.properties
    if (
        observation_integrity_issue(props) or props.get("learning_outcome_rule_version") != "learning-v1"
        or not safe_identity_id(props.get(
            "training_session_id" if row.event == "training_session_completed" else "exam_session_id"
        ))
    ):
        return True
    if row.event == "training_session_completed":
        count = props.get("accepted_unique_question_count")
        if type(count) is not int or not nonnegative_number(count):
            return True
        return any(props.get(field) is not None and (
            type(props[field]) is not int or not nonnegative_number(props[field]) or count > props[field]
        ) for field in ("answered_count", "question_total"))
    total, answered = props.get("question_total"), props.get("answered_count")
    return (
        type(total) is not int or not nonnegative_number(total) or total == 0
        or type(answered) is not int or not nonnegative_number(answered) or answered > total
        or props.get("completion_status") not in ("completed", "abandoned", "expired")
    )


def _terminal(row):
    props = row.properties
    result = props.get("asa_result")
    if (
        not observation_usable(props) or props.get("platform") != "ios"
        or result not in ("attributed", "organic", "unavailable")
    ):
        return None
    ids = {field: props.get(field) for field in ID_FIELDS}
    if any(value is not None and (type(value) is not int or not 0 < value <= MAX_ID) for value in ids.values()):
        return None
    enums = {field: props.get(field) for field in ENUM_FIELDS}
    if any(value is not None and (not isinstance(value, str) or value not in ENUM_FIELDS[field])
           for field, value in enums.items()):
        return None
    dates = {field: props.get(field) for field in DATE_FIELDS}
    if any(value is not None and (
        not isinstance(value, str)
        or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z", value)
        or _moment(value) is None
    ) for value in dates.values()):
        return None
    country = props.get("asa_country_or_region")
    if country is not None and (not isinstance(country, str) or not re.fullmatch(r"[A-Z]{2}", country)):
        return None
    reason = props.get("asa_unavailable_reason")
    if result == "unavailable":
        if reason not in ("token_error", "invalid_token", "unresolved"):
            return None
    elif reason is not None:
        return None
    if result != "attributed" and any(value is not None for value in (*ids.values(), *enums.values(), *dates.values(), country)):
        return None
    return {
        "asa_result": result, **ids, **enums, **dates, "asa_country_or_region": country,
        "asa_unavailable_reason": reason,
    }


def _anchors(rows):
    declared = [
        row for row in rows if row.properties.get("installation_observation_id") is not None
        or row.event == "install_observation_resolved"
    ]
    bindings, usable_bindings = set(), set()
    for row in declared:
        props = row.properties
        first = _moment(props.get("first_observed_at"))
        observation = safe_identity_id(props.get("installation_observation_id"))
        if (
            not observation
            or type(props.get("observation_contract_version")) is not int
            or props["observation_contract_version"] != 1
            or props.get("observation_detection_method") != "first_local_observation"
            or first is None or first > row.timestamp
        ):
            return None, "invalid_observation_anchor"
        if row.event == "install_observation_resolved" and not observation_usable(props):
            return None, "invalid_observation_anchor"
        bindings.add((observation, first))
        if observation_usable(props):
            usable_bindings.add((observation, first))
    if len(bindings) > 1:
        return None, "conflicting_observation_anchor"
    if bindings and not usable_bindings:
        return None, "invalid_observation_anchor"
    return (next(iter(usable_bindings)), None) if usable_bindings else (None, None)


def _scope(installation):
    attribution = installation["attribution"] or {}
    return tuple(attribution.get(field) if field != "asa_result" else installation["result"] for field in DIMENSIONS)


def _application_scope(rows):
    observed, invalid = set(), False
    for row in rows:
        value = row.properties.get("application_id")
        if value is None:
            continue
        identifier = safe_identity_id(value)
        if not identifier or row.properties.get("application_id_basis") != "native_application_id":
            invalid = True
        elif observation_usable(row.properties):
            observed.add(identifier)
    if invalid or len(observed) > 1:
        return None, "conflicting_or_invalid_application_scope"
    return (next(iter(observed)), "observed") if observed else (None, "not_observed")


def _scope_dict(scope):
    return dict(zip(DIMENSIONS, scope, strict=True))


def _purchase_rows(rows, cross_install_transactions):
    """One client native-success observation per scoped transaction/attempt."""
    candidates = [row for row in rows if row.event == "purchase_succeeded"]
    groups = defaultdict(list)
    issues = []
    for row in candidates:
        props = row.properties
        transaction = safe_identity_id(props.get("transaction_id"))
        attempt = safe_identity_id(props.get("purchase_attempt_id"))
        product = safe_identity_id(props.get("product_id"))
        if (
            not observation_usable(props) or not attempt or not product
            or props.get("native_purchase_completed") is not True
            or (props.get("transaction_id") is not None and not transaction)
        ):
            issues.append((row, "invalid_client_purchase"))
            continue
        if transaction in cross_install_transactions:
            issues.append((row, "cross_installation_client_transaction"))
            continue
        groups[("transaction", transaction) if transaction else ("attempt", attempt)].append(row)
    purchases = []
    for group in groups.values():
        if len({row.properties["product_id"] for row in group}) > 1:
            issues.extend((row, "conflicting_client_purchase") for row in group)
            continue
        purchases.append(min(group, key=lambda row: row.timestamp))
    return purchases, issues


def observed_acquisition(
    rows, *, start: datetime, end: datetime, observe_through: datetime | None = None,
    coverage_complete: bool = False, history_scope: str = "supplied_rows_only",
) -> dict:
    through = observe_through or end
    if (
        any(moment.tzinfo is None or moment.utcoffset() is None for moment in (start, end, through))
        or start >= end or through < end
    ):
        raise ValueError("Acquisition requires ordered timezone-aware bounds and observe_through >= end.")
    rows = [row for row in rows if row.timestamp < through]
    rows, source_quality = observe_data_quality(
        rows, start=min([start, *(row.timestamp for row in rows)]), end=through,
        coverage_complete=coverage_complete, history_scope=history_scope,
    )
    issues = Counter()
    by_install = defaultdict(list)
    observed = set()
    observation_owners, transaction_owners = defaultdict(set), defaultdict(set)
    for row in rows:
        install = _install(row)
        if not install:
            if start <= row.timestamp < through and row.event in {TERMINAL, "install_observation_resolved"}:
                issues["missing_primary_installation_identity"] += 1
            if start <= row.timestamp < through and row.event in PURCHASE_EVENTS | LEARNING_EVENTS:
                issues["missing_primary_purchase_identity" if row.event in PURCHASE_EVENTS
                       else "missing_primary_learning_identity"] += 1
            continue
        by_install[install].append(row)
        observation = safe_identity_id(row.properties.get("installation_observation_id"))
        if observation:
            observation_owners[observation].add(install)
        transaction = safe_identity_id(row.properties.get("transaction_id"))
        if transaction and row.event == "purchase_succeeded":
            transaction_owners[transaction].add(install)
        if start <= row.timestamp < end:
            observed.add(install)

    installations = []
    relevant_rows = {}
    outcome_issues = Counter()
    cross_install_transactions = {key for key, owners in transaction_owners.items() if len(owners) > 1}
    for install, source_rows in sorted(by_install.items()):
        anchor, anchor_issue = _anchors(source_rows)
        if anchor and len(observation_owners[anchor[0]]) > 1:
            anchor, anchor_issue = None, "conflicting_observation_anchor_identity"
        in_cohort = anchor is not None and start <= anchor[1] < end
        if install not in observed and not in_cohort:
            continue
        local_issues = Counter()
        if anchor_issue:
            local_issues[anchor_issue] += 1
        application, application_status = _application_scope(source_rows)
        if application_status == "conflicting_or_invalid_application_scope":
            local_issues[application_status] += 1
        platforms = {row.properties.get("platform") for row in source_rows
                     if row.properties.get("platform") in ("ios", "android", "web")}
        if len(platforms) > 1:
            local_issues["conflicting_installation_platform"] += 1
        terminals = [row for row in source_rows if row.event == TERMINAL]
        valid = [(row, _terminal(row)) for row in terminals]
        invalid = sum(props is None for _row, props in valid)
        if invalid:
            local_issues["invalid_attribution_terminal"] += invalid
        signatures = {tuple(props.items()) for _row, props in valid if props is not None}
        if len(signatures) > 1:
            local_issues["conflicting_attribution_terminal"] += 1
        attribution = None
        terminal_at = None
        platform = next(iter(platforms)) if len(platforms) == 1 else None
        duplicate_terminals = 0
        if not invalid and len(signatures) == 1 and len(platforms) <= 1:
            first, attribution = min(valid, key=lambda item: item[0].timestamp)
            terminal_at = first.timestamp
            duplicate_terminals = len(valid) - 1
        result = attribution["asa_result"] if attribution else (
            "ineligible" if platforms and platforms <= {"android", "web"} else "unknown"
        )
        purchases, purchase_issues = _purchase_rows(source_rows, cross_install_transactions)
        meaningful = [
            row for row in canonical_observations(source_rows) if meaningful_learning(row) and not _learning_issue(row)
        ]
        # Missing/conflicting outcome evidence taints only the dependent cohort metric.
        learning_issue_rows = [row for row in source_rows if row.event in LEARNING_EVENTS and _learning_issue(row)]
        quality = dict(local_issues)
        issues.update(local_issues)
        outcome_issues.update(reason for _row, reason in purchase_issues)
        outcome_issues["invalid_learning_outcome_rows"] += len(learning_issue_rows)
        installations.append({
            "app_user_id": install, "observed_in_window": install in observed, "cohort_selected": in_cohort,
            "result": result, "platform": platform, "attribution": attribution,
            "application_id": application, "application_scope_status": application_status,
            "campaign_scope_status": "explicit_ids" if attribution and all(
                attribution[field] is not None for field in ("asa_org_id", "asa_campaign_id")
            ) else "unavailable",
            "terminal_observed_at": terminal_at.isoformat() if terminal_at else None,
            "duplicate_terminal_rows": duplicate_terminals,
            "installation_observation_id": anchor[0] if anchor else None,
            "first_observed_at": anchor[1].isoformat() if anchor else None,
            "anchor_status": "observed" if anchor else anchor_issue or "not_observed",
            "quality_issues": quality,
            "client_purchase_issues": dict(Counter(reason for _row, reason in purchase_issues)),
            "learning_outcome_issue_rows": len(learning_issue_rows),
            "client_purchases_before_terminal": sum(
                row.timestamp < terminal_at for row in purchases
            ) if terminal_at else 0,
        })
        relevant_rows[install] = (purchases, meaningful, purchase_issues, learning_issue_rows, source_rows)

    mix_groups = defaultdict(list)
    for installation in installations:
        if installation["observed_in_window"]:
            mix_groups[_scope(installation)].append(installation)
    population = sum(map(len, mix_groups.values()))
    mix_issue_count = issues["missing_primary_installation_identity"] + sum(
        sum(count for key, count in item["quality_issues"].items() if key not in ANCHOR_ISSUES)
        for item in installations if item["observed_in_window"]
    )
    terminal_observations = sum(item["attribution"] is not None for item in installations if item["observed_in_window"])
    mix_status = "unavailable" if not terminal_observations else (
        "limited_integrity" if mix_issue_count else "incomplete_coverage" if not coverage_complete else "observed"
    )
    mix = {
        "rule_version": RULE, "status": mix_status, "grain": "app_user_id_installation",
        "population": POPULATION,
        "installations": population, "terminal_observations": terminal_observations,
        "quality_issue_count": mix_issue_count, "coverage_complete": coverage_complete,
        "buckets": [
            {**_scope_dict(scope), "installations": len(group),
             "share": len(group) / population if population and coverage_complete and not mix_issue_count else None}
            for scope, group in sorted(mix_groups.items(), key=lambda item: repr(item[0]))
        ],
    }

    cohorts = _cohorts(installations, relevant_rows, through, coverage_complete, issues)
    return {
        "rule_version": RULE, "status": mix_status, "window_start": start.isoformat(), "window_end": end.isoformat(),
        "observe_through": through.isoformat(), "history_scope": history_scope,
        "historical_delivery_as_of": "not_verified", "coverage_complete": coverage_complete,
        "attribution_basis": "explicit_installation_terminal_only_not_super_properties_or_visit_entry",
        "mix": mix, "installations": installations, "cohorts": cohorts,
        "cohort_population": "durably_anchored_first_observations_in_window_not_physical_new_installs",
        "excluded_anchor_installations": sum(item["anchor_status"] != "observed" for item in installations),
        "quality_issues": dict(issues), "quality_issue_count": sum(issues.values()),
        "outcome_quality_issues": {key: count for key, count in outcome_issues.items() if count},
        "outcome_quality_issue_count": sum(outcome_issues.values()),
        "source_integrity": {"rule_version": source_quality["rule_version"], "counts": source_quality["counts"]},
        "client_purchase_basis": "observed_native_success_not_verified_charge_or_revenue",
        "purchase_before_attribution_basis": "strict_event_time_only_tied_order_not_inferred",
        "financial_reconciliation": "not_joined", "roas": None,
        "must_not_claim": [
            "physical_install_date", "unique_accounts", "android_organic", "unknown_is_organic",
            "native_delivery", "historical_delivery_as_of", "verified_purchase", "settled_money",
            "store_proceeds", "causal_channel_lift", "fresh_spend", "automatic_app_scope_mapping",
            "ordered_funnel_as_verified_revenue",
        ],
        "product_funnel": _product_funnels(installations, relevant_rows, through, coverage_complete, issues),
    }


def _horizons(first, days):
    elapsed, calendar = None, None
    try:
        elapsed = first.astimezone(timezone.utc) + timedelta(days=days)
    except OverflowError:
        pass
    try:
        day = first.astimezone(WARSAW).date() + timedelta(days=days)
        calendar = (
            datetime.combine(day, time.min, tzinfo=WARSAW),
            datetime.combine(day + timedelta(days=1), time.min, tzinfo=WARSAW),
        )
    except OverflowError:
        pass
    return elapsed, calendar


def _cohorts(installations, relevant_rows, through, complete, source_issues):
    groups = defaultdict(list)
    for installation in installations:
        if installation["cohort_selected"]:
            groups[_scope(installation)].append(installation)
    reports = []
    for scope, group in sorted(groups.items(), key=lambda item: repr(item[0])):
        for days in (7, 30):
            mature, censored, client_limited, learning_limited = 0, 0, 0, 0
            purchasers, learners, before_terminal = 0, 0, 0
            return_mature, return_censored, returned, return_limited = 0, 0, 0, 0
            for installation in group:
                first = _moment(installation["first_observed_at"])
                horizon, return_window = _horizons(first, days)
                purchases, meaningful, purchase_issues, learning_issues, _source_rows = relevant_rows[installation["app_user_id"]]
                if horizon is None or horizon > through:
                    censored += 1
                else:
                    mature += 1
                    native = [row for row in purchases if first <= row.timestamp < horizon]
                    purchasers += bool(native)
                    learners += any(first <= row.timestamp < horizon for row in meaningful)
                    terminal_at = _moment(installation["terminal_observed_at"])
                    before_terminal += bool(terminal_at and any(row.timestamp < terminal_at for row in native))
                    client_limited += bool(
                        installation["quality_issues"] or any(first <= row.timestamp < horizon
                                                             for row, _reason in purchase_issues)
                    )
                    learning_limited += bool(
                        installation["quality_issues"] or any(first <= row.timestamp < horizon for row in learning_issues)
                    )
                if return_window is None or return_window[1] > through:
                    return_censored += 1
                else:
                    return_start, return_end = return_window
                    return_mature += 1
                    returned += any(return_start <= row.timestamp < return_end for row in meaningful)
                    return_limited += bool(
                        installation["quality_issues"] or any(return_start <= row.timestamp < return_end
                                                             for row in learning_issues)
                    )
            channel_known = scope[0] in ("attributed", "organic")
            client_scope_clean = not (source_issues["missing_primary_installation_identity"]
                                     or source_issues["missing_primary_purchase_identity"])
            learning_scope_clean = not (source_issues["missing_primary_installation_identity"]
                                       or source_issues["missing_primary_learning_identity"])
            reports.append({
                **_scope_dict(scope), "days": days, "grain": "installation_observation_id",
                "anchor_basis": "durable_first_local_observation_not_physical_install",
                "horizon_basis": "elapsed_days_half_open_from_first_observed_at",
                "installations": len(group), "mature_installations": mature, "censored_installations": censored,
                "observed_client_purchasers": purchasers,
                "client_purchasers_before_attribution": before_terminal,
                "client_purchase_limited_installations": client_limited,
                "client_purchase_fraction": purchasers / mature
                    if complete and channel_known and client_scope_clean and mature and not client_limited else None,
                "meaningful_learning_rule": "learning-v1", "observed_meaningful_learning_installations": learners,
                "learning_limited_installations": learning_limited,
                "meaningful_learning_fraction": learners / mature
                    if complete and channel_known and learning_scope_clean and mature and not learning_limited else None,
                "calendar_learning_return": {
                    "timezone": "Europe/Warsaw", "basis": f"meaningful_completion_on_calendar_D{days}",
                    "mature_installations": return_mature, "censored_installations": return_censored,
                    "observed_returned_installations": returned, "limited_installations": return_limited,
                    "fraction": returned / return_mature
                        if complete and channel_known and learning_scope_clean and return_mature and not return_limited else None,
                },
                "coverage_complete": complete, "attribution_known": channel_known,
                "client_identity_scope_clean": client_scope_clean, "learning_identity_scope_clean": learning_scope_clean,
                "sample_basis": "descriptive_observed_cohort_no_benchmark_or_causal_claim",
            })
    return reports


def _accepted_answer(row):
    if row.event not in ANSWER_EVENTS or not observation_usable(row.properties):
        return False
    props = row.properties
    if props.get("timed_out") is True:
        return False
    if row.event == "exam_question_answered" and props.get("answer_action") == "update":
        return False
    if not safe_identity_id(props.get("answer_id")) or not safe_identity_id(props.get("question_id")):
        return False
    if type(props.get("is_correct")) is not bool:
        return False
    if row.event == "exam_question_answered":
        return props.get("answer_action") == "create" and bool(safe_identity_id(props.get("answer_revision_id")))
    return True


def _answer_invalid(row):
    if row.event not in ANSWER_EVENTS or row.properties.get("timed_out") is True:
        return False
    if row.event == "exam_question_answered" and row.properties.get("answer_action") == "update":
        return False
    return not _accepted_answer(row)


def _exam_completed(row):
    return (
        row.event == "exam_session_completed" and meaningful_learning(row) and not _learning_issue(row)
    )


def _identified(row, event, field):
    return row.event == event and observation_usable(row.properties) and bool(safe_identity_id(row.properties.get(field)))


def _purchase_context(row):
    props = row.properties
    if props.get("checkout_origin_status") != "observed" or props.get("checkout_origin_version") != 1:
        return {"exam_country": None, "paywall_offer": None, "product_kind": "unclassified"}
    country = props.get("checkout_origin_exam_country")
    offer = props.get("checkout_origin_paywall_offer")
    period = props.get("checkout_origin_subscription_period")
    if not (isinstance(country, str) and re.fullmatch(r"[A-Z]{2}", country)):
        country = None
    if offer not in ("plans", "lifetime"):
        offer = None
    if period not in SUBSCRIPTION_PERIODS:
        period = None
    subscription = offer == "plans" or period in SUBSCRIPTION_PERIODS
    lifetime = offer == "lifetime"
    if subscription and lifetime:
        kind = "unclassified"
    elif subscription:
        kind = "subscription"
    elif lifetime:
        kind = "lifetime"
    else:
        kind = "unclassified"
    return {"exam_country": country, "paywall_offer": offer, "product_kind": kind}


def _earliest(rows):
    rows = list(rows)
    return min(rows, key=lambda row: row.timestamp) if rows else None


def _ordered_funnel(rows, purchases):
    useful = _earliest(row for row in rows if _accepted_answer(row))
    exam = _earliest(row for row in rows if useful and row.timestamp > useful.timestamp and _exam_completed(row))
    paywall = _earliest(
        row for row in rows
        if exam and row.timestamp > exam.timestamp and _identified(row, "paywall_viewed", "paywall_view_id")
    )
    started = _earliest(
        row for row in rows
        if paywall and row.timestamp > paywall.timestamp and _identified(row, "purchase_started", "purchase_attempt_id")
    )
    attempt = safe_identity_id(started.properties.get("purchase_attempt_id")) if started else None
    succeeded = _earliest(
        row for row in purchases
        if started and row.timestamp > started.timestamp
        and safe_identity_id(row.properties.get("purchase_attempt_id")) == attempt
    )
    return useful, exam, paywall, started, succeeded


def _funnel_invalid(row):
    if _answer_invalid(row):
        return True
    if row.event == "exam_session_completed" and _learning_issue(row):
        return True
    if row.event == "paywall_viewed" and not _identified(row, "paywall_viewed", "paywall_view_id"):
        return True
    if row.event == "purchase_started" and not _identified(row, "purchase_started", "purchase_attempt_id"):
        return True
    return False


def _product_funnels(installations, relevant_rows, through, complete, source_issues):
    """Ordered client steps for one ASA scope. Counts are observations, not revenue."""
    groups = defaultdict(list)
    for installation in installations:
        if installation["cohort_selected"]:
            groups[_scope(installation)].append(installation)
    scope_clean = not (
        source_issues["missing_primary_installation_identity"]
        or source_issues["missing_primary_purchase_identity"]
        or source_issues["missing_primary_learning_identity"]
    )
    reports = []
    for scope, group in sorted(groups.items(), key=lambda item: repr(item[0])):
        reached = Counter()
        contexts = Counter()
        mature = censored = limited = outside = 0
        for installation in group:
            first = _moment(installation["first_observed_at"])
            horizon = None
            if first is not None:
                try:
                    horizon = first.astimezone(timezone.utc) + FUNNEL_HORIZON
                except OverflowError:
                    horizon = None
            if horizon is None or horizon > through:
                censored += 1
                continue
            mature += 1
            purchases, _meaningful, purchase_issues, learning_issues, source_rows = relevant_rows[
                installation["app_user_id"]
            ]
            window = [
                row for row in source_rows if first <= row.timestamp < horizon and observation_usable(row.properties)
            ]
            purchases = [row for row in purchases if first <= row.timestamp < horizon]
            issue_rows = [row for row in purchase_issues if first <= row[0].timestamp < horizon]
            issue_rows += [row for row in learning_issues if first <= row.timestamp < horizon]
            if installation["quality_issues"] or issue_rows or any(_funnel_invalid(row) for row in window):
                limited += 1
            steps = _ordered_funnel(window, purchases)
            for name, row in zip(FUNNEL_STEPS, steps, strict=True):
                reached[name] += row is not None
            if steps[-1] is not None:
                context = _purchase_context(steps[-1])
                contexts[(context["exam_country"], context["paywall_offer"], context["product_kind"])] += 1
            elif purchases:
                outside += 1
        channel_known = scope[0] in ("attributed", "organic")
        rate_ok = bool(complete and channel_known and scope_clean and mature and not limited)
        reports.append({
            **_scope_dict(scope), "grain": "installation_observation_id",
            "horizon": "elapsed_30d_half_open_from_first_observed_at",
            "order": "strictly_later_event_time_same_installation",
            "basis": "ordered_client_observations_not_verified_revenue",
            "installations": len(group), "mature_installations": mature, "censored_installations": censored,
            "limited_installations": limited, "purchase_outside_ordered_funnel": outside,
            "steps": [
                {"id": name, "installations": reached[name],
                 "fraction": reached[name] / mature if rate_ok else None}
                for name in FUNNEL_STEPS
            ],
            "purchase_context": [
                {"exam_country": country, "paywall_offer": offer, "product_kind": kind, "installations": count}
                for (country, offer, kind), count in sorted(contexts.items(), key=lambda item: repr(item[0]))
            ],
        })
    return reports


def warehouse_acquisition_report(
    warehouse: Path, *, start: datetime, end: datetime, observe_through: datetime | None = None,
    contract=None,
) -> dict:
    """Read available history for delayed attribution; end is not export/receipt time."""
    from prawko_analytics.context import _prepare
    from prawko_analytics.contract import load_contract

    through = observe_through or end
    # Validate bounds even when no partitions exist.
    observed_acquisition([], start=start, end=end, observe_through=through)
    days = []
    for path in (warehouse / "events").glob("day=*/events.parquet"):
        try:
            day = datetime.fromisoformat(path.parent.name.removeprefix("day=")).replace(tzinfo=WARSAW)
            if day < through:
                days.append(day)
        except ValueError:
            continue
    history_start = min([start, *days])
    partitions = partition_days(warehouse, history_start, through)
    requested = partition_days(warehouse, start, through)
    complete = bool(requested) and all(
        path is not None and meta is not None and meta.get("metadata_version") == 2 and meta.get("complete") is True
        for _day, path, meta in requested
    )
    contract = contract or load_contract()
    rows = [_prepare(raw, contract) for raw in load_events(
        [path for _day, path, _meta in partitions if path is not None], history_start, through,
    )]
    report = observed_acquisition(
        rows, start=start, end=end, observe_through=through, coverage_complete=complete,
        history_scope="available_partitions_not_installation_lifetime",
    )
    report["history_available_from"] = min(days).isoformat() if days else None
    report["history_partitions_complete"] = bool(partitions) and all(
        path is not None and meta is not None and meta.get("metadata_version") == 2 and meta.get("complete") is True
        for _day, path, meta in partitions
    )
    return report
