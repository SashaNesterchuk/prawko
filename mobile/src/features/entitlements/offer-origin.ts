import { sanitizeAnalyticsProperties, type AnalyticsProperties } from "../../analytics/catalog";
import type { RevenueCatPackageSummary } from "../../state/entitlements";
import { getPackageAnalyticsSnapshot } from "./offer-snapshot";

const PAYWALL_FIELDS = [
  "variant", "offer", "default_plan", "config_version", "country", "category", "locale",
  "monetization_version", "presentation", "source", "surface",
] as const;
const CHECKOUT_FIELDS = [
  "source", "surface", "exam_country", "category", "locale", "paywall_variant", "paywall_offer",
  "plan", "default_plan", "paywall_config_version", "product_id", "package_id", "offering_id",
  "package_type", "subscription_period", "price", "currency", "trial_days", "trial_eligibility",
  "trial_eligibility_basis", "trial_eligibility_request_id", "trial_shown",
] as const;
export const PAYWALL_ORIGIN_KEYS = [
  "paywall_origin_version", "paywall_origin_status", "paywall_origin_at", "paywall_origin_basis",
  ...PAYWALL_FIELDS.map((field) => `paywall_origin_${field}`),
];
export const CHECKOUT_ORIGIN_KEYS = [
  "checkout_origin_version", "checkout_origin_status", "checkout_origin_at", "checkout_origin_basis",
  ...CHECKOUT_FIELDS.map((field) => `checkout_origin_${field}`),
];

function prefix(fields: readonly string[], values: AnalyticsProperties, namespace: string) {
  return Object.fromEntries(fields.map((field) => [`${namespace}_${field}`, values[field] ?? null]));
}

export function createPaywallOriginSnapshot(values: AnalyticsProperties): AnalyticsProperties {
  try {
    return sanitizeAnalyticsProperties({
      paywall_origin_version: 1, paywall_origin_status: "observed",
      paywall_origin_at: new Date().toISOString(), paywall_origin_basis: "local_screen_config_not_remote_revision",
      ...prefix(PAYWALL_FIELDS, values, "paywall_origin"),
    }) ?? { paywall_origin_version: 1, paywall_origin_status: "observation_failed" };
  } catch {
    return { paywall_origin_version: 1, paywall_origin_status: "observation_failed" };
  }
}

/** CTA input stays separate from a refreshed package at the native purchase boundary. */
export function createCheckoutOriginSnapshot(
  values: AnalyticsProperties, selectedPackage: RevenueCatPackageSummary | null,
): AnalyticsProperties {
  try {
    return sanitizeAnalyticsProperties({
      checkout_origin_version: 1, checkout_origin_status: "observed",
      checkout_origin_at: new Date().toISOString(),
      checkout_origin_basis: selectedPackage ? "checkout_input_and_selected_package" : "checkout_input_without_selected_package",
      ...prefix(CHECKOUT_FIELDS, {
        ...values, ...(selectedPackage ? getPackageAnalyticsSnapshot(selectedPackage) : {}),
      }, "checkout_origin"),
    }) ?? { checkout_origin_version: 1, checkout_origin_status: "observation_failed" };
  } catch {
    return { checkout_origin_version: 1, checkout_origin_status: "observation_failed" };
  }
}
