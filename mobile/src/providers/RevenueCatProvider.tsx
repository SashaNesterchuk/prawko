import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";

import {
  fetchRevenueCatSnapshot,
  isRevenueCatConfiguredForCurrentPlatform,
  subscribeToRevenueCatCustomerInfo,
} from "../features/entitlements/revenuecat";
import { useHasHydrated, useAppShellStore } from "../state/app-shell";
import { useEntitlementStore } from "../state/entitlements";
import { useErrorLogger } from "./ErrorLoggingProvider";

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const appShellHydrated = useHasHydrated();
  const authMode = useAppShellStore((state) => state.authMode);
  const { captureError } = useErrorLogger();
  const captureErrorRef = useRef(captureError);
  captureErrorRef.current = captureError;
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const clearRevenueCatState = useEntitlementStore(
    (state) => state.clearRevenueCatState
  );
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const setRevenueCatStatus = useEntitlementStore(
    (state) => state.setRevenueCatStatus
  );

  useEffect(() => {
    if (!appShellHydrated || !sessionResolved) {
      return;
    }

    if (!isRevenueCatConfiguredForCurrentPlatform()) {
      clearRevenueCatState("ready");
      return;
    }

    const appUserId =
      authMode === "supabase" && supabaseUserId ? supabaseUserId : null;

    let cancelled = false;
    let unsubscribeCustomerInfo: (() => void) | undefined;
    setRevenueCatStatus("loading");

    void fetchRevenueCatSnapshot(appUserId)
      .then(async (snapshot) => {
        if (cancelled) {
          return;
        }

        hydrateRevenueCatSnapshot(snapshot);

        unsubscribeCustomerInfo = await subscribeToRevenueCatCustomerInfo(
          appUserId,
          (nextSnapshot) => {
            if (!cancelled) {
              hydrateRevenueCatSnapshot(nextSnapshot);
            }
          }
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to hydrate RevenueCat state.", error);
          captureErrorRef.current({
            area: "revenuecat",
            error,
            eventName: "revenuecat_hydration_failed",
            message: "Failed to hydrate RevenueCat customer state.",
            metadata: {
              user_id: appUserId,
            },
          });
          clearRevenueCatState("ready");
        }
      });

    return () => {
      cancelled = true;
      unsubscribeCustomerInfo?.();
    };
  }, [
    appShellHydrated,
    authMode,
    clearRevenueCatState,
    hydrateRevenueCatSnapshot,
    sessionResolved,
    setRevenueCatStatus,
    supabaseUserId,
  ]);

  return children;
}
