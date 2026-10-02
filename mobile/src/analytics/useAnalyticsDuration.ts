import { useEffect, useLayoutEffect, useRef } from "react";
import { AppState } from "react-native";

import { createAnalyticsDurationClock } from "./activity";

/** Measures this component's focused exposure; never changes its behavior. */
export function useAnalyticsDuration(key: string | null, visible: boolean) {
  const clock = useRef(createAnalyticsDurationClock()).current;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useLayoutEffect(() => {
    clock.reset();
    clock.setVisible(visible && AppState.currentState === "active");
  }, [clock, key]);
  useLayoutEffect(() => {
    clock.setVisible(visible && AppState.currentState === "active");
  }, [clock, visible]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      clock.setVisible(visibleRef.current && state === "active");
    });
    return () => {
      clock.setVisible(false);
      subscription.remove();
    };
  }, [clock]);
  return clock;
}
