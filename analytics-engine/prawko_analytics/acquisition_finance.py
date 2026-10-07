"""Observed first-observed cohort gross activity, never proceeds or ROAS."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, localcontext

from prawko_analytics.acquisition import RULE as ACQUISITION_RULE, warehouse_acquisition_report
from prawko_analytics.acquisition_mapping import mapping_declarations, moment, select_mapping
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.revenuecat import CHARGE_TYPES, MONEY_BASIS, STORES, financial_report, financial_scope_covered
from prawko_analytics.spend import exact_campaign_spend_report

RULE = "acquisition-financial-cohorts-v1"
GROUP_FIELDS = ("application_id", "asa_result", "asa_org_id", "asa_campaign_id")
MONEY_COLUMNS = {"charge": "charges", "refund": "refunds", "refund_reversed": "refund_reversals"}


def _time(value):
    try:
        return moment(value)
    except (ValueError, OverflowError):
        return None


def _number(value):
    return format(value, "f") if value else "0"


def _add(left, right):
    with localcontext() as context:
        context.prec = 64
        return left + right


def _ids(event):
    return {
        identifier for value in (
            event.get("app_user_id"), event.get("original_app_user_id"),
            *event.get("aliases", []), *event.get("transferred_from", []), *event.get("transferred_to", []),
        ) if (identifier := safe_identity_id(value)) is not None
    }


def _same_scope(item, scope):
    return (
        item["project_id"] == scope["revenuecat_project_id"] and item["app_id"] == scope["revenuecat_app_id"]
        and item["store"] == scope["store"] and item["environment"] == scope["environment"]
    )


def _lineage_key(event):
    if event["event_type"] == "NON_RENEWING_PURCHASE":
        return event["transaction_id"]
    return event.get("original_transaction_id")


def allocate_billing_lineages(financial, scope, through, *, require_clean_money_lineage=True):
    history = financial.get("history", {})
    observations = [
        item for item in history.get("observations", []) if _same_scope(item, scope)
        and moment(item["generated_at"]) < through and item["is_family_share"] is not True
    ]
    effects = [
        item for item in history.get("canonical_effects", []) if _same_scope(item, scope)
        and moment(item["generated_at"]) < through
    ]
    quarantined = {
        item["transaction_id"] for item in history.get("quarantined_effects", []) if _same_scope(item, scope)
        and (require_clean_money_lineage or item["kind"] == "charge")
    }
    by_lineage, transactions = defaultdict(list), defaultdict(set)
    global_issues, restricted, allocated = Counter(), defaultdict(Counter), defaultdict(list)
    timed_global, timed_restricted = [], defaultdict(list)

    def restrict(item, reason, *, identities=None, timed=False):
        identities = _ids(item) if identities is None else identities
        if timed:
            entry = (moment(item["generated_at"]), reason)
            if identities:
                for identity in identities:
                    timed_restricted[identity].append(entry)
            else:
                timed_global.append(entry)
        elif identities:
            for identity in identities:
                restricted[identity][reason] += 1
        else:
            global_issues[reason] += 1

    nonrecurring = {item["transaction_id"] for item in observations if item["event_type"] == "NON_RENEWING_PURCHASE"}
    for item in observations:
        lineage = item["transaction_id"] if item["transaction_id"] in nonrecurring else _lineage_key(item)
        if lineage:
            by_lineage[lineage].append(item)
            if item["transaction_id"]:
                transactions[item["transaction_id"]].add(lineage)
        elif item["event_type"] in CHARGE_TYPES or item["money_issue"] or item["provider_conflict"]:
            restrict(item, "transaction_lineage_not_observed", timed=not item["provider_conflict"])
    origin_by_lineage, origin_observations = {}, []
    for lineage, group in by_lineage.items():
        if not any(
            item["event_type"] in CHARGE_TYPES or item["money_issue"] or item["provider_conflict"]
            or item["transaction_id"] in quarantined for item in group
        ):
            continue
        problems = Counter()
        originals = [
            item for item in group if item["event_type"] in {"INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"}
            and item["transaction_id"] == lineage and item["is_family_share"] is not True
        ]
        owners = {safe_identity_id(item["app_user_id"]) for item in originals}
        owner = next(iter(owners)) if len(owners) == 1 and None not in owners else None
        if originals and not owner:
            problems["origin_installation_not_unambiguous"] += 1
        for item in group:
            if (
                owner is not None and (
                    item["app_user_id"] != owner or item["original_app_user_id"] != owner
                    or any(alias != owner for alias in item["aliases"])
                )
            ):
                problems["lineage_subscriber_identity_ambiguous"] += 1
            if not item["verified"]:
                problems["unverified_lineage_source"] += 1
            if item["provider_conflict"] or item["transaction_id"] in quarantined:
                problems["quarantined_transaction_observation"] += 1
            if item["transaction_id"] and len(transactions[item["transaction_id"]]) > 1:
                problems["transaction_lineage_conflict"] += 1
        identities = set().union(*(_ids(item) for item in group))
        origin_observations.append({
            "lineage_id": lineage, "owner": owner, "observations": originals, "issues": dict(problems),
        })
        for item in group:
            if item["money_issue"] and (require_clean_money_lineage or item["event_type"] in CHARGE_TYPES):
                restrict(item, item["money_issue"], identities=identities, timed=True)
            if not originals and (item["event_type"] in CHARGE_TYPES or item["money_issue"]):
                restrict(item, "origin_installation_not_unambiguous", identities=identities, timed=True)
        if problems:
            if identities:
                for identity in identities:
                    restricted[identity].update(problems)
            else:
                global_issues.update(problems)
        elif owner is not None:
            origin_by_lineage[lineage] = (owner, min(moment(item["generated_at"]) for item in originals))
    for effect in effects:
        lineages = transactions.get(effect["transaction_id"], set())
        if len(lineages) != 1:
            restrict(effect, "effect_lineage_unproven", timed=True)
            continue
        origin = origin_by_lineage.get(next(iter(lineages)))
        if origin:
            owner, generated = origin
            allocated[owner].append({**effect, "origin_generated_at": generated.isoformat()})
    for item in history.get("observations", []):
        if item["project_id"] != scope["revenuecat_project_id"] or item["app_id"] not in (None, scope["revenuecat_app_id"]):
            continue
        if moment(item["generated_at"]) >= through or item["environment"] == "SANDBOX":
            continue
        if item["event_type"] == "TRANSFER" and item["verified"]:
            identities = _ids(item)
            if identities:
                for identity in identities:
                    restricted[identity]["subscriber_transfer_observed"] += 1
            else:
                global_issues["unscoped_subscriber_transfer"] += 1
        if item["store"] in STORES and item["store"] != scope["store"]:
            continue
        if item["is_family_share"] is True:
            continue
        identities = _ids(item)
        if identities:
            # A missing namespace may affect a known origin despite a different
            # latest subscriber ID. This only broadens restrictions, never joins.
            candidates = set(transactions.get(item["transaction_id"], set()))
            if item["original_transaction_id"] in by_lineage:
                candidates.add(item["original_transaction_id"])
            for lineage in candidates:
                identities.update(identity for observation in by_lineage[lineage] for identity in _ids(observation))
        monetary = item["event_type"] in CHARGE_TYPES or (
            item["money_issue"] and require_clean_money_lineage
        ) or (
            not require_clean_money_lineage and item["event_type"] in {"SUBSCRIPTION_EXTENDED", "EXPIRATION"}
        )
        if item.get("lifecycle_kind") == "unrecognized_event_type":
            restrict(item, "unrecognized_financial_event_type", identities=identities, timed=True)
        if not monetary:
            continue
        if item["app_id"] is None:
            restrict(item, "financial_app_scope_missing", identities=identities, timed=True)
        if item["store"] not in STORES:
            restrict(item, "financial_store_scope_unknown", identities=identities, timed=True)
        if item["environment"] not in ("PRODUCTION", "SANDBOX"):
            restrict(item, "financial_environment_unknown", identities=identities, timed=True)
    return {
        "effects": allocated, "identity_issues": restricted, "scope_issues": global_issues,
        "timed_identity_issues": timed_restricted, "timed_scope_issues": timed_global,
        "origin_observations": origin_observations,
    }


def _horizon_money_issues(allocation, identity, start, end):
    return Counter(
        reason for at, reason in allocation["timed_scope_issues"] + allocation["timed_identity_issues"][identity]
        if start <= at < end
    )


def _supplied_installations(acquisition, start, end):
    if (
        not isinstance(acquisition, dict) or acquisition.get("rule_version") != ACQUISITION_RULE
        or not isinstance(acquisition.get("installations"), list)
        or type(acquisition.get("coverage_complete")) is not bool
        or not _valid_issues(acquisition.get("quality_issues"))
        or type(acquisition.get("excluded_anchor_installations", 0)) is not int
        or not 0 <= acquisition.get("excluded_anchor_installations", 0) <= 2**53 - 1
    ):
        raise ValueError("Supplied acquisition requires the explicit installation report contract.")
    excluded, by_identity = Counter(), defaultdict(list)
    for installation in acquisition["installations"]:
        if not isinstance(installation, dict) or type(installation.get("cohort_selected")) is not bool:
            excluded["invalid_supplied_cohort_metadata"] += 1
            continue
        if installation.get("cohort_selected") is not True:
            continue
        first = _time(installation.get("first_observed_at"))
        identity = safe_identity_id(installation.get("app_user_id"))
        if (
            not identity or not safe_identity_id(installation.get("installation_observation_id"))
            or installation.get("anchor_status") != "observed" or first is None or not start <= first < end
        ):
            excluded["invalid_supplied_cohort_anchor"] += 1
            continue
        attribution = installation.get("attribution")
        if (
            installation.get("result") not in ("attributed", "organic", "unavailable", "ineligible", "unknown")
            or not _valid_issues(installation.get("quality_issues"))
            or (installation.get("application_id") is not None and not safe_identity_id(installation["application_id"]))
            or (attribution is not None and (
                not isinstance(attribution, dict) or any(
                    value is not None and (type(value) is not int or not 0 < value <= 2**53 - 1)
                    for value in (attribution.get("asa_org_id"), attribution.get("asa_campaign_id"))
                )
            ))
        ):
            excluded["invalid_supplied_cohort_metadata"] += 1
            continue
        by_identity[identity].append(installation)
    selected = []
    for group in by_identity.values():
        if any(item != group[0] for item in group):
            excluded["conflicting_supplied_installation_rows"] += 1
            continue
        excluded["duplicate_supplied_installation_rows"] += len(group) - 1
        selected.append({**group[0], "quality_issues": dict(group[0]["quality_issues"])})
    by_observation = defaultdict(list)
    for installation in selected:
        by_observation[installation["installation_observation_id"]].append(installation)
    for group in by_observation.values():
        if len(group) > 1:
            for installation in group:
                installation["quality_issues"]["cross_installation_observation_conflict"] = 1
    restrictions = {
        reason: count for reason, count in excluded.items()
        if count and reason != "duplicate_supplied_installation_rows"
    }
    return selected, excluded, restrictions


def _valid_issues(value):
    return isinstance(value, dict) and all(
        safe_identity_id(key) is not None and type(count) is int and 0 <= count <= 2**53 - 1
        for key, count in value.items()
    )


def _scope_summary(binding):
    return {"binding_id": binding["binding_id"], **binding["scope"],
            **{field: binding[field] for field in (
                "source_id", "verification_basis", "declared_at", "reviewed_at", "validity",
            )}}


def financial_cohort_report(
    warehouse, *, start: datetime, end: datetime, observe_through: datetime | None = None,
    as_of: datetime | None = None, acquisition=None,
):
    through = observe_through or end
    if (
        any(value.tzinfo is None or value.utcoffset() is None for value in (start, end, through))
        or not start < end or through < end
    ):
        raise ValueError("Financial cohorts require ordered timezone-aware windows and observe_through >= end.")
    if as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None):
        raise ValueError("Financial cohort as_of must be timezone-aware.")
    acquisition = acquisition if acquisition is not None else warehouse_acquisition_report(
        warehouse, start=start, end=end, observe_through=through,
    )
    installations, excluded, source_restrictions = _supplied_installations(acquisition, start, end)
    if (
        _time(acquisition.get("window_start")) != start or _time(acquisition.get("window_end")) != end
        or _time(acquisition.get("observe_through")) != through
    ):
        raise ValueError("Supplied acquisition report must have the same cohort and observation windows.")
    financial = financial_report(warehouse, start=start, end=through, as_of=as_of, include_history=True)
    cutoff = as_of if as_of is not None else _time(financial.get("as_of"))
    mappings = mapping_declarations(warehouse, as_of=cutoff)
    groups = defaultdict(list)
    for installation in installations:
        attribution = installation.get("attribution") or {}
        group = (
            installation.get("application_id"), installation.get("result"),
            attribution.get("asa_org_id"), attribution.get("asa_campaign_id"),
        )
        groups[group].append(installation)
    rows, allocation_cache = [], {}
    for key, installations in sorted(groups.items(), key=lambda item: repr(item[0])):
        for days in (7, 30):
            rows.append(_group_report(
                warehouse, key, installations, days, start, end, through, cutoff,
                acquisition, financial, mappings, allocation_cache, source_restrictions,
            ))
    return {
        "rule_version": RULE, "status": "mapping_not_loaded" if not mappings else
            "financial_source_not_loaded" if financial["status"] == "not_loaded" else
            "limited" if source_restrictions else "no_cohort_observations" if not rows else
            "limited" if any(row["status"] != "observed_mature_cohort_as_of" for row in rows) else "observed",
        "window_start": start.isoformat(), "window_end": end.isoformat(), "observe_through": through.isoformat(),
        "financial_as_of": financial.get("as_of"), "money_basis": MONEY_BASIS,
        "mapping_spend_as_of": cutoff.isoformat() if cutoff is not None else None,
        "financial_time_basis": "canonical_revenuecat_event_generated_at_not_purchased_at",
        "anchor_basis": "durable_first_local_observation_not_physical_install",
        "mapping_source": "operator_assertion_not_authenticated_by_engine",
        "financial_source": "producer_assertion_not_authenticated_by_engine",
        "client_history_delivery_as_of": "not_verified",
        "financial_integrity_scope": "available_lineage_provider_conflicts_and_horizon_scoped_money_issues",
        "posthog_coverage_complete": acquisition.get("coverage_complete") is True,
        "mapping_declarations_available": len(mappings), "cohorts": rows,
        "excluded": dict(excluded), "excluded_anchor_installations": acquisition.get("excluded_anchor_installations", 0),
        "proceeds": None, "roas": None,
        "must_not_claim": [
            "store_proceeds", "settled_revenue", "bank_payout", "causal_channel_lift",
            "physical_install_cohort", "complete_paid_download_cohort", "historical_client_delivery_as_of",
            "automatic_alias_or_account_join", "fx_conversion", "daily_spend_allocation",
        ],
    }


def _group_report(
    warehouse, key, installations, days, start, end, through, cutoff,
    acquisition, financial, mappings, allocation_cache, source_restrictions,
):
    scope_values = dict(zip(GROUP_FIELDS, key, strict=True))
    counts, issues, money = Counter(), Counter(), defaultdict(lambda: dict.fromkeys(MONEY_COLUMNS.values(), Decimal(0)))
    bindings = {}
    for installation in installations:
        first = moment(installation["first_observed_at"])
        try:
            horizon = first.astimezone(timezone.utc) + timedelta(days=days)
        except OverflowError:
            counts["censored_installations"] += 1
            continue
        if horizon > through:
            counts["censored_installations"] += 1
            continue
        counts["mature_installations"] += 1
        binding, mapping_status = select_mapping(
            mappings, application_id=installation.get("application_id"), asa_org_id=scope_values["asa_org_id"],
            start=first, end=horizon,
        )
        if not binding:
            issues[mapping_status] += 1
            continue
        bindings[binding["binding_id"]] = binding
        scope = binding["scope"]
        scope_key = tuple(scope[field] for field in ("revenuecat_project_id", "revenuecat_app_id", "store", "environment"))
        if scope_key not in allocation_cache:
            allocation_cache[scope_key] = allocate_billing_lineages(financial, scope, through)
        allocation = allocation_cache[scope_key]
        identity = installation["app_user_id"]
        local_issues = Counter({reason: count for reason, count in installation["quality_issues"].items() if count})
        local_issues.update(allocation["scope_issues"])
        local_issues.update(allocation["identity_issues"][identity])
        money_issues = _horizon_money_issues(allocation, identity, first, horizon)
        if installation.get("application_scope_status") != "observed":
            local_issues["native_application_scope_unproven"] += 1
        if installation["result"] not in ("attributed", "organic"):
            local_issues["acquisition_result_unknown"] += 1
        if installation.get("platform") != "ios":
            local_issues["acquisition_platform_not_ios"] += 1
        if (installation.get("attribution") or {}).get("asa_result") != installation["result"]:
            local_issues["acquisition_terminal_result_disagreement"] += 1
        if installation["result"] == "attributed" and any(scope_values[field] is None for field in ("asa_org_id", "asa_campaign_id")):
            local_issues["paid_campaign_scope_incomplete"] += 1
        covered = financial_scope_covered(
            financial, project_id=scope["revenuecat_project_id"], app_id=scope["revenuecat_app_id"], start=first, end=horizon,
        )
        counts["financially_covered_installations"] += covered
        if not covered:
            issues["financial_horizon_coverage_unverified"] += 1
        selected = [item for item in allocation["effects"][identity] if first <= moment(item["generated_at"]) < horizon]
        if any(moment(item["origin_generated_at"]) < first for item in selected):
            local_issues["transaction_origin_precedes_observation_anchor"] += 1
        if any(moment(item["origin_generated_at"]) > moment(item["generated_at"]) for item in selected):
            local_issues["transaction_origin_generation_after_effect"] += 1
        if local_issues or money_issues:
            counts["integrity_restricted_installations"] += 1
            issues.update(local_issues)
            issues.update(money_issues)
        if local_issues:
            continue
        counts["observed_charged_installations"] += any(item["kind"] == "charge" for item in selected)
        for effect in selected:
            counts["associated_effects"] += 1
            column = MONEY_COLUMNS[effect["kind"]]
            money[effect["currency"]][column] = _add(money[effect["currency"]][column], Decimal(effect["amount"]))
    if not acquisition.get("coverage_complete"):
        issues["posthog_observation_coverage_unverified"] += 1
    if acquisition.get("quality_issues", {}).get("missing_primary_installation_identity"):
        issues["unjoinable_installation_observations"] += 1
    issues.update(source_restrictions)
    if financial["status"] == "not_loaded":
        issues["financial_source_not_loaded"] += 1
    mature = counts["mature_installations"]
    complete = bool(mature) and not issues and counts["financially_covered_installations"] == mature
    all_mature = complete and mature == len(installations)
    currencies = [
        {"currency": currency, **{column: _number(amount) for column, amount in values.items()},
         "observed_net_gross": _number(sum(values.values(), Decimal(0))),
         "mature_cohort_net_gross": _number(sum(values.values(), Decimal(0))) if complete else None}
        for currency, values in sorted(money.items())
    ]
    expense = {"status": "not_joined", "currencies": [], "exact_campaign_window": False}
    expense_scopes = {tuple(sorted(binding["scope"].items())): binding for binding in bindings.values()}
    if len(expense_scopes) == 1 and scope_values["asa_result"] == "attributed" and scope_values["asa_campaign_id"] is not None:
        binding = next(iter(expense_scopes.values()))
        scope = binding["scope"]
        expense = exact_campaign_spend_report(
            warehouse, start=start, end=end, account_id=scope["apple_account_id"], app_id=scope["apple_app_id"],
            campaign_id=scope_values["asa_campaign_id"], as_of=cutoff,
        )
    ratios = []
    if all_mature and expense.get("exact_campaign_window"):
        gross = {row["currency"]: Decimal(row["mature_cohort_net_gross"]) for row in currencies}
        for cost in expense["currencies"]:
            amount = Decimal(cost["declared_scope_spend"])
            if cost["currency"] not in gross and counts["associated_effects"]:
                continue
            if amount == 0:
                continue
            with localcontext() as context:
                context.prec = 64
                ratio = gross.get(cost["currency"], Decimal(0)) / amount
            ratios.append({
                "currency": cost["currency"], "associated_gross": _number(gross.get(cost["currency"], Decimal(0))),
                "declared_campaign_spend": cost["declared_scope_spend"], "ratio": _number(ratio),
                "basis": "observed_first_observed_cohort_gross_to_declared_spend_not_roas",
            })
    return {
        **scope_values, "days": days, "grain": "installation_observation_id",
        "status": "censored" if not mature else "limited" if not complete else
            "partially_mature_cohort" if not all_mature else "observed_mature_cohort_as_of",
        "installations": len(installations), **{field: counts[field] for field in (
            "mature_installations", "censored_installations", "financially_covered_installations",
            "integrity_restricted_installations", "observed_charged_installations", "associated_effects",
        )},
        "financial_payer_fraction": counts["observed_charged_installations"] / mature if complete else None,
        "issues": dict(issues), "currencies": currencies, "app_scope_mappings": [_scope_summary(row) for row in bindings.values()],
        "gross_scope": "mature_anchored_nonconflicting_installation_associations_only",
        "expense": expense, "gross_activity_to_declared_spend": ratios,
        "proceeds": None, "roas": None,
    }
