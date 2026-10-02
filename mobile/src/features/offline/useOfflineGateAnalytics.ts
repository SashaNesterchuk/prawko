import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useRef } from "react";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import { createAnalyticsId } from "../../analytics/runtime-context";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import type { useOfflineFeatureGate } from "./useOfflineFeatureGate";

export function useOfflineGateAnalytics({
  gate,
  visible,
  properties,
}: {
  gate: ReturnType<typeof useOfflineFeatureGate>;
  visible: boolean;
  properties: AnalyticsProperties;
}) {
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const blockRef = useRef<AnalyticsProperties | null>(null);

  useEffect(() => {
    if (!isFocused || !visible || gate.status !== "blocked") {
      blockRef.current = null;
      return;
    }
    if (blockRef.current) {
      return;
    }
    blockRef.current = {
      ...properties,
      block_id: createAnalyticsId("block"),
      blocked_reason: gate.reason,
      is_online: gate.isOnline,
      offline_ready: gate.offlineReady,
      downloaded_category: gate.downloadedCategory,
    };
    track(ANALYTICS_EVENTS.learningAccessBlocked.key, blockRef.current);
  }, [gate, isFocused, properties, track, visible]);

  return {
    getBlockId: () => blockRef.current?.block_id as string | undefined,
    trackAction(action: "retry" | "open_offline_mode" | "close", destination?: string) {
      if (!blockRef.current) {
        return;
      }
      track(ANALYTICS_EVENTS.learningAccessBlockAction.key, {
        ...blockRef.current,
        action,
        destination: destination ?? null,
      });
      if (action === "retry") {
        blockRef.current = null;
      }
    },
  };
}
