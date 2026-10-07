import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "./catalog";
import type { LearningReadyContext, LearningReadyPayload } from "./activity-payloads";
import { useAnalyticsDuration } from "./useAnalyticsDuration";
import { useAnalytics } from "../hooks/useAnalytics";

/** Ready means usable question UI, not decoded media or a responsive main thread. */
export function useLearningReadyAnalytics(key: string | null, ready: boolean, properties: AnalyticsProperties & LearningReadyContext) {
  const { track } = useAnalytics();
  const focused = useIsFocused();
  const duration = useAnalyticsDuration(key, focused);
  const observed = useRef(false);
  const latest = useRef({ focused, ready, properties, track });
  latest.current = { focused, ready, properties, track };
  useEffect(() => {
    observed.current = false;
    duration.reset();
    duration.setVisible(focused && AppState.currentState === "active");
  }, [duration, key, focused]);
  useEffect(() => {
    function record(reason: LearningReadyPayload["ready_reason"]) {
      const current = latest.current;
      if (observed.current || !current.focused || !current.ready || AppState.currentState !== "active") return;
      observed.current = true;
      const elapsed = duration.measure();
      current.track(ANALYTICS_EVENTS.learningScreenReady.key, {
        ...current.properties,
        ready_foreground_ms: elapsed.visible_foreground_ms,
        ready_wall_ms: elapsed.observed_wall_ms,
        ready_duration_scope: reason === "foreground_return" ? "foreground_observation" : "current_focus_entry",
        ready_reason: reason,
        media_readiness: "not_measured",
      });
    }
    record("focused_ready");
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") observed.current = false;
      if (state === "active" && !observed.current) {
        duration.reset();
        duration.setVisible(latest.current.focused);
        record("foreground_return");
      }
    });
    return () => subscription.remove();
  }, [duration, focused, key, ready]);
}
