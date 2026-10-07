"""Count-only eligibility/config diagnostics; neither exposure rates nor money."""

from collections import Counter, defaultdict
import json

from prawko_analytics.client_source import available_client_history
from prawko_analytics.contract import load_contract
from prawko_analytics.data_quality import canonical_observations, observe_data_quality
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ingest import partition_days
from prawko_analytics.ordering import observed_before
from prawko_analytics.paywall_contract import (
    COMPLETED, ELIGIBILITY_EVENTS, REQUEST_FIELDS, RESOLVED, STARTED,
    origin_snapshot, valid_eligibility_payload,
)
from prawko_analytics.quality import observation_integrity_issue, observation_usable


RULE = "paywall-observations-v1"
SNAPSHOT_EVENTS = frozenset({
    "paywall_viewed", "paywall_offer_ready", "paywall_plan_selected",
    "paywall_cta_selected", "paywall_dismissed",
})


def _signature(values):
    return json.dumps(values, sort_keys=True, default=str)


def _scope(row):
    return (
        safe_identity_id(row.properties.get("app_user_id")),
        safe_identity_id(row.properties.get("eligibility_request_id")),
    )


def _request(key, rows):
    canonical = canonical_observations(rows)
    issues = Counter()
    if any(not valid_eligibility_payload(row.event, row.properties, row.timestamp) for row in rows):
        issues["invalid_request_observation"] += 1
    if any(observation_integrity_issue(row.properties) for row in rows):
        issues["request_source_integrity"] += 1
    if any(len({_signature(row.properties[field]) for row in rows if field in row.properties}) > 1
           for field in REQUEST_FIELDS):
        issues["request_binding_conflict"] += 1
    starts = [row for row in canonical if row.event == STARTED]
    terminals = [row for row in canonical if row.event == COMPLETED]
    products = [row for row in canonical if row.event == RESOLVED]
    start, terminal = (starts[0] if len(starts) == 1 else None), (terminals[0] if len(terminals) == 1 else None)
    if len(starts) > 1 or len(terminals) > 1:
        issues["conflicting_request_stages"] += 1
    if start and any(not observed_before(start, row) for row in products + terminals):
        issues["request_start_order_unproven"] += 1
    if terminal:
        if len(products) != terminal.properties.get("eligibility_resolved_product_count"):
            issues["product_observation_count_mismatch"] += 1
        if any(not observed_before(row, terminal) for row in products):
            issues["product_terminal_order_unproven"] += 1
        outcome = terminal.properties.get("eligibility_request_outcome")
        for row in products:
            p, t = row.properties, terminal.properties
            if (
                p.get("eligibility_native_query_invoked") != t.get("eligibility_native_query_invoked")
                or p.get("eligibility_error_category") != t.get("eligibility_error_category")
                or (outcome == "resolved" and p.get("eligibility_basis") not in
                    ("revenuecat_ios_status", "sdk_status_unknown", "missing_product_response"))
                or (outcome == "unsupported" and p.get("eligibility_basis") != "unsupported_platform")
                or (outcome == "not_configured" and p.get("eligibility_basis") != "not_configured")
                or (outcome == "error" and p.get("eligibility_basis") != "request_error")
            ):
                issues["product_request_outcome_disagreement"] += 1
    if issues:
        status = "limited_integrity"
    elif start is None:
        status = "start_not_observed"
    elif terminal is None:
        status = "terminal_not_observed"
    else:
        status = "completed"
    return {
        "app_user_id": key[0], "eligibility_request_id": key[1],
        "paywall_view_id": next((row.properties.get("paywall_view_id") for row in canonical), None),
        "status": status, "quality_issues": dict(issues),
        "started_observed": start is not None, "completed_observed": terminal is not None,
        "request_outcome": terminal.properties.get("eligibility_request_outcome") if terminal else None,
        "native_query_invoked": terminal.properties.get("eligibility_native_query_invoked") if terminal else None,
        "observer_active_at_terminal": terminal.properties.get("eligibility_observer_active") if terminal else None,
        "view_visible_at_terminal": terminal.properties.get("eligibility_view_visible") if terminal else None,
        "observed_duration_ms": terminal.properties.get("eligibility_duration_ms") if terminal else None,
        "products": [
            {
                "product_id": row.properties.get("eligibility_product_id"),
                "outcome": row.properties.get("eligibility_outcome"), "basis": row.properties.get("eligibility_basis"),
                "source_usable": observation_usable(row.properties)
                and valid_eligibility_payload(row.event, row.properties, row.timestamp),
                "observer_active": row.properties.get("eligibility_observer_active"),
                "view_visible": row.properties.get("eligibility_view_visible"),
            }
            for row in sorted(products, key=lambda row: str(row.properties.get("eligibility_product_id")))
        ],
    }


def _origins(rows, start, end, namespace):
    groups, excluded = defaultdict(list), Counter()
    for row in rows:
        p = row.properties
        install = safe_identity_id(p.get("app_user_id"))
        if namespace == "paywall_origin":
            kind, operation = "paywall_view", safe_identity_id(p.get("paywall_view_id"))
        elif safe_identity_id(p.get("purchase_attempt_id")):
            kind, operation = "purchase_attempt", safe_identity_id(p["purchase_attempt_id"])
        else:
            kind, operation = "restore_attempt", safe_identity_id(p.get("restore_attempt_id"))
        has_origin = any(key.startswith(f"{namespace}_") for key in p)
        if not install or not operation:
            if has_origin and start <= row.timestamp < end:
                excluded["unjoinable_origin_observations"] += 1
            continue
        if has_origin or (
            namespace == "paywall_origin" and row.event in SNAPSHOT_EVENTS
        ) or (namespace == "checkout_origin" and row.event.startswith(("purchase_", "restore_"))):
            groups[(install, kind, operation)].append(row)
    units, quality = [], Counter()
    for key, source in sorted(groups.items()):
        canonical = canonical_observations(source)
        if not any(start <= row.timestamp < end for row in canonical):
            continue
        snapshots = [(row, *origin_snapshot(row.properties, namespace, row.timestamp)) for row in canonical]
        statuses = {status for _, status, _ in snapshots}
        observed = {_signature(value) for _, status, value in snapshots if status == "observed"}
        issues = Counter()
        if "invalid" in statuses:
            issues["invalid_origin_snapshot"] += 1
        if any(observation_integrity_issue(row.properties) for row in source):
            issues["origin_source_integrity"] += 1
        if len(observed) > 1:
            issues["origin_snapshot_conflict"] += 1
        if "observed" in statuses and statuses != {"observed"}:
            issues["origin_observation_scope_mixed"] += 1
        status = "limited_integrity" if issues else next(iter(statuses), "legacy_unobserved")
        value = json.loads(next(iter(observed))) if status == "observed" else None
        differences = 0
        if namespace == "checkout_origin" and value:
            differences = sum(
                row.event == "purchase_started" and any(
                    row.properties.get(f"checkout_origin_{field}") is not None
                    and row.properties.get(field) is not None
                    and row.properties[f"checkout_origin_{field}"] != row.properties[field]
                    for field in ("product_id", "package_id", "price", "currency", "subscription_period")
                ) for row in canonical
            )
        quality.update(issues)
        units.append({
            "app_user_id": key[0], "grain": key[1], "operation_id": key[2],
            "status": status, "snapshot": value, "quality_issues": dict(issues),
            "native_package_difference_observations": differences,
        })
    quality.update(excluded)
    return {"namespace": namespace, "units": units, "quality_issues": dict(quality),
            "status_counts": dict(Counter(unit["status"] for unit in units))}


def _snapshots(rows, selected, start, end):
    resolved = defaultdict(list)
    for row in canonical_observations(rows):
        if row.event == RESOLVED:
            key = (*_scope(row), safe_identity_id(row.properties.get("eligibility_product_id")))
            resolved[key].append(row)
    counts, issues = Counter(), Counter()
    for row in canonical_observations(rows):
        p = row.properties
        if row.event not in SNAPSHOT_EVENTS or not start <= row.timestamp < end:
            continue
        if "trial_eligibility_observation_version" not in p:
            counts["legacy_snapshot_observations"] += 1
            continue
        counts["versioned_snapshot_observations"] += 1
        if (
            type(p.get("trial_eligibility_observation_version")) is not int
            or p["trial_eligibility_observation_version"] != 1 or not observation_usable(p)
            or type(p.get("trial_shown")) is not bool
            or p.get("trial_eligibility") not in ("eligible", "ineligible", "unknown", "error", "no_trial")
        ):
            issues["invalid_plan_snapshot"] += 1
            continue
        counts["trial_shown_snapshot_observations"] += p["trial_shown"]
        key = (
            safe_identity_id(p.get("app_user_id")),
            safe_identity_id(p.get("trial_eligibility_request_id")),
            safe_identity_id(p.get("product_id")),
        )
        evidence = [
            candidate for candidate in resolved.get(key, [])
            if observation_usable(candidate.properties)
            and valid_eligibility_payload(candidate.event, candidate.properties, candidate.timestamp)
            and candidate.properties.get("paywall_view_id") == p.get("paywall_view_id")
            and candidate.properties.get("eligibility_observer_active") is True
            and observed_before(candidate, row)
        ]
        if len(evidence) != 1:
            counts["raw_outcome_unavailable_at_snapshot"] += 1
            if p["trial_eligibility"] in ("eligible", "ineligible"):
                issues["known_eligibility_without_product_evidence"] += 1
            continue
        product = evidence[0].properties
        expected = "no_trial" if product["eligibility_outcome"] == "no_intro_offer" else product["eligibility_outcome"]
        if p["trial_eligibility"] != expected or p.get("trial_eligibility_basis") != product["eligibility_basis"]:
            issues["plan_product_outcome_disagreement"] += 1
            continue
        counts["raw_outcome_linked_snapshot_observations"] += 1
        # A product observation can be valid even while other products/request stages are absent.
        unit = selected.get(key[:2])
        counts["complete_request_linked_snapshot_observations"] += bool(unit and unit["status"] == "completed")
    return {"basis": "selected_plan_metadata_not_native_render_acceptance",
            "counts": dict(counts), "quality_issues": dict(issues)}


def paywall_observations_report(rows, *, start, end, coverage_complete=False, history=None):
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("Paywall observation bounds must be ordered and timezone-aware.")
    source = list(history if history is not None else rows)
    if history is not None:
        known = {id(row) for row in source}
        source.extend(row for row in rows if id(row) not in known)
    history_start = min([start, *(row.timestamp for row in source if row.timestamp < end)])
    annotated, source_quality = observe_data_quality(
        source, start=history_start, end=end, coverage_complete=coverage_complete,
        history_scope="supplied_paywall_rows_not_installation_lifetime",
    )
    groups, excluded = defaultdict(list), Counter()
    for row in annotated:
        if row.event not in ELIGIBILITY_EVENTS:
            continue
        key = _scope(row)
        if not all(key):
            if start <= row.timestamp < end:
                excluded["unjoinable_eligibility_observations"] += 1
            continue
        groups[key].append(row)
    requests, selected = [], {}
    for key, items in sorted(groups.items()):
        if not any(start <= row.timestamp < end for row in canonical_observations(items)):
            continue
        unit = _request(key, items)
        requests.append(unit)
        selected[key] = unit
    quality = Counter(excluded)
    for unit in requests:
        quality.update(unit["quality_issues"])
    paywall_origins = _origins(annotated, start, end, "paywall_origin")
    checkout_origins = _origins(annotated, start, end, "checkout_origin")
    snapshots = _snapshots(annotated, selected, start, end)
    for report in (paywall_origins, checkout_origins, snapshots):
        quality.update(report["quality_issues"])
    product_outcomes = Counter(
        product["outcome"] for unit in requests for product in unit["products"] if product["source_usable"]
    )
    return {
        "rule_version": RULE,
        "status": "limited_integrity" if quality else "observed" if coverage_complete else "incomplete_coverage",
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "coverage_complete": coverage_complete, "history_scope": source_quality["history_scope"],
        "selection": "operations_with_new_canonical_observations_in_half_open_window",
        "request_grain": ["app_user_id", "eligibility_request_id"],
        "product_grain": ["app_user_id", "eligibility_request_id", "eligibility_product_id"],
        "requests": requests, "request_status_counts": dict(Counter(unit["status"] for unit in requests)),
        "observed_product_outcomes": dict(product_outcomes),
        "paywall_origins": paywall_origins, "checkout_origins": checkout_origins, "plan_snapshots": snapshots,
        "quality_issues": dict(quality), "quality_issue_count": sum(quality.values()),
        "resolution_rate": None, "displayed_trial_rate": None,
        "historical_delivery_as_of": "not_verified",
        "must_not_be_interpreted_as": [
            "display_acceptance", "trial_start", "conversion", "money", "entitlement",
            "foreground_return", "native_delivery", "remote_config_revision", "complete_installation_history",
        ],
    }


def warehouse_paywall_report(warehouse, *, start, end, contract=None):
    contract = contract or load_contract()
    rows, available_from = available_client_history(warehouse, start, end, contract)
    partitions = partition_days(warehouse, start, end)
    complete = bool(partitions) and all(
        path is not None and isinstance(meta, dict) and type(meta.get("metadata_version")) is int
        and meta["metadata_version"] == 2 and meta.get("complete") is True
        for _, path, meta in partitions
    )
    report = paywall_observations_report(rows, start=start, end=end, coverage_complete=complete)
    report["history_scope"] = "available_warehouse_partitions_before_window_end_not_installation_lifetime"
    report["history_available_from"] = available_from
    return report
