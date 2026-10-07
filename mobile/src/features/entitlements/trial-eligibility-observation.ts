import { ANALYTICS_EVENTS, type AnalyticsEventPayloads, type AnalyticsProperties } from "../../analytics/catalog";
import type { PaywallEligibilityPayloads, PaywallEligibilityScope } from "../../analytics/paywall-payloads";
import { createAnalyticsId } from "../../analytics/runtime-context";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { RevenueCatCheckoutErrorKind } from "./revenuecat-errors";

export type TrialEligibilityOutcome = "eligible" | "ineligible" | "unknown" | "no_intro_offer" | "error";
export type TrialEligibilityBasis =
  | "revenuecat_ios_status" | "sdk_status_unknown" | "missing_product_response"
  | "unsupported_platform" | "not_configured" | "request_error" | "pending";
export type TrialEligibilityProduct = {
  productId: string;
  outcome: TrialEligibilityOutcome;
  basis: TrialEligibilityBasis;
};
export type ResolvedTrialEligibilityProduct = Omit<TrialEligibilityProduct, "basis"> & {
  basis: Exclude<TrialEligibilityBasis, "pending">;
};
export type TrialEligibilityObservation =
  | { phase: "started"; platform: string }
  | {
      phase: "completed";
      platform: string;
      outcome: "resolved" | "unsupported" | "not_configured" | "no_products" | "error";
      nativeQueryInvoked: boolean;
      products: ResolvedTrialEligibilityProduct[];
      errorCategory: RevenueCatCheckoutErrorKind | null;
    };
export type TrialEligibilityObserver = (observation: TrialEligibilityObservation) => void;

export function observeTrialEligibility(
  observer: TrialEligibilityObserver | undefined,
  observation: () => TrialEligibilityObservation,
) {
  if (!observer) return;
  try { observer(observation()); } catch { /* Observation cannot change the SDK/UI result. */ }
}

export function createPaywallTrialEligibilityTracker(input: {
  viewId: string;
  getContext: () => { properties: AnalyticsProperties; track: AnalyticsTrack; isVisible: boolean };
}) {
  type Request = {
    id: string; key: string; startedAt: number; retired: boolean; started: boolean; completed: boolean;
    products: Map<string, TrialEligibilityProduct>;
  };
  let current: Request | null = null;
  return {
    getProduct(productId: string, key: string) {
      if (!current || current.retired || current.key !== key) return null;
      const product = current.products.get(productId);
      return product ? { ...product, requestId: current.id } : null;
    },
    begin(productIds: string[]) {
      if (current) current.retired = true;
      const request: Request = {
        id: createAnalyticsId("eligibility"), key: productIds.join(","), startedAt: Date.now(),
        retired: false, started: false, completed: false,
        products: new Map(productIds.map((productId) => [productId, {
          productId, outcome: "unknown" as const, basis: "pending" as const,
        }])),
      };
      current = request;
      let origin: AnalyticsProperties = {};
      try { origin = { ...input.getContext().properties }; } catch { /* Context is optional observation metadata. */ }
      const distinctProducts = request.products.size;
      const publish = <EventName extends keyof PaywallEligibilityPayloads>(
        event: EventName, extra: Omit<PaywallEligibilityPayloads[EventName], keyof PaywallEligibilityScope>,
      ) => {
        try {
          const context = input.getContext();
          const payload = {
            ...origin, paywall_view_id: input.viewId, eligibility_request_id: request.id,
            trial_eligibility_observation_version: 1, eligibility_scope: "request_not_display",
            eligibility_requested_product_count: productIds.length,
            eligibility_distinct_product_count: distinctProducts,
            eligibility_observer_active: !request.retired,
            eligibility_view_visible: !request.retired && context.isVisible,
            ...extra,
          };
          context.track(event, payload as AnalyticsEventPayloads[EventName]);
        } catch { /* Capture failure cannot hide or enable a trial. */ }
      };
      return {
        observe: ((observation) => {
          if (request.completed) return;
          if (observation.phase === "started") {
            if (request.started) return;
            request.started = true;
            publish(ANALYTICS_EVENTS.paywallTrialEligibilityStarted.key, {
              eligibility_platform: observation.platform,
              eligibility_started_at: new Date(request.startedAt).toISOString(),
            });
            return;
          }
          request.completed = true;
          const products = new Map(observation.products.map((product) => [product.productId, product]));
          if (!request.retired && current === request) request.products = products;
          for (const product of products.values()) {
            publish(ANALYTICS_EVENTS.paywallTrialEligibilityResolved.key, {
              eligibility_platform: observation.platform,
              eligibility_product_id: product.productId, eligibility_outcome: product.outcome,
              eligibility_basis: product.basis, eligibility_native_query_invoked: observation.nativeQueryInvoked,
              eligibility_error_category: observation.errorCategory,
            });
          }
          publish(ANALYTICS_EVENTS.paywallTrialEligibilityCompleted.key, {
            eligibility_platform: observation.platform, eligibility_request_outcome: observation.outcome,
            eligibility_native_query_invoked: observation.nativeQueryInvoked,
            eligibility_error_category: observation.errorCategory, eligibility_resolved_product_count: products.size,
            eligibility_duration_ms: Math.max(0, Date.now() - request.startedAt),
          });
        }) satisfies TrialEligibilityObserver,
        stop: () => { request.retired = true; },
      };
    },
  };
}
