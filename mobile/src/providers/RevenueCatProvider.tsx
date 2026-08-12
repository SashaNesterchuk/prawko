import type { PropsWithChildren } from "react";
import { useEffect } from "react";

import {
  fetchRevenueCatSnapshot,
  isRevenueCatConfiguredForCurrentPlatform,
  logoutRevenueCatUser,
  subscribeToRevenueCatCustomerInfo,
} from "../features/entitlements/revenuecat";
import { useHasHydrated, useAppShellStore } from "../state/app-shell";
import { useEntitlementStore } from "../state/entitlements";
import { useErrorLogger } from "./ErrorLoggingProvider";

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const appShellHydrated = useHasHydrated();
  const authMode = useAppShellStore((state) => state.authMode);
  const { captureError } = useErrorLogger();
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

    if (authMode !== "supabase" || !supabaseUserId) {
      clearRevenueCatState("idle");
      void logoutRevenueCatUser();
      return;
    }

    if (!isRevenueCatConfiguredForCurrentPlatform()) {
      clearRevenueCatState("ready");
      return;
    }

    let cancelled = false;
    let unsubscribeCustomerInfo: (() => void) | undefined;
    setRevenueCatStatus("loading");

    void fetchRevenueCatSnapshot(supabaseUserId)
      .then(async (snapshot) => {
        if (cancelled) {
          return;
        }

        hydrateRevenueCatSnapshot(snapshot);

        unsubscribeCustomerInfo = await subscribeToRevenueCatCustomerInfo(
          supabaseUserId,
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
          captureError({
            area: "revenuecat",
            error,
            eventName: "revenuecat_hydration_failed",
            message: "Failed to hydrate RevenueCat customer state.",
            metadata: {
              user_id: supabaseUserId,
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
    captureError,
    clearRevenueCatState,
    hydrateRevenueCatSnapshot,
    sessionResolved,
    setRevenueCatStatus,
    supabaseUserId,
  ]);

  return children;
}
