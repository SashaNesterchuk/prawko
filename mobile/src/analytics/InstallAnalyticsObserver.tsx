import { useEffect, useRef } from "react";
import * as Application from "expo-application";

import { useAppUserId } from "../identity/AppIdentityProvider";
import { useAnalytics } from "../hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "./catalog";
import { getInstallObservationProperties, resolveInstallObservation } from "./install-observation";

export function InstallAnalyticsObserver() {
  const appUserId = useAppUserId();
  const { track } = useAnalytics();
  const trackRef = useRef(track);
  trackRef.current = track;
  useEffect(() => {
    let cancelled = false;
    void resolveInstallObservation(appUserId, () => Application.getInstallationTimeAsync()).then(() => {
      if (!cancelled) trackRef.current(ANALYTICS_EVENTS.installObservationResolved.key, getInstallObservationProperties(appUserId));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [appUserId]);
  return null;
}
