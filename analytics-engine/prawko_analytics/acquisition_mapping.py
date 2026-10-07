"""Explicit, retained app-scope declarations; never infer apps from country."""

from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from prawko_analytics.identity import safe_identity_id

FORMAT = "acquisition_app_scope_manifest_v1"
LEDGER_FORMAT = "acquisition_app_scope_ledger_v1"
NUMERIC_FIELDS = ("asa_org_id", "apple_account_id", "apple_app_id")
STRING_FIELDS = ("application_id", "revenuecat_project_id", "revenuecat_app_id")


def ledger_path(warehouse):
    return warehouse / "acquisition" / "app-scopes.json"


def moment(value):
    if not isinstance(value, str):
        raise ValueError("Mapping clocks require explicit timezone-aware ISO strings.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc)
    except ValueError as error:
        raise ValueError("Mapping clocks require explicit timezone-aware ISO strings.") from error


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _normalize(payload):
    if not isinstance(payload, dict) or payload.get("format") != FORMAT:
        raise ValueError(f"Expected {FORMAT}.")
    source, scope, validity = (payload.get(field) for field in ("source", "scope", "validity"))
    if not all(isinstance(value, dict) for value in (source, scope, validity)):
        raise ValueError("Mapping source, scope and validity must be explicit objects.")
    source_id = safe_identity_id(source.get("source_id"))
    basis = source.get("verification_basis")
    if not source_id or basis not in ("unreviewed_mapping", "reviewed_app_scope_mapping"):
        raise ValueError("Mapping requires a bounded source ID and explicit review basis.")
    declared = moment(payload.get("declared_at"))
    reviewed = moment(source.get("reviewed_at")) if basis == "reviewed_app_scope_mapping" else None
    if reviewed and reviewed > declared:
        raise ValueError("Mapping review cannot postdate its declaration.")
    start, end = moment(validity.get("window_start")), moment(validity.get("window_end"))
    if start >= end:
        raise ValueError("Mapping validity must be an ordered half-open window.")
    normalized_scope = {}
    for field in NUMERIC_FIELDS:
        value = scope.get(field)
        if type(value) is not int or not 0 < value <= 2**53 - 1:
            raise ValueError("Mapping numeric namespaces require positive JS-safe integer IDs.")
        normalized_scope[field] = value
    for field in STRING_FIELDS:
        value = safe_identity_id(scope.get(field))
        if value is None:
            raise ValueError("Mapping app namespaces require bounded non-PII IDs.")
        normalized_scope[field] = value
    if scope.get("store") != "APP_STORE" or scope.get("environment") != "PRODUCTION":
        raise ValueError("ASA financial mapping is explicitly APP_STORE / PRODUCTION only.")
    if scope.get("identity_basis") != "shared_installation_app_user_id":
        raise ValueError("Mapping must declare the shared installation identity basis, not account/alias joins.")
    normalized_scope.update(store="APP_STORE", environment="PRODUCTION", identity_basis="shared_installation_app_user_id")
    binding = {
        "scope": normalized_scope,
        "validity": {"window_start": start.isoformat(), "window_end": end.isoformat()},
    }
    return {
        **binding, "binding_id": _hash(binding), "source_id": source_id, "verification_basis": basis,
        "declared_at": declared.isoformat(), "reviewed_at": reviewed.isoformat() if reviewed else None,
    }


def ingest_acquisition_mapping(manifest: Path, warehouse: Path):
    incoming = _normalize(json.loads(manifest.read_text()))
    path = ledger_path(warehouse)
    previous = _read(path)
    rows = {_hash(row): row for row in previous + [incoming]}
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent) as directory:
        replacement = Path(directory) / "app-scopes.json"
        replacement.write_text(json.dumps({"format": LEDGER_FORMAT, "rows": list(rows.values())}, indent=2) + "\n")
        replacement.replace(path)
    return {
        "retained_declarations": len(rows), "duplicate_declarations": len(previous) + 1 - len(rows),
        "binding_id": incoming["binding_id"], "source_verification": "operator_assertion_not_authenticated_by_engine",
    }


def _read(path):
    if not path.is_file():
        return []
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict) or payload.get("format") != LEDGER_FORMAT or not isinstance(payload.get("rows"), list):
        raise ValueError("Unsupported acquisition mapping ledger.")
    return payload["rows"]


def mapping_declarations(warehouse: Path, *, as_of: datetime | None = None):
    if as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None):
        raise ValueError("Mapping as_of must be timezone-aware.")
    return [row for row in _read(ledger_path(warehouse)) if as_of is None or moment(row["declared_at"]) <= as_of]


def select_mapping(rows, *, application_id, asa_org_id, start, end):
    if not application_id:
        return None, "application_scope_not_observed"
    candidates = [
        row for row in rows if row["scope"]["application_id"] == application_id
        and moment(row["validity"]["window_start"]) < end and start < moment(row["validity"]["window_end"])
    ]
    if not candidates:
        return None, "mapping_not_observed"
    # Conflicting overlapping bindings remain conflicts even when one is newer.
    scopes = {_hash(row["scope"]) for row in candidates}
    if len(scopes) > 1:
        return None, "conflicting_app_scope_mapping"
    scoped = candidates[0]["scope"]
    if asa_org_id is not None and asa_org_id != scoped["asa_org_id"]:
        return None, "asa_org_mapping_disagreement"
    for row in rows:
        other = row["scope"]
        if other["application_id"] == application_id:
            continue
        overlaps = moment(row["validity"]["window_start"]) < end and start < moment(row["validity"]["window_end"])
        if overlaps and (
            (other["revenuecat_project_id"], other["revenuecat_app_id"]) ==
            (scoped["revenuecat_project_id"], scoped["revenuecat_app_id"])
            or (other["apple_account_id"], other["apple_app_id"]) ==
            (scoped["apple_account_id"], scoped["apple_app_id"])
        ):
            return None, "cross_application_mapping_ambiguity"
    reviewed = [
        row for row in candidates if row["verification_basis"] == "reviewed_app_scope_mapping"
        and moment(row["validity"]["window_start"]) <= start and end <= moment(row["validity"]["window_end"])
    ]
    if not reviewed:
        return None, "mapping_review_or_full_validity_missing"
    return min(reviewed, key=lambda row: (row["declared_at"], row["binding_id"])), "reviewed_declaration"
