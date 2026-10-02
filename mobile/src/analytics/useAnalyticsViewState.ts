import { useEffect } from "react";
import { useIsFocused } from "expo-router/react-navigation";

import { analyticsActivity } from "./activity";
import type { AnalyticsProperties } from "./catalog";

export function useAnalyticsViewState(viewState: string | null, properties: AnalyticsProperties = {}) {
  const isFocused = useIsFocused();
  const signature = JSON.stringify({ ...properties, view_state: viewState });
  useEffect(() => {
    if (isFocused && viewState) {
      analyticsActivity.setViewState(JSON.parse(signature) as AnalyticsProperties);
    }
  }, [isFocused, signature, viewState]);
}
