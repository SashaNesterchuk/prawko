"""Offline RevenueCat webhook archive, not a second purchase integration.

Authentication and export coverage are assertions made by the archive producer.
Nothing in this module changes entitlements or treats client prices as money.
"""

from __future__ import annotations

import hashlib
import json
import re
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import TYPE_CHECKING

from prawko_analytics.payload_validation import invalid_client_payload

if TYPE_CHECKING:
    from prawko_analytics.context import PreparedRow

LEDGER_VERSION = 1
MONEY_BASIS = "revenuecat_reported_gross_event_activity"
ARCHIVE_FORMAT = "revenuecat_webhook_archive_v1"
CHARGE_TYPES = {"INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"}
STORES = {"APP_STORE", "MAC_APP_STORE", "PLAY_STORE", "STRIPE", "AMAZON", "RC_BILLING", "PADDLE"}
UTC = timezone.utc


def ledger_path(warehouse: Path) -> Path:
    return warehouse / "revenuecat" / "ledger.json"


def ingest_revenuecat(archive: Path, warehouse: Path) -> dict:
    payload = json.loads(archive.read_text(), parse_float=Decimal)
    source, exported_at = _source(payload)
    raw_events = payload.get("events")
    if not isinstance(raw_events, list):
        raise ValueError("RevenueCat archive events must be an array.")
    incoming = [_normalize(raw, source, exported_at) for raw in raw_events]
    path = ledger_path(warehouse)
    previous = _read_ledger(path)
    events = list(previous["events"])
    by_key = {_event_key(event): event for event in events}
    duplicates = 0
    for event in incoming:
        key = _event_key(event)
        if key in by_key:
            duplicates += 1
            current = by_key[key]
            current["verified"] = current["verified"] or event["verified"]
            current["first_exported_at"] = min(current["first_exported_at"], event["first_exported_at"])
            current["source_ids"] = sorted(set(current["source_ids"] + event["source_ids"]))
            received = [value for value in (current["received_at"], event["received_at"]) if value]
            current["received_at"] = min(received) if received else None
        else:
            by_key[key] = event
            events.append(event)
    # Keep conflicting variants. Reporting quarantines every variant of that ID.
    archive_id = _fingerprint({
        "source": source,
        "exported_at": exported_at,
        "coverage": payload.get("coverage"),
        "events": sorted((_event_key(event) for event in incoming), key=_fingerprint),
    })
    manifest = {
        "archive_id": archive_id,
        "source": source,
        "exported_at": exported_at,
        "coverage": _coverage(payload.get("coverage"), exported_at),
        "event_rows": len(incoming),
        "event_keys": sorted({_event_key(event) for event in incoming}, key=_fingerprint),
        "receipts": [
            {"event_key": _event_key(event), "received_at": event["received_at"]}
            for event in incoming if event["received_at"] is not None
        ],
    }
    imports = {item["archive_id"]: item for item in previous["imports"]}
    imports.setdefault(archive_id, manifest)
    ledger = {
        "ledger_version": LEDGER_VERSION,
        "events": sorted(events, key=lambda event: (event["generated_at"], _fingerprint(_event_key(event)))),
        "imports": sorted(imports.values(), key=lambda item: (item["exported_at"], item["archive_id"])),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent) as temporary:
        replacement = Path(temporary) / "ledger.json"
        replacement.write_text(json.dumps(ledger, indent=2) + "\n")
        replacement.replace(path)
    conflicts = _provider_conflicts(ledger["events"])
    return {
        "path": str(path),
        "event_rows": len(events),
        "incoming_rows": len(incoming),
        "duplicate_rows": duplicates,
        "conflicting_provider_ids": len(conflicts),
        "source_verification": source["verification_basis"],
    }


def financial_report(
    warehouse: Path,
    *,
    start: datetime,
    end: datetime,
    client_rows: list[PreparedRow] | None = None,
    as_of: datetime | None = None,
    include_history: bool = False,
) -> dict:
    start, end = _aware(start), _aware(end)
    if start >= end:
        raise ValueError("Financial window start must be before end.")
    path = ledger_path(warehouse)
    if not path.is_file():
        return {
            "status": "not_loaded",
            "basis": MONEY_BASIS,
            "complete": False,
            "as_of": None,
            "currencies": [],
            "reconciliation": {"status": "not_loaded", "items": []},
        }
    ledger = _read_ledger(path)
    manifests = ledger["imports"]
    latest = max(_timestamp(item["exported_at"]) for item in manifests)
    cutoff = _aware(as_of) if as_of is not None else latest
    manifests = [item for item in manifests if _timestamp(item["exported_at"]) <= cutoff]
    # An earlier as-of report cannot use events first observed in a later archive.
    available_keys: set[tuple] = set()
    verified_keys: set[tuple] = set()
    receipts: dict[tuple, list[str]] = defaultdict(list)
    for item in manifests:
        source = item["source"]
        for key in item["event_keys"]:
            available_keys.add(tuple(key))
            if source["verification_basis"] == "authenticated_webhook_archive":
                verified_keys.add(tuple(key))
        for observation in item["receipts"]:
            receipts[tuple(observation["event_key"])].append(observation["received_at"])
    events = [
        {**event, "verified": _event_key(event) in verified_keys,
         "received_at": min(receipts[_event_key(event)]) if receipts[_event_key(event)] else None}
        for event in ledger["events"]
        if _timestamp(event["generated_at"]) <= cutoff
        and _event_key(event) in available_keys
    ]
    conflicts = _provider_conflicts(events)
    clean = [event for event in events if _provider_key(event) not in conflicts]
    selected = [event for event in clean if start <= _timestamp(event["generated_at"]) < end]
    verified_sources = {
        (item["source"]["project_id"], app_id)
        for item in manifests
        if item["source"]["verification_basis"] == "authenticated_webhook_archive"
        and "PRODUCTION" in item["source"].get("environments", [])
        for app_id in item["source"]["app_ids"]
    }
    complete = bool(verified_sources) and all(
        _covered(manifests, project_id, app_id, start, end, cutoff)
        for project_id, app_id in verified_sources
    ) and all((event["project_id"], event["app_id"]) in verified_sources for event in selected)
    lifecycle = Counter()
    excluded = Counter()
    issues = Counter()
    candidates: list[dict] = []
    lifecycle_observations: list[dict] = []
    for event in selected:
        if event["environment"] != "PRODUCTION":
            excluded[f"environment_{(event['environment'] or 'unknown').lower()}"] += 1
            if event["environment"] != "SANDBOX":
                issues["environment_unknown"] += 1
            continue
        if not event["verified"]:
            excluded["unverified_source"] += 1
            continue
        lifecycle[_lifecycle(event)] += 1
        if event["app_id"] is None:
            issues["lifecycle_app_scope_missing"] += 1
        if _lifecycle(event) == "unrecognized_event_type":
            issues["unrecognized_event_type"] += 1
        lifecycle_observations.append({
            field: event[field] for field in (
                "project_id", "app_id", "event_id", "event_type", "generated_at", "received_at",
                "purchased_at", "expires_at", "grace_period_expires_at", "app_user_id",
                "transaction_id", "original_transaction_id", "product_id", "new_product_id",
                "environment", "store", "period_type", "is_trial_conversion",
                "cancel_reason", "expiration_reason", "entitlement_ids",
            )
        })
        effect, problem = _money_effect(event)
        if problem:
            issues[problem] += 1
        if effect is not None:
            candidates.append(effect)
    # Check business conflicts over all observations, not just the selected window.
    all_effects = [
        effect for event in clean
        if event["verified"] and event["environment"] == "PRODUCTION"
        for effect, _problem in [_money_effect(event)]
        if effect is not None
    ]
    business: dict[tuple, list[dict]] = defaultdict(list)
    for effect in all_effects:
        business[_effect_key(effect)].append(effect)
    business_conflicts = {
        key for key, group in business.items()
        if len({_economic_signature(item) for item in group}) > 1
    }
    # A second refund after a reversal cannot be distinguished from replay without
    # a provider adjustment ID. Do not guess how many financial cycles occurred.
    by_transaction: dict[tuple, list[dict]] = defaultdict(list)
    for effect in all_effects:
        by_transaction[_transaction_key(effect)].append(effect)
    provider_transactions: dict[tuple, list[dict]] = defaultdict(list)
    for effect in all_effects:
        key = effect["environment"], effect["store"], effect["transaction_id"]
        provider_transactions[key].append(effect)
    for group in provider_transactions.values():
        if len({(item["project_id"], item["app_id"]) for item in group}) > 1:
            business_conflicts.update(_effect_key(item) for item in group)
            issues["cross_app_transaction_ambiguity"] += 1
    for group in by_transaction.values():
        refunds = [item for item in group if item["kind"] == "refund"]
        reversals = [item for item in group if item["kind"] == "refund_reversed"]
        if refunds and reversals and any(
            item["generated_at"] > reversal["generated_at"]
            for item in refunds for reversal in reversals
        ):
            business_conflicts.update(_effect_key(item) for item in group)
            issues["ambiguous_adjustment_cycle"] += 1
    # A duplicate business observation in another export/window has no new effect.
    canonical = {
        key: min(group, key=lambda item: (item["generated_at"], item["event_id"]))
        for key, group in business.items() if key not in business_conflicts
    }
    effects = [
        item for item in canonical.values()
        if start <= _timestamp(item["generated_at"]) < end
    ]
    totals: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"charges": Decimal(0), "refunds": Decimal(0), "refund_reversals": Decimal(0)}
    )
    usd = {"charges": Decimal(0), "refunds": Decimal(0), "refund_reversals": Decimal(0)}
    usd_missing = 0
    for item in effects:
        column = {"charge": "charges", "refund": "refunds", "refund_reversed": "refund_reversals"}[item["kind"]]
        totals[item["currency"]][column] += Decimal(item["amount"])
        if item["amount_usd"] is not None:
            usd[column] += Decimal(item["amount_usd"])
        else:
            usd_missing += 1
    currencies = [
        {"currency": currency, **{key: _decimal(value) for key, value in values.items()},
         "net_gross": _decimal(sum(values.values(), Decimal(0)))}
        for currency, values in sorted(totals.items())
    ]
    scoped_conflicts = {
        key for key in conflicts
        if any(_provider_key(event) == key and start <= _timestamp(event["generated_at"]) < end for event in events)
    }
    issues["provider_id_conflicts"] = len(scoped_conflicts)
    issues["business_effect_conflicts"] = len({
        _effect_key(item) for item in candidates if _effect_key(item) in business_conflicts
    })
    if any(issues.values()) or excluded["unverified_source"] or not complete:
        status = "limited"
    else:
        status = "observed_complete_as_of"
    report = {
        "report_version": 1,
        "status": status,
        "basis": MONEY_BASIS,
        "window_basis": "revenuecat_event_generated_at",
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "as_of": min(latest, cutoff).isoformat(),
        "source_verification": "producer_assertion_not_verified_by_engine",
        "complete": complete,
        "source_projects": sorted({item["source"]["project_id"] for item in manifests}),
        "source_coverage": [
            {"project_id": item["source"]["project_id"], "source_id": item["source"]["source_id"],
             "app_ids": item["source"]["app_ids"], "exported_at": item["exported_at"],
             "environments": item["source"].get("environments", []),
             "verification_basis": item["source"]["verification_basis"],
             "coverage": item["coverage"]}
            for item in manifests
        ],
        "lifecycle": dict(sorted(lifecycle.items())),
        "lifecycle_grain": "revenuecat_provider_event",
        "lifecycle_observations": lifecycle_observations,
        "excluded": dict(sorted(excluded.items())),
        "issues": {key: count for key, count in sorted(issues.items()) if count},
        "duplicate_business_observations": len(candidates) - len({
            _effect_key(item) for item in candidates
        }),
        "currencies": currencies,
        "totals_scope": "observed_valid_nonconflicting_effects_only",
        "usd": {
            "basis": "revenuecat_webhook_converted_usd",
            **{key: _decimal(value) for key, value in usd.items()},
            "net_gross": _decimal(sum(usd.values(), Decimal(0)))
                if not usd_missing and status == "observed_complete_as_of" else None,
            "missing_effects": usd_missing,
        },
        "effects": sorted(effects, key=lambda item: (item["generated_at"], item["event_id"])),
        "reconciliation": _reconcile(
            effects, list(canonical.values()),
            [event for event in clean if event["verified"] and event["environment"] == "PRODUCTION"],
            business_conflicts, client_rows, start, end,
        ),
        "must_not_claim": [
            "settled_revenue", "bank_payout", "store_proceeds",
            "exact_paywall_attribution", "account_unique_payers",
        ],
    }
    if include_history:
        fields = (
            "project_id", "app_id", "event_id", "event_type", "generated_at", "purchased_at",
            "transaction_id", "original_transaction_id", "app_user_id", "original_app_user_id",
            "aliases", "transferred_from", "transferred_to", "store", "environment",
            "product_id", "period_type", "is_family_share", "currency",
            "expires_at", "cancel_reason", "is_trial_conversion",
        )
        report["history"] = {
            "scope": "available_archive_events_as_of_not_installation_lifetime",
            "observations": [
                {**{field: event[field] for field in fields}, "verified": event["verified"],
                 "provider_conflict": _provider_key(event) in conflicts,
                 "lifecycle_kind": _lifecycle(event),
                 "money_kind": (_money_effect(event)[0] or {}).get("kind"),
                 "money_issue": _money_effect(event)[1]}
                for event in events
            ],
            "canonical_effects": sorted(canonical.values(), key=lambda item: (item["generated_at"], item["event_id"])),
            "quarantined_effects": [
                dict(zip(("project_id", "app_id", "environment", "store", "transaction_id", "kind"), key, strict=True))
                for key in sorted(business_conflicts)
            ],
        }
    return report


def financial_scope_covered(report, *, project_id, app_id, start, end):
    """Producer-asserted coverage for one app, not the global archive union."""
    if report.get("as_of") is None:
        return False
    manifests = [
        {"source": {field: item[field] for field in ("project_id", "app_ids", "environments", "verification_basis")},
         "coverage": item["coverage"]}
        for item in report.get("source_coverage", [])
    ]
    return _covered(manifests, project_id, app_id, _aware(start), _aware(end), _timestamp(report["as_of"]))


def _source(payload: dict) -> tuple[dict, str]:
    if not isinstance(payload, dict) or payload.get("format") != ARCHIVE_FORMAT:
        raise ValueError(f"Expected format={ARCHIVE_FORMAT}.")
    raw = payload.get("source")
    if not isinstance(raw, dict) or raw.get("provider") != "revenuecat":
        raise ValueError("RevenueCat source provenance is required.")
    basis = raw.get("verification_basis")
    if basis not in {"authenticated_webhook_archive", "unverified_archive"}:
        raise ValueError("Unknown RevenueCat archive verification basis.")
    exported = _timestamp(payload["exported_at"]).isoformat()
    app_ids = raw.get("app_ids")
    if not isinstance(app_ids, list) or not app_ids:
        raise ValueError("Declare the RevenueCat apps covered by this source.")
    environments = raw.get("environments")
    if (not isinstance(environments, list) or not environments
            or any(value not in ("PRODUCTION", "SANDBOX") for value in environments)):
        raise ValueError("Declare the RevenueCat environments covered by this source.")
    source = {
        "provider": "revenuecat",
        "project_id": _identifier(raw.get("project_id"), required=True),
        "source_id": _identifier(raw.get("source_id"), required=True),
        "app_ids": sorted({_identifier(value, required=True) for value in app_ids}),
        "environments": sorted(set(environments)),
        "verification_basis": basis,
    }
    if basis == "authenticated_webhook_archive":
        verified_at = _timestamp(raw["verified_at"])
        if verified_at > _timestamp(exported):
            raise ValueError("Source verification cannot postdate export.")
        source["verified_at"] = verified_at.isoformat()
    return source, exported


def _normalize(raw: dict, source: dict, exported_at: str) -> dict:
    if not isinstance(raw, dict) or raw.get("api_version") != "1.0" or not isinstance(raw.get("event"), dict):
        raise ValueError("Expected RevenueCat webhook api_version=1.0 and event object.")
    event = raw["event"]
    app_id = _identifier(event.get("app_id"))
    if app_id is not None and app_id not in source["app_ids"]:
        raise ValueError("Event app_id is outside the declared source.")
    generated = _milliseconds(event.get("event_timestamp_ms"), required=True)
    if event.get("environment") in ("PRODUCTION", "SANDBOX"):
        if event["environment"] not in source["environments"]:
            raise ValueError("Event environment is outside the declared source.")
    if _timestamp(generated) > _timestamp(exported_at):
        raise ValueError("RevenueCat event generation postdates its export.")
    received = raw.get("received_at")
    received = _timestamp(received).isoformat() if received is not None else None
    if received is not None and not (_timestamp(generated) <= _timestamp(received) <= _timestamp(exported_at)):
        raise ValueError("Provider generation, archive receipt and export must be ordered.")
    normalized = {
        "project_id": source["project_id"],
        "app_id": app_id,
        "event_id": _identifier(event.get("id"), required=True),
        "event_type": _identifier(event.get("type"), required=True),
        "generated_at": generated,
        "purchased_at": _milliseconds(event.get("purchased_at_ms")),
        "expires_at": _milliseconds(event.get("expiration_at_ms")),
        "grace_period_expires_at": _milliseconds(event.get("grace_period_expiration_at_ms")),
        "transaction_id": _identifier(event.get("transaction_id")),
        "original_transaction_id": _identifier(event.get("original_transaction_id")),
        "app_user_id": _identifier(event.get("app_user_id")),
        "original_app_user_id": _identifier(event.get("original_app_user_id")),
        "aliases": _identifiers(event.get("aliases")),
        "transferred_from": _identifiers(event.get("transferred_from")),
        "transferred_to": _identifiers(event.get("transferred_to")),
        "entitlement_ids": _identifiers(event.get("entitlement_ids")),
        "product_id": _identifier(event.get("product_id")),
        "new_product_id": _identifier(event.get("new_product_id")),
        "environment": _enum(event.get("environment"), {"PRODUCTION", "SANDBOX"}),
        "store": _identifier(event.get("store")),
        "period_type": _enum(event.get("period_type"), {"TRIAL", "INTRO", "NORMAL", "PREPAID"}),
        "is_trial_conversion": _boolean(event.get("is_trial_conversion")),
        "is_family_share": _boolean(event.get("is_family_share")),
        "cancel_reason": _identifier(event.get("cancel_reason")),
        "expiration_reason": _identifier(event.get("expiration_reason")),
        "currency": _currency(event.get("currency")),
        "price": _amount(event.get("price")),
        "price_in_purchased_currency": _amount(event.get("price_in_purchased_currency")),
        "tax_percentage": _percentage(event.get("tax_percentage")),
        "commission_percentage": _percentage(event.get("commission_percentage")),
        "takehome_percentage": _percentage(event.get("takehome_percentage")),
    }
    return {
        **normalized,
        "payload_hash": _fingerprint(normalized),
        "received_at": received,
        "first_exported_at": exported_at,
        "verified": source["verification_basis"] == "authenticated_webhook_archive",
        "source_ids": [source["source_id"]],
    }


def _lifecycle(event: dict) -> str:
    kind = event["event_type"]
    if kind == "INITIAL_PURCHASE":
        return "trial_started" if event["period_type"] == "TRIAL" else "initial_purchase"
    if kind == "RENEWAL":
        return "trial_converted" if event["is_trial_conversion"] is True else "renewal"
    if kind == "NON_RENEWING_PURCHASE":
        return "non_recurring_purchase"
    if kind == "CANCELLATION":
        if event["cancel_reason"] == "CUSTOMER_SUPPORT":
            return "refund"
        return "auto_renew_cancelled" if event["cancel_reason"] == "UNSUBSCRIBE" else "cancellation_observed"
    return {
        "UNCANCELLATION": "auto_renew_resumed",
        "BILLING_ISSUE": "billing_issue",
        "EXPIRATION": "expired",
        "REFUND_REVERSED": "refund_reversed",
        "SUBSCRIPTION_PAUSED": "subscription_paused",
        "SUBSCRIPTION_EXTENDED": "subscription_extended",
        "PRODUCT_CHANGE": "product_change",
        "TRANSFER": "transfer",
        "TEMPORARY_ENTITLEMENT_GRANT": "temporary_entitlement",
        "TEST": "test",
    }.get(kind, "unrecognized_event_type")


def _money_effect(event: dict) -> tuple[dict | None, str | None]:
    kind = event["event_type"]
    if event["is_family_share"] is True:
        return None, None
    if kind in CHARGE_TYPES:
        if kind != "NON_RENEWING_PURCHASE" and event["period_type"] not in {"TRIAL", "INTRO", "NORMAL", "PREPAID"}:
            return None, "charge_period_missing"
        if event["period_type"] == "TRIAL":
            return None, None
        effect_kind = "charge"
        sign = 1
    elif kind == "CANCELLATION" and event["cancel_reason"] == "CUSTOMER_SUPPORT":
        effect_kind, sign = "refund", -1
    elif kind == "REFUND_REVERSED":
        effect_kind, sign = "refund_reversed", 1
    else:
        if kind == "CANCELLATION" and event["price_in_purchased_currency"] is not None:
            if Decimal(event["price_in_purchased_currency"]) < 0:
                return None, "unclassified_negative_adjustment"
        return None, None
    if not event["app_id"] or not event["transaction_id"] or not event["product_id"] or event["store"] not in STORES:
        return None, "financial_scope_missing"
    if event["currency"] is None or event["price_in_purchased_currency"] is None:
        return None, "financial_amount_missing"
    amount = Decimal(event["price_in_purchased_currency"])
    if amount == 0:
        return None, None
    if amount * sign < 0:
        return None, "financial_amount_sign_conflict"
    if event["price"] is not None and Decimal(event["price"]) * sign < 0:
        return None, "financial_usd_sign_conflict"
    return {
        "project_id": event["project_id"],
        "app_id": event["app_id"],
        "event_id": event["event_id"],
        "event_type": kind,
        "app_user_id": event["app_user_id"],
        "transaction_id": event["transaction_id"],
        "original_transaction_id": event["original_transaction_id"],
        "store": event["store"],
        "environment": event["environment"],
        "product_id": event["product_id"],
        "period_type": event["period_type"],
        "kind": effect_kind,
        "currency": event["currency"],
        "amount": _decimal(amount),
        "amount_usd": event["price"],
        "generated_at": event["generated_at"],
        "purchased_at": event["purchased_at"],
    }, None


def _reconcile(
    effects: list[dict],
    known_effects: list[dict],
    observations: list[dict],
    business_conflicts: set[tuple],
    rows: list[PreparedRow] | None,
    start: datetime,
    end: datetime,
) -> dict:
    if rows is None:
        return {"status": "client_source_not_loaded", "items": []}
    charges = [item for item in effects if item["kind"] == "charge"]
    charge_keys = {_transaction_key(item) for item in charges}
    known_charge_keys = {_transaction_key(item) for item in known_effects if item["kind"] == "charge"}
    by_id: dict[str, list[dict]] = defaultdict(list)
    server_events: dict[tuple, dict] = {}
    for item in sorted(observations, key=lambda item: (item["generated_at"], item["event_id"])):
        if item["event_type"] not in CHARGE_TYPES or not item["transaction_id"]:
            continue
        if (*_transaction_key(item), "charge") in business_conflicts:
            continue
        signature = (*_transaction_key(item), item["product_id"], item["period_type"], item["app_user_id"])
        server_events.setdefault(signature, item)
    for item in server_events.values():
        by_id[item["transaction_id"]].append(item)
    items = []
    observed: set[tuple] = set()
    matched: set[tuple] = set()
    duplicates = 0
    pre_window_replays = 0
    for row in rows:
        if row.event not in {"purchase_succeeded", "purchase_access_confirmed"}:
            continue
        if not start <= _aware(row.timestamp) < end:
            continue
        props = row.properties
        if props.get("_warehouse_business_duplicate_before_window") is True:
            pre_window_replays += 1
            continue
        if props.get("_warehouse_business_duplicate") is True:
            duplicates += 1
            continue
        identifiers = {
            field: _client_identifier(props.get(field)) for field in (
                "transaction_id", "purchase_attempt_id", "paywall_view_id", "product_id",
                "store", "store_environment", "revenuecat_app_id", "revenuecat_project_id",
            )
        }
        invalid_identifiers = any(
            props.get(field) is not None and value is None for field, value in identifiers.items()
        )
        transaction = identifiers["transaction_id"]
        attempt = identifiers["purchase_attempt_id"]
        client_event_id = _client_identifier(row.client_event_id or row.event_id) or (
            "untrusted_" + _fingerprint(row.client_event_id or row.event_id)[:16]
        )
        key = (_client_identifier(row.analysis_key), row.event, attempt or client_event_id)
        if key in observed:
            duplicates += 1
            continue
        observed.add(key)
        result = {
            "client_event": row.event,
            "client_event_id": client_event_id,
            "purchase_attempt_id": attempt,
            "transaction_id": transaction if isinstance(transaction, str) else None,
            "paywall_view_id": identifiers["paywall_view_id"],
            "status": "transaction_id_missing",
        }
        if invalid_identifiers:
            result["status"] = "invalid_client_identifiers"
            items.append(result)
            continue
        if not isinstance(transaction, str) or not transaction:
            items.append(result)
            continue
        candidates = list(by_id.get(transaction, []))
        # Client metadata is optional. Missing store/environment/app is not silently
        # upgraded to an exact match, even if a transaction ID happens to be unique.
        scope = {
            "store": identifiers["store"],
            "environment": identifiers["store_environment"],
            "app_id": identifiers["revenuecat_app_id"],
            "project_id": identifiers["revenuecat_project_id"],
        }
        candidates = [
            item for item in candidates
            if all(value is None or item[field] == value for field, value in scope.items())
        ]
        if not candidates:
            result["status"] = "server_transaction_not_observed"
        elif len(candidates) > 1:
            result["status"] = "transaction_scope_ambiguous"
        else:
            candidate = candidates[0]
            if not row.analysis_key or row.key_source != "primary" or candidate["app_user_id"] != row.analysis_key:
                result["status"] = "installation_identity_mismatch"
            elif identifiers["product_id"] != candidate["product_id"]:
                result["status"] = "product_mismatch"
            elif row.properties.get("_warehouse_import_conflict") is True:
                result["status"] = "client_import_identity_conflict"
            elif invalid_client_payload(row.properties):
                result["status"] = "invalid_client_payload"
            elif row.properties.get("_warehouse_business_conflict") is True:
                result["status"] = "client_business_identity_conflict"
            elif row.properties.get("_warehouse_business_invalid") is True:
                result["status"] = "invalid_client_business_observation"
            elif row.properties.get("_warehouse_business_order_uncertain") is True:
                result["status"] = "client_business_order_unproven"
            else:
                result["status"] = "matched" if all(scope.values()) else "unique_candidate_scope_incomplete"
                result["server_event_id"] = candidate["event_id"]
                result["server_period_type"] = candidate["period_type"]
                result["financial_charge_observed"] = _transaction_key(candidate) in known_charge_keys
                result["financial_charge_in_report_window"] = _transaction_key(candidate) in charge_keys
                matched.add(_transaction_key(candidate))
        items.append(result)
    counts = Counter(item["status"] for item in items)
    unmatched = [
        {"event_id": item["event_id"], "transaction_id": item["transaction_id"],
         "event_type": item["event_type"],
         "reason": "renewal_without_client_expected" if item["event_type"] == "RENEWAL"
             else "client_purchase_not_observed"}
        for item in charges if _transaction_key(item) not in matched
    ]
    return {
        "status": "observed_only",
        "client_coverage": "not_verified",
        "counts": dict(sorted(counts.items())),
        "duplicate_client_observations": duplicates,
        "pre_window_business_replays": pre_window_replays,
        "items": items,
        "server_only": unmatched,
        "exact_paywall_attribution": False,
    }


def _coverage(raw: object, exported_at: str) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("pagination_complete") is not True or raw.get("truncated") is not False:
        return None
    if raw.get("time_basis") != "revenuecat_event_generated_at":
        return None
    try:
        start, end, watermark = (_timestamp(raw[key]) for key in ("window_start", "window_end", "delivery_watermark"))
    except (KeyError, TypeError, ValueError):
        return None
    if not start < end <= watermark <= _timestamp(exported_at):
        return None
    return {
        "time_basis": "revenuecat_event_generated_at",
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "delivery_watermark": watermark.isoformat(),
    }


def _covered(manifests: list[dict], project: str, app: str, start: datetime, end: datetime, as_of: datetime) -> bool:
    spans = []
    for item in manifests:
        source, coverage = item["source"], item["coverage"]
        if (source["project_id"] != project or app not in source["app_ids"] or coverage is None
                or source["verification_basis"] != "authenticated_webhook_archive"
                or "PRODUCTION" not in source.get("environments", [])):
            continue
        if _timestamp(coverage["delivery_watermark"]) <= as_of:
            spans.append((_timestamp(coverage["window_start"]), _timestamp(coverage["window_end"])))
    covered_to = start
    for left, right in sorted(spans):
        if left > covered_to:
            break
        covered_to = max(covered_to, right)
    return covered_to >= end


def _read_ledger(path: Path) -> dict:
    if not path.is_file():
        return {"ledger_version": LEDGER_VERSION, "events": [], "imports": []}
    payload = json.loads(path.read_text())
    if payload.get("ledger_version") != LEDGER_VERSION:
        raise ValueError("Unsupported RevenueCat ledger version.")
    return payload


def _provider_key(event: dict) -> tuple:
    return event["project_id"], event["app_id"], event["event_id"]


def _event_key(event: dict) -> tuple:
    return (*_provider_key(event), event["payload_hash"])


def _provider_conflicts(events: list[dict]) -> set[tuple]:
    hashes: dict[tuple, set[str]] = defaultdict(set)
    for event in events:
        hashes[_provider_key(event)].add(event["payload_hash"])
    return {key for key, variants in hashes.items() if len(variants) > 1}


def _transaction_key(effect: dict) -> tuple:
    return tuple(effect[field] for field in ("project_id", "app_id", "environment", "store", "transaction_id"))


def _effect_key(effect: dict) -> tuple:
    return (*_transaction_key(effect), effect["kind"])


def _economic_signature(effect: dict) -> tuple:
    return tuple(effect[field] for field in (
        "product_id", "period_type", "currency", "amount", "amount_usd", "original_transaction_id",
    ))


def _identifier(value: object, *, required: bool = False) -> str | None:
    if value is None and not required:
        return None
    if (not isinstance(value, str) or not value or len(value) > 256
            or "@" in value or "://" in value or any(ord(char) < 32 for char in value)):
        raise ValueError("Expected a bounded non-PII RevenueCat identifier.")
    return value


def _client_identifier(value: object) -> str | None:
    try:
        return _identifier(value)
    except ValueError:
        return None


def _identifiers(values: object) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list) or len(values) > 100:
        raise ValueError("Expected a bounded RevenueCat identifier array.")
    return sorted({_identifier(value, required=True) for value in values})


def _currency(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or re.fullmatch(r"[A-Z]{3}", value) is None:
        raise ValueError("Expected a three-letter currency code.")
    return value


def _enum(value: object, accepted: set[str]) -> str | None:
    if value is None:
        return None
    text = _identifier(value, required=True)
    return text if text in accepted else f"unknown:{text}"


def _boolean(value: object) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    raise ValueError("Expected a RevenueCat boolean or null.")


def _amount(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise ValueError("Expected a decimal RevenueCat amount.")
    try:
        amount = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError("Invalid RevenueCat decimal amount.") from error
    if not amount.is_finite() or abs(amount) > Decimal("1000000000") or amount.as_tuple().exponent < -12:
        raise ValueError("RevenueCat amount is outside the supported bounds.")
    return _decimal(amount)


def _percentage(value: object) -> str | None:
    amount = _amount(value)
    if amount is not None and not Decimal(0) <= Decimal(amount) <= Decimal(1):
        raise ValueError("Expected a RevenueCat fraction between zero and one.")
    return amount


def _decimal(value: Decimal) -> str:
    return format(value.normalize(), "f") if value else "0"


def _milliseconds(value: object, *, required: bool = False) -> str | None:
    if value is None and not required:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Expected integer RevenueCat epoch milliseconds.")
    return datetime.fromtimestamp(value / 1000, tz=UTC).isoformat()


def _timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Expected an explicit timezone-aware timestamp.")
    return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Financial timestamps must have an explicit timezone.")
    return value.astimezone(UTC)


def _fingerprint(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()
