import { useEffect } from "react";
import { Observe } from "expo-observe";

import { useAppUserId } from "../identity/AppIdentityProvider";
import { useCurrentUser } from "../state/app-shell";

export function ObserveIdentitySync() {
  const appUserId = useAppUserId();
  const currentUser = useCurrentUser();

  useEffect(() => {
    Observe.setGlobalAttributes({
      // Observe keeps its own private install sampling id. Attach ours so
      // metrics can be joined with PostHog distinct_id and RevenueCat App User ID.
      app_user_id: appUserId,
      revenuecat_app_user_id: appUserId,
      supabase_user_id:
        currentUser?.provider === "supabase" ? currentUser.id : "",
    });
  }, [appUserId, currentUser]);

  return null;
}
