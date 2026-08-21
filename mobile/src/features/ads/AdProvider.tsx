import { PropsWithChildren, useEffect } from "react";

import { startTimedSessionClock } from "../questions/timed-session-clock";
import { isAdMobEnabled } from "./admob-config";
import {
  initializeAdMobSdk,
  startInterstitialPreload,
  stopInterstitialPreload,
} from "./interstitial-controller";

export function AdProvider({ children }: PropsWithChildren) {
  useEffect(() => startTimedSessionClock(), []);

  useEffect(() => {
    if (!isAdMobEnabled()) {
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
  }, []);

  return children;
}
