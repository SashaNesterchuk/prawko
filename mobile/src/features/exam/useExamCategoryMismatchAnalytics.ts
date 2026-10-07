import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useRef } from "react";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import { createAnalyticsId } from "../../analytics/runtime-context";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import type { CategoryMismatchScope } from "../../analytics/learning-interaction-payloads";

export function useExamCategoryMismatchAnalytics({
  examSessionId,
  currentCategory,
  sessionCategory,
  screenName,
  eligible,
  resolvedReady,
}: {
  examSessionId: string | null;
  currentCategory: CategoryMismatchScope["current_category"];
  sessionCategory?: CategoryMismatchScope["session_category"];
  screenName: CategoryMismatchScope["screen_name"];
  eligible: boolean;
  resolvedReady: boolean;
}) {
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const mismatchRef = useRef<(AnalyticsProperties & CategoryMismatchScope) | null>(null);

  useEffect(() => {
    if (!isFocused || !eligible || !examSessionId || !sessionCategory) {
      return;
    }
    if (sessionCategory !== currentCategory) {
      if (mismatchRef.current?.exam_session_id === examSessionId) {
        return;
      }
      mismatchRef.current = {
        mismatch_id: createAnalyticsId("mismatch"),
        exam_session_id: examSessionId,
        screen_name: screenName,
        current_category: currentCategory,
        session_category: sessionCategory,
      };
      track(ANALYTICS_EVENTS.examCategoryMismatchViewed.key, mismatchRef.current);
    } else if (resolvedReady && mismatchRef.current?.exam_session_id === examSessionId) {
      track(ANALYTICS_EVENTS.examCategoryMismatchResolved.key, {
        ...mismatchRef.current,
        resolved_category: currentCategory,
      });
      mismatchRef.current = null;
    }
  }, [currentCategory, eligible, examSessionId, isFocused, resolvedReady, screenName, sessionCategory, track]);

  return {
    selectAction(action: "switch_category" | "close") {
      if (!mismatchRef.current) {
        return;
      }
      track(ANALYTICS_EVENTS.examCategoryMismatchAction.key, {
        ...mismatchRef.current,
        action,
      });
      if (action === "switch_category") {
        track(ANALYTICS_EVENTS.settingsChanged.key, {
          ...mismatchRef.current,
          setting: "category",
          previous: currentCategory,
          value: sessionCategory ?? null,
          source: "exam_category_mismatch",
        });
      }
    },
  };
}
