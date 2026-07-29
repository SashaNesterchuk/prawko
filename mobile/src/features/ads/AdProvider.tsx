import { PropsWithChildren, useEffect } from "react";

import { isAdMobEnabled } from "./admob-config";
import {
  initializeAdMobSdk,
  startInterstitialPreload,
  stopInterstitialPreload,
} from "./interstitial-controller";

export function AdProvider({ children }: PropsWithChildren) {
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
