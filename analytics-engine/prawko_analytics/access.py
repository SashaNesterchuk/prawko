"""Feature-specific local-access observations, not automatic product defects."""

from __future__ import annotations

from collections import Counter, defaultdict

from prawko_analytics.identity import safe_identity_id
from prawko_analytics.quality import nonnegative_number, observation_usable


ACCESS_EVENTS = {
    "premium_gate_viewed", "ai_chat_access_blocked", "offline_access_blocked",
    "learning_access_blocked", "answer_explanation_viewed",
}
OBSERVED = {"blocked", "available", "premium_mark", "upsell", "non_entitlement_block", "ambiguous_gate"}
COMPARISONS = {"consistent", "not_comparable", "blocked_despite_plus", "premium_content_without_plus"}
SOURCES = {"none", "purchase", "school", "other", "runtime_override"}


def feature_access_report(rows, *, coverage_complete: bool = False) -> dict:
    buckets = defaultdict(lambda: {"events": 0, "installs": set(), "sources": Counter(), "ages": []})
    invalid = 0
    uninstrumented = 0
    clock_issues = 0
    for row in rows:
        event = row.event
        props = row.properties
        if event not in ACCESS_EVENTS:
            continue
        if "access_observation_version" not in props:
            uninstrumented += 1
            continue
        expected = props.get("access_expected")
        observed = props.get("access_observed")
        comparison = props.get("access_comparison")
        plus = props.get("access_expected_is_plus")
        feature = safe_identity_id(props.get("access_observed_feature"))
        install = safe_identity_id(props.get("app_user_id"))
        age = props.get("access_customer_info_age_ms")
        clock = props.get("access_customer_info_clock_order")
        valid_age = age is None or (
            nonnegative_number(age)
        )
        inferred_comparison = "blocked_despite_plus" if expected == "allowed" and observed == "blocked" else (
            "premium_content_without_plus" if expected == "blocked" and observed == "available"
            else "not_comparable" if expected == "not_evaluated" else "consistent"
        )
        if not (
            observation_usable(props)
            and type(props.get("access_observation_version")) is int and props["access_observation_version"] == 1
            and props.get("access_rule_version") == "plus-feature-observation-v1"
            and props.get("access_snapshot_basis") == "current_local_entitlement_store"
            and isinstance(expected, str) and expected in {"allowed", "blocked", "not_evaluated"}
            and isinstance(observed, str) and observed in OBSERVED
            and isinstance(comparison, str) and comparison in COMPARISONS and comparison == inferred_comparison
            and type(plus) is bool and feature and install
            and isinstance(props.get("access_expected_source"), str)
            and props["access_expected_source"] in SOURCES and valid_age
            and isinstance(clock, str) and clock in {"ordered", "future", "not_recorded"}
            and (age is None if clock != "ordered" else age is not None)
            and (expected != "allowed" or plus is True)
            and (expected != "blocked" or plus is False)
            and (expected == "not_evaluated" or observed in {"blocked", "available"})
        ):
            invalid += 1
            continue
        clock_issues += clock == "future"
        bucket = buckets[(feature, comparison)]
        bucket["events"] += 1
        bucket["installs"].add(install)
        bucket["sources"][props["access_expected_source"]] += 1
        if age is not None:
            bucket["ages"].append(age)
    observed_events = sum(bucket["events"] for bucket in buckets.values())
    return {
        "observation_version": 1,
        "status": "not_observed" if not observed_events and not invalid else (
            "limited" if invalid or not coverage_complete else "observed"
        ),
        "grain": "canonical_event_observation", "identity_grain": "app_user_id_installation",
        "coverage_complete": coverage_complete, "observed_events": observed_events,
        "invalid_observations": invalid, "uninstrumented_surface_events": uninstrumented,
        "customer_info_clock_issues": clock_issues,
        "potential_mismatch_events": sum(
            bucket["events"] for (_feature, comparison), bucket in buckets.items()
            if comparison in {"blocked_despite_plus", "premium_content_without_plus"}
        ),
        "groups": [{
            "feature": feature, "comparison": comparison, "event_rows": bucket["events"],
            "installations": len(bucket["installs"]), "access_sources": dict(sorted(bucket["sources"].items())),
            "max_customer_info_age_ms": max(bucket["ages"], default=None),
            "unknown_customer_info_age_rows": bucket["events"] - len(bucket["ages"]),
        } for (feature, comparison), bucket in sorted(buckets.items())],
        "limitations": [
            "A mismatch compares event-time local access with an existing surface observation, not verified money.",
            "It can reflect a stale render or asynchronous state change; it is not automatically a product defect.",
            "CustomerInfo age uses RevenueCat requestDate, not a guarantee of server freshness.",
            "Remote entitlement verification age is not recorded; paid/trial history requires the financial source.",
            "Counts are observations, not distinct blocker episodes, people, or a complete access-error rate.",
        ],
    }
