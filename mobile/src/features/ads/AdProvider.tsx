import { PropsWithChildren, useEffect } from "react";

import { isAdMobEnabled } from "./admob-config";
import { setInterstitialLoaded } from "./show-interstitial";

export function AdProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!isAdMobEnabled()) {
      setInterstitialLoaded(false);
      return;
    }

    // Stub: mark inventory as ready for policy testing without native AdMob SDK.
    setInterstitialLoaded(true);

    return () => {
      setInterstitialLoaded(false);
    };
  }, []);

  return children;
}
