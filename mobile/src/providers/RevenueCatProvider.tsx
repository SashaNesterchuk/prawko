import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { AnalyticsProperties } from "../analytics/catalog";

import {
  fetchRevenueCatSnapshot,
  fetchRevenueCatAccessSnapshot,
  getRevenueCatDiagnostic,
  getRevenueCatErrorCode,
  getRevenueCatWhy,
  isRevenueCatConfiguredForCurrentPlatform,
  subscribeToRevenueCatCustomerInfo,
  syncRevenueCatSubscriberAttributes,
} from "../features/entitlements/revenuecat";
import {
  hydrateCheckoutJournal,
  observeCheckoutAppState,
  reconcileCheckoutAccess,
  refreshCheckoutAccess,
} from "../features/entitlements/checkout";
import { useAnalytics } from "../hooks/useAnalytics";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useHasHydrated, useAppShellStore } from "../state/app-shell";
import { useEntitlementStore } from "../state/entitlements";
import { useErrorLogger } from "./ErrorLoggingProvider";

const REVENUECAT_HYDRATION_RETRY_MS = 2_000;

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const appUserId = useAppUserId();
  const appShellHydrated = useHasHydrated();
  const { captureError } = useErrorLogger();
  const { track } = useAnalytics();
  const captureErrorRef = useRef(captureError);
  const trackRef = useRef(track);
  captureErrorRef.current = captureError;
  trackRef.current = track;
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const beginRevenueCatHydration = useEntitlementStore(
    (state) => state.beginRevenueCatHydration
  );
  const clearRevenueCatState = useEntitlementStore(
    (state) => state.clearRevenueCatState
  );
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const markRevenueCatHydrationFailed = useEntitlementStore(
    (state) => state.markRevenueCatHydrationFailed
  );

  useEffect(() => {
    if (!appShellHydrated || !sessionResolved) {
      return;
    }

    const sdkConfigured = isRevenueCatConfiguredForCurrentPlatform();
    if (!sdkConfigured) {
      clearRevenueCatState("ready");
    }

    let cancelled = false;
    let hydrateInFlight = false;
    let foregroundRefreshQueued = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeCustomerInfo: (() => void) | undefined;

    function logRevenueCatFailure(input: {
      error?: unknown;
      eventName: string;
      kind: string;
      severity?: "warning" | "error";
      step: string;
      why: string;
      extra?: AnalyticsProperties;
    }) {
      captureErrorRef.current({
        area: "revenuecat",
        error: input.error,
        eventName: input.eventName,
        message: `${input.step}:${input.why}`,
        metadata: getRevenueCatDiagnostic({
          extra: {
            user_id: appUserId,
            ...input.extra,
          },
          kind: input.kind,
          step: input.step,
          why: input.why,
        }),
        severity: input.severity ?? "error",
      });
    }

    async function hydrate(kind: "initial" | "retry" | "foreground") {
      if (cancelled) {
        return;
      }
      if (hydrateInFlight) {
        foregroundRefreshQueued ||= kind === "foreground";
        return;
      }

      const current = useEntitlementStore.getState();

      if (kind === "retry" && current.revenueCatOfferings.length > 0) {
        return;
      }

      hydrateInFlight = true;

      if (current.revenueCatOfferings.length === 0) {
        beginRevenueCatHydration();
      }

      try {
        const accessOnly = kind === "foreground" && current.revenueCatOfferings.length > 0;
        const snapshot = accessOnly
          ? await fetchRevenueCatAccessSnapshot(appUserId, { forceRefresh: true })
          : await fetchRevenueCatSnapshot(appUserId, { forceRefresh: kind === "foreground" });

        if (cancelled) {
          return;
        }

        hydrateRevenueCatSnapshot(snapshot);
        reconcileCheckoutAccess(appUserId, snapshot);

        // Access-only snapshots preserve the cached offer state. Do not report
        // that cached error as a new getOfferings request failure.
        if (snapshot.offeringsError && !accessOnly) {
          logRevenueCatFailure({
            error: { code: snapshot.offeringsError },
            eventName: "revenuecat_offerings_failed",
            kind,
            step: "get_offerings",
            why: snapshot.offeringsError,
            extra: snapshot.offeringsDiagnostic,
          });

          if (kind === "initial") {
            retryTimer = setTimeout(() => {
              void hydrate("retry");
            }, REVENUECAT_HYDRATION_RETRY_MS);
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to hydrate RevenueCat state.", error);
        markRevenueCatHydrationFailed(getRevenueCatErrorCode(error));
        logRevenueCatFailure({
          error,
          eventName: "revenuecat_hydration_failed",
          kind,
          step: "get_customer_info",
          why: getRevenueCatWhy(error),
        });

        if (kind === "initial") {
          retryTimer = setTimeout(() => {
            void hydrate("retry");
          }, REVENUECAT_HYDRATION_RETRY_MS);
        }
      } finally {
        hydrateInFlight = false;
        if (foregroundRefreshQueued && !cancelled) {
          foregroundRefreshQueued = false;
          void hydrate("foreground");
        }
      }
    }

    function subscribeCustomerInfo() {
      // Subscribe independently of offer hydration; a slow/failed offers fetch
      // must not prevent a purchase from updating access anywhere in the app.
      void subscribeToRevenueCatCustomerInfo(
        appUserId,
        (snapshot) => {
          if (!cancelled) {
            hydrateRevenueCatSnapshot(snapshot);
            reconcileCheckoutAccess(appUserId, snapshot);
          }
        },
        (error) => {
          if (!cancelled) {
            logRevenueCatFailure({
              error,
              eventName: "revenuecat_listener_failed",
              kind: "listener",
              severity: "warning",
              step: "customer_info_listener",
              why: getRevenueCatWhy(error),
            });
          }
        }
      ).then((unsubscribe) => {
        if (cancelled) {
          unsubscribe();
        } else {
          unsubscribeCustomerInfo = unsubscribe;
        }
      }).catch((error) => {
        if (!cancelled) {
          logRevenueCatFailure({
            error,
            eventName: "revenuecat_subscribe_failed",
            kind: "subscribe",
            severity: "warning",
            step: "subscribe_customer_info",
            why: getRevenueCatWhy(error),
          });
        }
      });
    }

    async function bootstrap() {
      try {
        await hydrateCheckoutJournal({
          appUserId,
          track: (event, payload) => trackRef.current(event, payload),
          captureError: (input) => captureErrorRef.current(input),
        });
      } catch (error) {
        // Broken storage blocks new payment, not RevenueCat access recovery.
        captureErrorRef.current({
          area: "monetization", error, eventName: "checkout_journal_read_failed",
          severity: "warning", metadata: { recovery_source: "startup" },
        });
      }
      if (cancelled || !sdkConfigured) return;
      subscribeCustomerInfo();
      // Check the saved attempt with fresh CustomerInfo before offer loading.
      // Never invoke restorePurchases or purchasePackage automatically here.
      await refreshCheckoutAccess(appUserId, "startup");
      if (!cancelled) void hydrate("initial");
    }
    void bootstrap().catch((error) => {
      if (!cancelled) {
        logRevenueCatFailure({
          error, eventName: "revenuecat_bootstrap_failed", kind: "initial",
          severity: "warning", step: "get_customer_info", why: getRevenueCatWhy(error),
        });
      }
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        observeCheckoutAppState(nextState);
        if (nextState !== "active" || !sdkConfigured) {
          return;
        }

        void refreshCheckoutAccess(appUserId, "foreground").then(() => {
          if (!cancelled) void hydrate("foreground");
        }).catch((error) => {
          if (!cancelled) {
            logRevenueCatFailure({
              error, eventName: "purchase_status_check_failed", kind: "foreground",
              severity: "warning", step: "get_customer_info", why: getRevenueCatWhy(error),
            });
            void hydrate("foreground");
          }
        });
      }
    );

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      unsubscribeCustomerInfo?.();
      appStateSubscription.remove();
    };
  }, [
    appShellHydrated,
    appUserId,
    beginRevenueCatHydration,
    clearRevenueCatState,
    hydrateRevenueCatSnapshot,
    markRevenueCatHydrationFailed,
    sessionResolved,
  ]);

  useEffect(() => {
    if (!appShellHydrated || !sessionResolved) {
      return;
    }

    if (!isRevenueCatConfiguredForCurrentPlatform()) {
      return;
    }

    let cancelled = false;

    void syncRevenueCatSubscriberAttributes({
      appUserId,
      supabaseUserId,
    }).catch((error) => {
      if (cancelled) {
        return;
      }

      console.warn("Failed to sync RevenueCat subscriber attributes.", error);
      captureErrorRef.current({
        area: "revenuecat",
        error,
        eventName: "revenuecat_attributes_failed",
        message: `sync_attributes:${getRevenueCatWhy(error)}`,
        metadata: getRevenueCatDiagnostic({
          extra: {
            user_id: appUserId,
          },
          kind: "attributes",
          step: "sync_attributes",
          why: getRevenueCatWhy(error),
        }),
        severity: "warning",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appShellHydrated, appUserId, sessionResolved, supabaseUserId]);

  return children;
}
