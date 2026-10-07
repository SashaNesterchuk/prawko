"""Strict observation-v1 gates, separate from legacy paywall interpretations."""

from datetime import datetime
import re

from prawko_analytics.identity import safe_identity_id
from prawko_analytics.quality import nonnegative_number


STARTED = "paywall_trial_eligibility_started"
RESOLVED = "paywall_trial_eligibility_resolved"
COMPLETED = "paywall_trial_eligibility_completed"
ELIGIBILITY_EVENTS = frozenset({STARTED, RESOLVED, COMPLETED})
REQUEST_FIELDS = (
    "paywall_view_id", "trial_eligibility_observation_version", "eligibility_scope",
    "eligibility_requested_product_count", "eligibility_distinct_product_count", "eligibility_platform",
)
PRODUCT_FIELDS = (
    *REQUEST_FIELDS, "eligibility_outcome", "eligibility_basis",
    "eligibility_native_query_invoked", "eligibility_error_category",
)
TERMINAL_FIELDS = (
    *REQUEST_FIELDS, "eligibility_request_outcome", "eligibility_native_query_invoked",
    "eligibility_error_category", "eligibility_resolved_product_count", "eligibility_duration_ms",
)
PAYWALL_FIELDS = (
    "variant", "offer", "default_plan", "config_version", "country", "category", "locale",
    "monetization_version", "presentation", "source", "surface",
)
CHECKOUT_FIELDS = (
    "source", "surface", "exam_country", "category", "locale", "paywall_variant", "paywall_offer",
    "plan", "default_plan", "paywall_config_version", "product_id", "package_id", "offering_id",
    "package_type", "subscription_period", "price", "currency", "trial_days", "trial_eligibility",
    "trial_eligibility_basis", "trial_eligibility_request_id", "trial_shown",
)
ERROR_CATEGORIES = frozenset({
    "cancelled", "payment_pending", "store_problem", "operation_in_progress", "already_owned",
    "network", "not_allowed", "invalid_purchase", "configuration", "unavailable",
    "receipt_in_use", "unknown", "local_storage",
})


def moment(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else None
        return parsed if parsed is not None and parsed.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None


def count(value):
    return type(value) is int and nonnegative_number(value)


def _one_of(value, choices):
    return isinstance(value, str) and value in choices


def _safe_metadata(value):
    return (
        isinstance(value, str) and 0 < len(value) <= 1024
        and not re.search(
            r"https?://|(?:^|\s)bearer\s+\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"
            r"|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
            value, re.IGNORECASE,
        )
    )


def valid_eligibility_payload(event, p, at):
    if not (
        all(safe_identity_id(p.get(key)) for key in ("app_user_id", "paywall_view_id", "eligibility_request_id"))
        and type(p.get("trial_eligibility_observation_version")) is int
        and p["trial_eligibility_observation_version"] == 1
        and p.get("eligibility_scope") == "request_not_display"
        and safe_identity_id(p.get("eligibility_platform"))
        and count(p.get("eligibility_requested_product_count"))
        and count(p.get("eligibility_distinct_product_count"))
        and p["eligibility_distinct_product_count"] <= p["eligibility_requested_product_count"]
        and type(p.get("eligibility_observer_active")) is bool
        and type(p.get("eligibility_view_visible")) is bool
        and (not p["eligibility_view_visible"] or p["eligibility_observer_active"])
    ):
        return False
    distinct = p["eligibility_distinct_product_count"]
    if (distinct == 0) != (p["eligibility_requested_product_count"] == 0):
        return False
    if event == STARTED:
        started = moment(p.get("eligibility_started_at"))
        return started is not None and started <= at
    if (
        type(p.get("eligibility_native_query_invoked")) is not bool
        or "eligibility_error_category" not in p
        or (p["eligibility_error_category"] is not None
            and not _one_of(p["eligibility_error_category"], ERROR_CATEGORIES))
    ):
        return False
    ios = p["eligibility_platform"] == "ios"
    native, error = p["eligibility_native_query_invoked"], p["eligibility_error_category"]
    if native and not ios:
        return False
    if event == RESOLVED:
        if not safe_identity_id(p.get("eligibility_product_id")) or not distinct:
            return False
        outcome, basis = p.get("eligibility_outcome"), p.get("eligibility_basis")
        if basis == "request_error":
            return ios and outcome == "error" and error is not None
        if error is not None:
            return False
        if basis == "revenuecat_ios_status":
            return ios and native and _one_of(outcome, {"eligible", "ineligible", "no_intro_offer"})
        if _one_of(basis, {"sdk_status_unknown", "missing_product_response"}):
            return ios and native and outcome == "unknown"
        if basis == "unsupported_platform":
            return not ios and not native and outcome == "unknown"
        return basis == "not_configured" and ios and not native and outcome == "unknown"
    if event != COMPLETED or not (
        count(p.get("eligibility_resolved_product_count")) and nonnegative_number(p.get("eligibility_duration_ms"))
        and p["eligibility_resolved_product_count"] == distinct
    ):
        return False
    outcome = p.get("eligibility_request_outcome")
    if outcome == "no_products":
        return not distinct and not native and error is None
    if not distinct:
        return False
    if outcome == "error":
        return ios and error is not None
    if error is not None:
        return False
    return (
        (outcome == "resolved" and ios and native)
        or (outcome == "unsupported" and not ios and not native)
        or (outcome == "not_configured" and ios and not native)
    )


def origin_keys(namespace):
    fields = PAYWALL_FIELDS if namespace == "paywall_origin" else CHECKOUT_FIELDS
    return tuple(f"{namespace}_{field}" for field in ("version", "status", "at", "basis", *fields))


def origin_snapshot(p, namespace, at):
    keys = origin_keys(namespace)
    if not any(key in p for key in keys):
        return "legacy_unobserved", None
    version, status = p.get(f"{namespace}_version"), p.get(f"{namespace}_status")
    if type(version) is not int or version != 1:
        return "invalid", None
    if status == "observation_failed":
        return status, None
    if status != "observed" or any(key not in p for key in keys):
        return "invalid", None
    clock = moment(p[f"{namespace}_at"])
    if clock is None or clock > at:
        return "invalid", None
    values = {key.removeprefix(f"{namespace}_"): p[key] for key in keys}
    if namespace == "paywall_origin":
        if not (
            values["basis"] == "local_screen_config_not_remote_revision"
            and _one_of(values["variant"], {"legacy", "paywall2"})
            and _one_of(values["offer"], {"plans", "lifetime"})
            and _one_of(values["country"], {"PL", "CZ", "SK"})
            and count(values["config_version"])
            and type(values["monetization_version"]) is int and values["monetization_version"] in (1, 2)
            and safe_identity_id(values["presentation"])
            and (values["default_plan"] is None or _one_of(values["default_plan"], {"week", "month", "quarter"}))
        ):
            return "invalid", None
        optional = ("category", "locale", "source", "surface")
    else:
        if not (
            _one_of(values["basis"], {"checkout_input_and_selected_package", "checkout_input_without_selected_package"})
            and (values["exam_country"] is None or _one_of(values["exam_country"], {"PL", "CZ", "SK"}))
            and all(values[key] is None or count(values[key])
                    for key in ("paywall_config_version", "trial_days"))
            and (values["price"] is None or nonnegative_number(values["price"]))
            and (values["trial_shown"] is None or type(values["trial_shown"]) is bool)
            and (values["trial_eligibility"] is None
                 or _one_of(values["trial_eligibility"], {"eligible", "ineligible", "unknown", "error", "no_trial"}))
        ):
            return "invalid", None
        optional = tuple(key for key in CHECKOUT_FIELDS if key not in {
            "exam_country", "paywall_config_version", "trial_days", "price", "trial_shown", "trial_eligibility",
        })
    # Store labels are metadata, not business identity: e.g. "$rc_monthly" and a named offering.
    if any(values[key] is not None and not _safe_metadata(values[key]) for key in optional):
        return "invalid", None
    return "observed", {key: p[key] for key in keys}
