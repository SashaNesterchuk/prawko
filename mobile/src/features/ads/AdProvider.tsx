import { PropsWithChildren, useEffect, useState } from "react";

import { startTimedSessionClock } from "../questions/timed-session-clock";
import { subscribeE2EAdsEnabled } from "../../testing/e2e/ads-flag";
import { isAdMobEnabled } from "./admob-config";
import {
  initializeAdMobSdk,
  setAdRevenueListener,
  startInterstitialPreload,
  stopInterstitialPreload,
} from "./interstitial-controller";
import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { buildAdImpressionRevenueProperties } from "./ad-analytics";

export function AdProvider({ children }: PropsWithChildren) {
  const { track } = useAnalytics();
  const [adsEnabled, setAdsEnabled] = useState(() => isAdMobEnabled());

  useEffect(() => startTimedSessionClock(), []);

  useEffect(() => subscribeE2EAdsEnabled(() => {
    setAdsEnabled(isAdMobEnabled());
  }), []);

  useEffect(() => {
    setAdRevenueListener((event) => {
      track(
        ANALYTICS_EVENTS.adImpressionRevenue.key,
        buildAdImpressionRevenueProperties(event)
      );
    });

    return () => setAdRevenueListener(null);
  }, [track]);

  useEffect(() => {
    if (!adsEnabled) {
      stopInterstitialPreload();
      return;
    }

    let cancelled = false;
    let stopPreload: (() => void) | undefined;

    void (async () => {
      await initializeAdMobSdk();

      if (cancelled) {
        return;
      }

      stopPreload = startInterstitialPreload();
    })();

    return () => {
      cancelled = true;
      stopPreload?.();
      stopInterstitialPreload();
    };
  }, [adsEnabled]);

  return children;
}
