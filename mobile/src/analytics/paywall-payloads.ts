import type { TrialEligibilityBasis, TrialEligibilityOutcome } from "../features/entitlements/trial-eligibility-observation";
import type { RevenueCatCheckoutErrorKind } from "../features/entitlements/revenuecat-errors";

export type PaywallEligibilityScope = {
  paywall_view_id: string;
  eligibility_request_id: string;
  trial_eligibility_observation_version: 1;
  eligibility_scope: "request_not_display";
  eligibility_requested_product_count: number;
  eligibility_distinct_product_count: number;
  eligibility_observer_active: boolean;
  eligibility_view_visible: boolean;
};

export type PaywallEligibilityPayloads = {
  paywall_trial_eligibility_started: PaywallEligibilityScope & {
    eligibility_platform: string; eligibility_started_at: string;
  };
  paywall_trial_eligibility_resolved: PaywallEligibilityScope & {
    eligibility_platform: string; eligibility_product_id: string;
    eligibility_outcome: TrialEligibilityOutcome; eligibility_basis: Exclude<TrialEligibilityBasis, "pending">;
    eligibility_native_query_invoked: boolean; eligibility_error_category: RevenueCatCheckoutErrorKind | null;
  };
  paywall_trial_eligibility_completed: PaywallEligibilityScope & {
    eligibility_platform: string;
    eligibility_request_outcome: "resolved" | "unsupported" | "not_configured" | "no_products" | "error";
    eligibility_native_query_invoked: boolean; eligibility_error_category: RevenueCatCheckoutErrorKind | null;
    eligibility_resolved_product_count: number; eligibility_duration_ms: number;
  };
};
