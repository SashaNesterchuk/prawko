import { PropsWithChildren, useEffect, useState } from "react";

import { startTimedSessionClock } from "../questions/timed-session-clock";
import { subscribeE2EAdsEnabled } from "../../testing/e2e/ads-flag";
import { isAdMobEnabled } from "./admob-config";
import {
  initializeAdMobSdk,
  startInterstitialPreload,
  stopInterstitialPreload,
} from "./interstitial-controller";

export function AdProvider({ children }: PropsWithChildren) {
  const [adsEnabled, setAdsEnabled] = useState(() => isAdMobEnabled());

  useEffect(() => startTimedSessionClock(), []);

  useEffect(() => subscribeE2EAdsEnabled(() => {
    setAdsEnabled(isAdMobEnabled());
  }), []);

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
