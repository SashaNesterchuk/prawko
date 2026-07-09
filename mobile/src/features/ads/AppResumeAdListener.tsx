import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { usePathname } from "expo-router";

import { useHasPlusAccess } from "../../state/entitlements";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { isAdMobEnabled } from "./admob-config";
import {
  markAppBackgrounded,
  touchAdSessionActivity,
} from "./ad-session-policy";
import { isAdRouteBlocked, maybeShowInterstitial } from "./show-interstitial";

export function AppResumeAdListener() {
  const { track } = useAnalytics();
  const hasPlusAccess = useHasPlusAccess();
  const pathname = usePathname();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAdMobEnabled()) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        markAppBackgrounded();
        return;
      }

      if (
        (previousState === "background" || previousState === "inactive") &&
        nextState === "active"
      ) {
        touchAdSessionActivity();

        if (isAdRouteBlocked(pathname)) {
          return;
        }

        maybeShowInterstitial("app_resume", {
          hasPlusAccess,
          track,
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasPlusAccess, pathname, track]);

  return null;
}
