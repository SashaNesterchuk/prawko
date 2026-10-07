import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { PaywallEligibilityScope } from "../paywall-payloads";

const scope: PaywallEligibilityScope = {
  paywall_view_id: "view-one", eligibility_request_id: "request-one",
  trial_eligibility_observation_version: 1, eligibility_scope: "request_not_display",
  eligibility_requested_product_count: 1, eligibility_distinct_product_count: 1,
  eligibility_observer_active: true, eligibility_view_visible: true,
};

// Included by mobile/tsconfig.json; __tests__ is deliberately excluded there.
void function checkEligibilityPayloads(track: AnalyticsTrack) {
  // @ts-expect-error A product outcome without a request/view scope is not typed telemetry.
  track("paywall_trial_eligibility_resolved", { eligibility_outcome: "eligible" });
  // @ts-expect-error Completion without its scoped outcome/counters is incomplete.
  track("paywall_trial_eligibility_completed", { paywall_view_id: "view-a" });
  track("paywall_trial_eligibility_resolved", {
    ...scope, eligibility_platform: "ios", eligibility_product_id: "sku-one", eligibility_outcome: "eligible",
    eligibility_basis: "revenuecat_ios_status", eligibility_native_query_invoked: true, eligibility_error_category: null,
  });
  // @ts-expect-error Pending is screen-local state, never a resolved SDK observation.
  track("paywall_trial_eligibility_resolved", { ...scope, eligibility_platform: "ios", eligibility_product_id: "sku", eligibility_outcome: "unknown", eligibility_basis: "pending", eligibility_native_query_invoked: false, eligibility_error_category: null });
  // @ts-expect-error Eligibility failures retain normalized categories, not arbitrary error text.
  track("paywall_trial_eligibility_completed", { ...scope, eligibility_platform: "ios", eligibility_request_outcome: "error", eligibility_native_query_invoked: true, eligibility_error_category: "private-error", eligibility_resolved_product_count: 1, eligibility_duration_ms: 1 });
};
