import type { PropsWithChildren } from "react";
import { useEffect } from "react";

import { isMobileSupabaseConfigured } from "../config/env";
import { fetchRemoteEntitlementSnapshot } from "../features/entitlements/supabase-entitlements";
import { useHasHydrated, useAppShellStore } from "../state/app-shell";
import { useEntitlementStore } from "../state/entitlements";
import { useErrorLogger } from "./ErrorLoggingProvider";

export function RemoteEntitlementsProvider({ children }: PropsWithChildren) {
  const appShellHydrated = useHasHydrated();
  const authMode = useAppShellStore((state) => state.authMode);
  const { captureError } = useErrorLogger();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const clearEntitlements = useEntitlementStore(
    (state) => state.clearEntitlements
  );
  const hydrateRemoteEntitlements = useEntitlementStore(
    (state) => state.hydrateRemoteEntitlements
  );
  const setEntitlementStatus = useEntitlementStore(
    (state) => state.setEntitlementStatus
  );

  useEffect(() => {
    if (!appShellHydrated || !sessionResolved) {
      return;
    }

    if (
      authMode !== "supabase" ||
      !supabaseUserId ||
      !isMobileSupabaseConfigured
    ) {
      clearEntitlements("idle");
      return;
    }

    let cancelled = false;
    setEntitlementStatus("loading");

    void fetchRemoteEntitlementSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          hydrateRemoteEntitlements(snapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to hydrate remote entitlements.", error);
          captureError({
            area: "entitlements",
            error,
            eventName: "remote_entitlements_hydration_failed",
            message: "Failed to hydrate the remote entitlements snapshot.",
            metadata: {
              user_id: supabaseUserId,
            },
          });
          clearEntitlements("ready");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    appShellHydrated,
    authMode,
    captureError,
    clearEntitlements,
    hydrateRemoteEntitlements,
    sessionResolved,
    setEntitlementStatus,
    supabaseUserId,
  ]);

  return children;
}
