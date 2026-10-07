"""Shared source-quality guard; raw observations remain available for inspection."""

from math import isfinite

from prawko_analytics.payload_validation import invalid_client_payload


def nonnegative_number(value) -> bool:
    try:
        return type(value) in (int, float) and isfinite(value) and value >= 0
    except OverflowError:
        return False


def observation_integrity_issue(properties: dict) -> bool:
    return invalid_client_payload(properties) or any(properties.get(marker) is True for marker in (
        "_warehouse_import_conflict", "_warehouse_business_conflict", "_warehouse_business_invalid",
        "_warehouse_business_order_uncertain",
    ))


def observation_usable(properties: dict) -> bool:
    return not observation_integrity_issue(properties) and properties.get("_warehouse_business_duplicate_before_window") is not True
