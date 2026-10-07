"""Scoped rewarded SDK diagnostics; client PAID values are not settled money."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from decimal import Decimal

from prawko_analytics.identity import safe_identity_id
from prawko_analytics.ordering import observed_before
from prawko_analytics.quality import nonnegative_number, observation_usable


EVENTS = {
    "ad_requested", "ad_native_request_started", "ad_shown", "ad_impression_observed", "ad_impression_revenue",
    "ad_reward_earned", "ad_dismissed", "ad_failed", "ad_observation_failed",
}
FAILURE_CATEGORIES = {"disabled", "missing_unit_id", "no_fill", "network", "invalid_request", "internal", "sdk_unspecified"}
PRECISIONS = {"unknown", "estimated", "publisher_provided", "precise"}


def _record(row):
    p = row.properties
    install = safe_identity_id(p.get("app_user_id"))
    request, impression = safe_identity_id(p.get("ad_request_id")), safe_identity_id(p.get("ad_impression_id"))
    if not (
        observation_usable(p) and type(p.get("ad_observation_version")) is int and p["ad_observation_version"] == 1
        and install and p.get("ad_format") == "rewarded" and p.get("placement") == "exam_unlock"
        and p.get("ad_unit_basis") in ("test_unit", "configured_unit", "not_resolved")
        and type(p.get("ad_native_load_observed")) is bool and type(p.get("ad_opened_observed")) is bool
        and (p.get("ad_request_id") is None or request) and (p.get("ad_impression_id") is None or impression)
    ):
        return None
    if row.event == "ad_native_request_started" and not (
        request and impression and p.get("ad_native_load_observed") is True
        and p.get("ad_request_basis") == "sdk_load_invoked"
    ):
        return None
    if row.event == "ad_shown" and p.get("ad_opened_observed") is not True:
        return None
    if row.event == "ad_reward_earned" and p.get("reward") != "exam_attempt":
        return None
    if row.event == "ad_impression_observed" and not (
        request and impression and p.get("ad_native_load_observed") is True
        and p.get("ad_impression_basis") == "sdk_paid_callback"
        and type(p.get("ad_native_terminal_observed")) is bool
    ):
        return None
    if row.event == "ad_observation_failed" and not (
        p.get("observation_stage") in ("paid_listener_registration", "paid_payload")
        and p.get("why") in ("unparseable_revenue", "observation_failed")
    ):
        return None
    return install, request, impression


def _paid(p):
    value, currency, precision = p.get("revenue"), p.get("currency"), p.get("revenue_precision")
    if not (
        nonnegative_number(value)
        and isinstance(currency, str) and re.fullmatch("[A-Z]{3}", currency)
        and isinstance(precision, str) and precision in PRECISIONS
        and p.get("ad_paid_basis") == "sdk_paid_value"
        and type(p.get("ad_paid_callback_sequence")) is int and p["ad_paid_callback_sequence"] > 0
        and type(p.get("ad_native_terminal_observed")) is bool
        and safe_identity_id(p.get("ad_request_id")) and safe_identity_id(p.get("ad_impression_id"))
        and p.get("ad_native_load_observed") is True
    ):
        return None
    return Decimal(str(value)), currency, precision


def rewarded_ad_report(rows, *, coverage_complete=False):
    quality, stages, failure_categories, observations = Counter(), Counter(), Counter(), Counter()
    requests, impression_requests, invalid_requests = defaultdict(list), defaultdict(set), set()
    for row in rows:
        if row.event not in EVENTS:
            continue
        p = row.properties
        if p.get("ad_observation_version") is None:
            quality["unversioned_rewarded_observations" if p.get("ad_format") == "rewarded"
                    or p.get("placement") == "exam_unlock" else "other_format_observations"] += 1
            continue
        record = _record(row)
        if not record:
            quality["invalid_observations"] += 1
            key = (safe_identity_id(p.get("app_user_id")), safe_identity_id(p.get("ad_request_id")))
            if all(key):
                invalid_requests.add(key)
            continue
        install, request, impression = record
        observations[row.event] += 1
        if not request:
            quality["unscoped_observations"] += 1
            continue
        requests[(install, request)].append(row)
        if impression:
            impression_requests[(install, impression)].add(request)
    conflicting = {key for key, items in requests.items() if len({
        row.properties["ad_impression_id"] for row in items if row.properties.get("ad_impression_id")
    }) > 1 or len({row.properties["ad_unit_basis"] for row in items}) > 1}
    # not_resolved is legitimate before configuration failure, never mixed with an actual SDK instance.
    for (install, _impression), request_ids in impression_requests.items():
        if len(request_ids) > 1:
            conflicting.update((install, request) for request in request_ids)
    quarantined = conflicting | invalid_requests
    currencies = defaultdict(lambda: {"amount": Decimal(0), "impressions": 0, "precision_counts": Counter()})
    paid_impressions = 0
    for key, items in requests.items():
        names = {row.event for row in items}
        if key in quarantined:
            continue
        stages["opportunity_units"] += 1
        stages["requested_units"] += int("ad_requested" in names)
        native = [row for row in items if row.event == "ad_native_request_started"
                  and row.properties.get("ad_request_basis") == "sdk_load_invoked"
                  and row.properties.get("ad_native_load_observed") is True and row.properties.get("ad_impression_id")]
        stages["native_load_invocation_units"] += bool(native)
        stages["opened_units"] += int("ad_shown" in names)
        stages["earned_reward_units"] += int("ad_reward_earned" in names)
        terminal = [row for row in items if row.event in ("ad_failed", "ad_dismissed")]
        stages["terminal_units"] += bool(terminal)
        stages["terminal_unobserved_units"] += not bool(terminal)
        categories = set()
        for row in terminal:
            if row.event == "ad_failed":
                category = row.properties.get("ad_failure_category")
                stage = row.properties.get("ad_failure_stage")
                if not isinstance(category, str) or category not in FAILURE_CATEGORIES or stage not in (
                    "policy", "configuration", "sdk_event", "load_invocation",
                ):
                    quality["invalid_failure_observations"] += 1
                    continue
                failure_categories[category] += 1
                categories.add(category)
            elif type(row.properties.get("reward_earned")) is not bool:
                quality["invalid_terminal_observations"] += 1
            elif row.properties["reward_earned"] != ("ad_reward_earned" in names):
                quality["reward_terminal_disagreement_units"] += 1
        stages["disabled_opportunity_units"] += int("disabled" in categories)
        stages["missing_unit_opportunity_units"] += int("missing_unit_id" in categories)
        stages["observation_failure_units"] += int("ad_observation_failed" in names)
        evidence = [row for row in items if row.event == "ad_impression_observed"
                    and row.properties.get("ad_impression_basis") == "sdk_paid_callback"
                    and type(row.properties.get("ad_native_terminal_observed")) is bool
                    and row.properties.get("ad_native_load_observed") is True
                    and safe_identity_id(row.properties.get("ad_impression_id"))]
        stages["paid_impression_evidence_units"] += bool(evidence)
        paid_rows = [row for row in items if row.event == "ad_impression_revenue"]
        values = [_paid(row.properties) for row in paid_rows]
        if not paid_rows:
            continue
        if not native or not evidence or any(value is None for value in values) or any(
            not any(observed_before(request, paid) for request in native)
            or not any(observed_before(observation, paid) for observation in evidence)
            for paid in paid_rows
        ):
            quality["invalid_or_unlinked_paid_observations"] += len(paid_rows)
            continue
        signatures = set(values)
        if len(signatures) != 1:
            quality["conflicting_paid_impressions"] += 1
            continue
        quality["duplicate_paid_observations"] += len(paid_rows) - 1
        quality["late_paid_observations"] += sum(row.properties["ad_native_terminal_observed"] for row in paid_rows)
        amount, currency, precision = values[0]
        currencies[currency]["amount"] += amount
        currencies[currency]["impressions"] += 1
        currencies[currency]["precision_counts"][precision] += 1
        paid_impressions += 1
    quality["conflicting_request_scopes"] = len(conflicting)
    quality["quarantined_request_scopes"] = len(quarantined)
    quality["observation_failure_units"] = stages["observation_failure_units"]
    issues = sum(quality[key] for key in (
        "invalid_observations", "unscoped_observations", "conflicting_request_scopes",
        "invalid_failure_observations", "invalid_terminal_observations", "reward_terminal_disagreement_units",
        "invalid_or_unlinked_paid_observations", "conflicting_paid_impressions",
        "observation_failure_units",
    ))
    return {
        "rule_version": "rewarded-sdk-v1", "grain": "installation_request_impression",
        "status": "limited_integrity" if issues else "not_observed" if not requests
                  else "incomplete_coverage" if not coverage_complete else "observed",
        "coverage_complete": coverage_complete, "request_units": len(requests), "stages": dict(stages),
        "event_observations": dict(observations), "failure_categories": dict(failure_categories),
        "paid_impressions": paid_impressions,
        "sdk_paid_values": {
            "basis": "client_sdk_paid_value_not_settled_money",
            "currencies": [
                {"currency": currency, "amount": str(value["amount"]), "impressions": value["impressions"],
                 "precision_counts": dict(value["precision_counts"])}
                for currency, value in sorted(currencies.items())
            ],
        },
        "quality": dict(quality), "quality_issue_count": issues, "confidence_ceiling": "low",
        "must_not_be_interpreted_as": [
            "production_ad_delivery", "settled_revenue", "store_proceeds", "impression_from_opened",
            "reward_grant_from_paid_callback", "verified_admob_reconciliation",
        ],
    }
