import { ANALYTICS_EVENTS } from "./catalog";
import type { AnalyticsTrack } from "../hooks/useAnalytics";

/** Identity links are observations; never merge people or change RevenueCat IDs. */
export function createIdentityObservationTracker() {
  let previous: { install: string; account: string | null } | null = null;
  return (track: AnalyticsTrack, install: string, account: string | null) => {
    if (previous?.install === install && previous.account === account) return;
    const before = previous;
    previous = { install, account };
    try {
      track(ANALYTICS_EVENTS.analyticsIdentityObserved.key, {
        identity_scope: "install",
        identity_link_version: 1,
        app_user_id: install,
        supabase_user_id: account,
        previous_supabase_user_id: before?.install === install ? before.account : null,
        identity_observation_reason: !before || before.install !== install ? "initial"
          : before.account && account ? "account_switch" : account ? "account_link" : "account_unlink",
      });
    } catch { /* Link telemetry never controls authentication or entitlement. */ }
  };
}
