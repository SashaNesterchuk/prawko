import type { AnalyticsProperties } from "../../analytics/catalog";
import type { RevenueCatPackageSummary } from "../../state/entitlements";
import { getPackageAnalyticsSnapshot } from "../entitlements/offer-snapshot";
import type { TrialEligibilityProduct } from "../entitlements/trial-eligibility-observation";
import { PAYWALL2_DEFAULT_PLAN, pickPaywall2Plan, resolvePaywall2Plans, type Paywall2PlanId } from "./plans";

export function selectPaywall2AnalyticsPlan(
  offers: RevenueCatPackageSummary[],
  selectedPlanId: Paywall2PlanId,
) {
  return pickPaywall2Plan(resolvePaywall2Plans(offers, {
    preview: false,
    trialIneligibleProductIds: null,
  }).plans, selectedPlanId);
}

export function getPaywall2PlanAnalyticsSnapshot(input: {
  offers: RevenueCatPackageSummary[];
  selectedPlanId: Paywall2PlanId;
  trialIneligibleProductIds: readonly string[] | null;
  trialEligibilityFailed?: boolean;
  trialEligibilityProduct?: (TrialEligibilityProduct & { requestId: string }) | null;
}): AnalyticsProperties {
  const plan = pickPaywall2Plan(resolvePaywall2Plans(input.offers, {
    preview: false,
    trialIneligibleProductIds: input.trialIneligibleProductIds,
  }).plans, input.selectedPlanId);
  const pkg = plan?.package ?? null;
  const observation = input.trialEligibilityProduct?.productId === pkg?.productIdentifier
    ? input.trialEligibilityProduct : null;
  const eligibility = !pkg ? "unknown" : !pkg.freeTrialDays ? "no_trial"
    : observation?.outcome === "no_intro_offer" ? "no_trial"
    : observation?.outcome ?? (input.trialEligibilityFailed ? "error" : "unknown");
  return {
    ...getPackageAnalyticsSnapshot(pkg),
    plan: plan?.id ?? null,
    default_plan: PAYWALL2_DEFAULT_PLAN,
    trial_days: plan?.trialDays ?? null,
    trial_eligibility: eligibility,
    trial_shown: (plan?.trialDays ?? 0) > 0,
    trial_eligibility_observation_version: 1,
    trial_eligibility_basis: !pkg ? "package_unavailable" : !pkg.freeTrialDays ? "product_has_no_free_trial"
      : observation?.basis ?? (input.trialEligibilityFailed ? "request_error" : "legacy_filter_only"),
    trial_eligibility_request_id: observation?.requestId ?? null,
    paywall_config_version: 1,
  };
}
