"""Reviewed native/RevenueCat namespaces, independent of acquisition channels."""

from __future__ import annotations

import json
import tempfile
from datetime import datetime
from pathlib import Path

from prawko_analytics.acquisition_mapping import _hash, moment
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.revenuecat import STORES

FORMAT = "billing_app_scope_manifest_v1"
LEDGER_FORMAT = "billing_app_scope_ledger_v1"
FIELDS = ("application_id", "revenuecat_project_id", "revenuecat_app_id")


def ledger_path(warehouse):
    return warehouse / "revenuecat" / "app-scopes.json"


def _normalize(payload):
    if not isinstance(payload, dict) or payload.get("format") != FORMAT:
        raise ValueError(f"Expected {FORMAT}.")
    source, scope, validity = (payload.get(field) for field in ("source", "scope", "validity"))
    if not all(isinstance(value, dict) for value in (source, scope, validity)):
        raise ValueError("Billing mapping requires explicit source, scope and validity.")
    source_id = safe_identity_id(source.get("source_id"))
    basis = source.get("verification_basis")
    if not source_id or basis not in ("unreviewed_mapping", "reviewed_app_scope_mapping"):
        raise ValueError("Billing mapping requires a bounded source ID and explicit review.")
    declared = moment(payload.get("declared_at"))
    reviewed = moment(source.get("reviewed_at")) if basis == "reviewed_app_scope_mapping" else None
    if reviewed is not None and reviewed > declared:
        raise ValueError("Mapping review cannot postdate declaration.")
    start, end = moment(validity.get("window_start")), moment(validity.get("window_end"))
    if start >= end:
        raise ValueError("Billing mapping validity must be an ordered half-open window.")
    normalized_scope = {field: safe_identity_id(scope.get(field)) for field in FIELDS}
    if any(value is None for value in normalized_scope.values()):
        raise ValueError("Billing namespaces require explicit bounded non-PII IDs.")
    if not isinstance(scope.get("store"), str) or scope["store"] not in STORES:
        raise ValueError("Billing mapping requires an explicit supported RevenueCat store.")
    if scope.get("environment") != "PRODUCTION" or scope.get("identity_basis") != "shared_installation_app_user_id":
        raise ValueError("Billing mapping requires PRODUCTION and shared installation identity, not aliases/accounts.")
    normalized_scope.update(
        store=scope["store"], environment="PRODUCTION", identity_basis="shared_installation_app_user_id",
    )
    binding = {"scope": normalized_scope, "validity": {
        "window_start": start.isoformat(), "window_end": end.isoformat(),
    }}
    return {
        **binding, "binding_id": _hash(binding), "source_id": source_id, "verification_basis": basis,
        "declared_at": declared.isoformat(), "reviewed_at": reviewed.isoformat() if reviewed else None,
    }


def _read(path):
    if not path.is_file():
        return []
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict) or payload.get("format") != LEDGER_FORMAT or not isinstance(payload.get("rows"), list):
        raise ValueError("Unsupported billing mapping ledger.")
    return payload["rows"]


def ingest_billing_mapping(manifest: Path, warehouse: Path):
    incoming = _normalize(json.loads(manifest.read_text()))
    path = ledger_path(warehouse)
    previous = _read(path)
    rows = {_hash(row): row for row in previous + [incoming]}
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent) as directory:
        replacement = Path(directory) / path.name
        replacement.write_text(json.dumps({"format": LEDGER_FORMAT, "rows": list(rows.values())}, indent=2) + "\n")
        replacement.replace(path)
    return {
        "retained_declarations": len(rows), "duplicate_declarations": len(previous) + 1 - len(rows),
        "binding_id": incoming["binding_id"], "source_verification": "operator_assertion_not_authenticated_by_engine",
    }


def billing_mapping_declarations(warehouse, *, as_of: datetime | None = None):
    if as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None):
        raise ValueError("Billing mapping as_of must be timezone-aware.")
    return [row for row in _read(ledger_path(warehouse)) if as_of is None or moment(row["declared_at"]) <= as_of]


def select_billing_mapping(rows, *, project_id, app_id, store, start, end):
    def overlaps(row):
        return moment(row["validity"]["window_start"]) < end and start < moment(row["validity"]["window_end"])

    candidates = [
        row for row in rows if overlaps(row) and
        (row["scope"]["revenuecat_project_id"], row["scope"]["revenuecat_app_id"], row["scope"]["store"]) ==
        (project_id, app_id, store)
    ]
    if not candidates:
        return None, "billing_mapping_not_observed"
    if len({_hash(row["scope"]) for row in candidates}) != 1:
        return None, "conflicting_billing_app_scope_mapping"
    scope = candidates[0]["scope"]
    for row in rows:
        other = row["scope"]
        if not overlaps(row):
            continue
        if (
            (other["revenuecat_project_id"], other["revenuecat_app_id"]) == (project_id, app_id)
            and other["application_id"] != scope["application_id"]
        ) or (
            (other["application_id"], other["store"]) == (scope["application_id"], store)
            and (other["revenuecat_project_id"], other["revenuecat_app_id"]) != (project_id, app_id)
        ):
            return None, "cross_application_billing_mapping_ambiguity"
    reviewed = [
        row for row in candidates if row["verification_basis"] == "reviewed_app_scope_mapping"
        and moment(row["validity"]["window_start"]) <= start and end <= moment(row["validity"]["window_end"])
    ]
    if not reviewed:
        return None, "billing_mapping_review_or_full_validity_missing"
    return min(reviewed, key=lambda row: (row["declared_at"], row["binding_id"])), "reviewed_declaration"
