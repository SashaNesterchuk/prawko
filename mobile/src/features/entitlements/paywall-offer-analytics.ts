import { AppState } from "react-native";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import { createAppUserId } from "../../identity/app-user-id";
import { getPackageAnalyticsSnapshot } from "./offer-snapshot";
import type { OfferEventPayloads, OfferScope } from "../../analytics/critical-payloads";
import type { AnalyticsEventPayloads } from "../../analytics/catalog";
import { getCurrentUserFromState, useAppShellStore } from "../../state/app-shell";
import {
  useEntitlementStore,
  readHasPlusAccess,
  type RevenueCatOfferingsLoad,
  type RevenueCatPackageSummary,
} from "../../state/entitlements";

type OfferCycle = {
  id: string;
  requestId: string | null;
  startedAt: number;
  status: "loading" | "ready" | "failed";
  reason: "initial" | "refresh";
  cached: boolean;
  started: boolean;
};

/** One view owns availability events, not the lifetime of the shared SDK request. */
export function createPaywallOfferTracker(input: {
  viewId: string;
  getContext: () => {
    properties: AnalyticsProperties;
    track: AnalyticsTrack;
    sdkConfigured: boolean;
    isVisible: boolean;
    selectPackage: (offers: RevenueCatPackageSummary[]) => RevenueCatPackageSummary | null;
  };
}) {
  const newCycle = (reason: OfferCycle["reason"], requestId: string | null = null): OfferCycle => ({
    id: createAppUserId().replace(/^usr_/, ""), requestId, startedAt: Date.now(),
    status: "loading", reason, cached: false, started: false,
  });
  let cycle = newCycle("initial");
  let active = false;
  let viewedAt: number | null = null;
  let observedRequestId: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let appStateSubscription: { remove: () => void } | null = null;

  function getProperties() {
    const context = input.getContext();
    const state = useEntitlementStore.getState();
    const selected = context.selectPackage(state.revenueCatOfferings);
    return {
      paywall_view_id: input.viewId,
      offer_load_id: cycle.id,
      offer_request_id: cycle.requestId,
      offer_state: !context.sdkConfigured ? "failed"
        : !cycle.started && selected ? "ready" : cycle.status,
    };
  }

  function track<EventName extends keyof OfferEventPayloads>(
    event: EventName, extra: Omit<OfferEventPayloads[EventName], keyof OfferScope> & AnalyticsProperties,
  ) {
    const context = input.getContext();
    const user = getCurrentUserFromState(useAppShellStore.getState());
    const hasPlusAccess = readHasPlusAccess();
    try {
      const payload = {
        ...context.properties,
        ...getProperties(),
        auth_mode: user?.provider ?? "guest",
        supabase_user_id: user?.provider === "supabase" ? user.id : null,
        has_plus_access: hasPlusAccess,
        is_plus: hasPlusAccess,
        load_reason: cycle.reason,
        is_cached: cycle.cached,
        time_since_view_ms: Math.max(0, Date.now() - (viewedAt ?? cycle.startedAt)),
        ...extra,
      };
      // Extra fields are checked at the producer; scope is supplied by this composer.
      context.track(event, payload as AnalyticsEventPayloads[EventName]);
    } catch (error) {
      // Telemetry must never reject purchase preparation through a store subscriber.
      console.warn("Failed to track paywall offer availability.", error);
    }
  }

  function startCycle(load: RevenueCatOfferingsLoad | null, cached: boolean) {
    if (cycle.started) return;
    cycle.started = true;
    cycle.cached = cached;
    cycle.requestId = load?.id ?? null;
    track(ANALYTICS_EVENTS.paywallOfferLoadStarted.key, {
      offer_load_source: cached ? "cache" : load?.source ?? "awaiting_request",
      offers_count: useEntitlementStore.getState().revenueCatOfferings.length,
    });
  }

  function finishCycle(load: RevenueCatOfferingsLoad | null, cached = false) {
    if (cycle.status !== "loading") return;
    const context = input.getContext();
    const offers = useEntitlementStore.getState().revenueCatOfferings;
    const selected = context.selectPackage(offers);
    const failed = !context.sdkConfigured || (!cached && load?.status !== "ready") || !selected;
    cycle.status = failed ? "failed" : "ready";
    cycle.cached = cached;
    const timing = {
      load_duration_ms: cached ? 0 : Math.max(0, Date.now() - cycle.startedAt),
      request_duration_ms: load?.completedAt == null ? null : Math.max(0, load.completedAt - load.startedAt),
      offer_load_source: cached ? "cache" : load?.source ?? "configuration",
      offers_count: offers.length,
    };
    if (failed || !selected) {
      track(ANALYTICS_EVENTS.paywallOfferFailed.key, {
        ...load?.diagnostic,
        ...timing,
        failure_reason: !context.sdkConfigured ? "not_configured"
          : load?.status === "failed" ? "request_error" : "empty_offerings",
        error_code: !context.sdkConfigured ? "not_configured" : load?.errorCode ?? null,
        has_cached_offer: Boolean(selected),
      });
    } else {
      track(ANALYTICS_EVENTS.paywallOfferReady.key, {
        ...timing,
        ...getPackageAnalyticsSnapshot(selected),
      });
    }
  }

  function observe() {
    const context = input.getContext();
    if (!active || !context.isVisible || AppState.currentState !== "active") return;
    const state = useEntitlementStore.getState();
    const load = state.revenueCatOfferingsLoad;
    if (!cycle.started) {
      const cached = Boolean(context.selectPackage(state.revenueCatOfferings));
      // Do not replay an earlier screen's empty/failure as this view's outcome.
      observedRequestId = cached && load?.status === "loading" ? null : load?.id ?? null;
      startCycle(!cached && load?.status === "loading" ? load : null, cached);
      if (cached || !context.sdkConfigured) finishCycle(null, cached);
      // A cached offer is immediately usable; an already running refresh is
      // still its own load cycle and must not lose its later outcome.
      if (cached && load?.status === "loading") observe();
      return;
    }
    if (!load) return;
    if (load.id !== observedRequestId) {
      observedRequestId = load.id;
      if (cycle.status !== "loading" || (cycle.requestId !== null && cycle.requestId !== load.id)) {
        // A hidden/background cycle whose result was never observed remains
        // censored; a later SDK request must not reuse its load ID.
        cycle = newCycle("refresh", load.id);
      }
      cycle.requestId = load.id;
      startCycle(load, false);
    }
    if (cycle.requestId === load.id && load.status !== "loading") finishCycle(load);
  }

  return {
    getProperties,
    observe,
    start: (startedAt: number) => {
      if (active) return;
      active = true;
      viewedAt ??= startedAt;
      if (!cycle.started) cycle.startedAt = startedAt;
      unsubscribe = useEntitlementStore.subscribe(observe);
      appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") observe();
      });
      observe();
    },
    stop: () => {
      active = false;
      unsubscribe?.();
      unsubscribe = null;
      appStateSubscription?.remove();
      appStateSubscription = null;
    },
  };
}
