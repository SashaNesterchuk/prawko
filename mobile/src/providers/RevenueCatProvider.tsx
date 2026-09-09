import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  fetchRevenueCatSnapshot,
  getRevenueCatDiagnostic,
  getRevenueCatErrorCode,
  getRevenueCatWhy,
  isRevenueCatConfiguredForCurrentPlatform,
  subscribeToRevenueCatCustomerInfo,
  syncRevenueCatSubscriberAttributes,
} from "../features/entitlements/revenuecat";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useHasHydrated, useAppShellStore } from "../state/app-shell";
import { useEntitlementStore } from "../state/entitlements";
import { useErrorLogger } from "./ErrorLoggingProvider";

const REVENUECAT_HYDRATION_RETRY_MS = 2_000;

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const appUserId = useAppUserId();
  const appShellHydrated = useHasHydrated();
  const { captureError } = useErrorLogger();
  const captureErrorRef = useRef(captureError);
  captureErrorRef.current = captureError;
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

    if (!isRevenueCatConfiguredForCurrentPlatform()) {
      clearRevenueCatState("ready");
      return;
    }

    let cancelled = false;
    let hydrateInFlight = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeCustomerInfo: (() => void) | undefined;

    function logRevenueCatFailure(input: {
      error?: unknown;
      eventName: string;
      kind: string;
      severity?: "warning" | "error";
      step: string;
      why: string;
    }) {
      captureErrorRef.current({
        area: "revenuecat",
        error: input.error,
        eventName: input.eventName,
        message: `${input.step}:${input.why}`,
        metadata: getRevenueCatDiagnostic({
          extra: {
            user_id: appUserId,
          },
          kind: input.kind,
          step: input.step,
          why: input.why,
        }),
        severity: input.severity ?? "error",
      });
    }

    async function hydrate(kind: "initial" | "retry") {
      if (cancelled || hydrateInFlight) {
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
        const snapshot = await fetchRevenueCatSnapshot(appUserId);

        if (cancelled) {
          return;
        }

        hydrateRevenueCatSnapshot(snapshot);

        if (snapshot.offeringsError) {
          logRevenueCatFailure({
            error: { code: snapshot.offeringsError },
            eventName: "revenuecat_offerings_failed",
            kind,
            step: "get_offerings",
            why: snapshot.offeringsError,
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
      }

      if (cancelled || unsubscribeCustomerInfo) {
        return;
      }

      try {
        unsubscribeCustomerInfo = await subscribeToRevenueCatCustomerInfo(
          appUserId,
          (nextSnapshot) => {
            if (!cancelled) {
              hydrateRevenueCatSnapshot(nextSnapshot);
            }
          },
          (error) => {
            if (cancelled) {
              return;
            }

            logRevenueCatFailure({
              error,
              eventName: "revenuecat_listener_failed",
              kind: "listener",
              severity: "warning",
              step: "customer_info_listener",
              why: getRevenueCatWhy(error),
            });
          }
        );
      } catch (error) {
        console.warn("Failed to subscribe to RevenueCat customer info.", error);
        logRevenueCatFailure({
          error,
          eventName: "revenuecat_subscribe_failed",
          kind: "subscribe",
          severity: "warning",
          step: "subscribe_customer_info",
          why: getRevenueCatWhy(error),
        });
      }
    }

    void hydrate("initial");

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState !== "active") {
          return;
        }

        if (useEntitlementStore.getState().revenueCatOfferings.length === 0) {
          void hydrate("retry");
        }
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
