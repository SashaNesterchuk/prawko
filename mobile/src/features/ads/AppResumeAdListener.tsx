import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { isAdMobEnabled } from "./admob-config";
import {
  markAppBackgrounded,
  touchAdSessionActivity,
} from "./ad-session-policy";

export function AppResumeAdListener() {
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
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}
