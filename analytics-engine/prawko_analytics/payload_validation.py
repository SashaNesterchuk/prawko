"""Client-reported validation annotations, not retrospective event validation."""

from collections import Counter


VERSION = "analytics_payload_contract_version"
STATUS = "analytics_payload_contract_status"
VALID = "analytics_payload_valid"
KEYS = "analytics_payload_invalid_keys"
STATES = (
    "unreported", "legacy_valid_flag", "legacy_invalid_flag",
    "v1_valid", "v1_invalid", "v1_not_defined",
    "v2_valid", "v2_invalid", "v2_not_defined",
    "unsupported_version", "malformed_annotation",
)


def payload_validation_state(properties: dict) -> str:
    if not any(key in properties for key in (VERSION, STATUS, VALID, KEYS)):
        return "unreported"
    flag = properties.get(VALID)
    keys = properties.get(KEYS)
    if keys is not None and not isinstance(keys, str):
        return "malformed_annotation"
    if VERSION not in properties and STATUS not in properties:
        if type(flag) is not bool or (flag and keys):
            return "malformed_annotation"
        return "legacy_valid_flag" if flag else "legacy_invalid_flag"
    version = properties.get(VERSION)
    if type(version) is not int:
        return "malformed_annotation"
    if version not in (1, 2):
        return "unsupported_version"
    status = properties.get(STATUS)
    if not isinstance(status, str) or status not in ("valid", "invalid", "not_defined"):
        return "malformed_annotation"
    if type(flag) is not bool or flag != (status != "invalid") or (flag and keys):
        return "malformed_annotation"
    return f"v{version}_{status}"


def invalid_client_payload(properties: dict) -> bool:
    # Legacy False remains a gate even when its optional annotation is incomplete.
    return properties.get(VALID) is False or payload_validation_state(properties) in (
        "legacy_invalid_flag", "v1_invalid", "v2_invalid", "unsupported_version", "malformed_annotation",
    )


def payload_validation_report(rows) -> dict:
    counts = Counter(dict.fromkeys(STATES, 0))
    invalid = 0
    for row in rows:
        counts[payload_validation_state(row.properties)] += 1
        invalid += int(invalid_client_payload(row.properties))
    return {
        "rule_version": "client-payload-validation-observations-v1",
        "basis": "source_reported_annotations_not_warehouse_revalidation",
        "grain": "retained_observation_row_not_business_operation",
        "status": "limited_annotations" if invalid else "observed",
        "counts": dict(counts), "unusable_annotation_rows": invalid,
        "v2_validation_observed_rows": counts["v2_valid"] + counts["v2_invalid"],
        "retroactive_v2_validation": False,
        "must_not_be_interpreted_as": [
            "full_catalog_schema_coverage", "native_delivery", "business_outcome", "verified_money",
        ],
    }
