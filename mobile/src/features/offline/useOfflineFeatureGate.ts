import { useCallback, useEffect, useRef, useState } from "react";

import type { DrivingCategory } from "@prawko/config";

import {
  getOfflinePackAvailability,
  type OfflinePackBlockedReason,
} from "./offline-pack";
import { checkInternetReachability } from "./reachability";

type OfflineFeatureGateState =
  | {
      downloadedCategory: DrivingCategory | null;
      isOnline: boolean;
      offlineReady: boolean;
      status: "allowed";
    }
  | {
      downloadedCategory: DrivingCategory | null;
      isOnline: boolean;
      offlineReady: boolean;
      reason: OfflinePackBlockedReason;
      status: "blocked";
    }
  | {
      downloadedCategory: DrivingCategory | null;
      isOnline: null;
      offlineReady: boolean;
      status: "checking";
    };

/**
 * Online → always allowed, no offline pack I/O.
 * Offline → allowed only when a ready pack exists for the category.
 */
export function useOfflineFeatureGate(category: DrivingCategory) {
  const [state, setState] = useState<OfflineFeatureGateState>({
    downloadedCategory: null,
    isOnline: null,
    offlineReady: false,
    status: "checking",
  });
  const refreshIdRef = useRef(0);

  const refresh = useCallback(() => {
    const refreshId = refreshIdRef.current + 1;
    refreshIdRef.current = refreshId;
    const isStale = () => refreshIdRef.current !== refreshId;

    setState({
      downloadedCategory: null,
      isOnline: null,
      offlineReady: false,
      status: "checking",
    });

    void (async () => {
      const isOnline = await checkInternetReachability().catch(() => false);

      if (isStale()) {
        return;
      }

      // Online path: never touch offline pack files.
      if (isOnline) {
        setState({
          downloadedCategory: null,
          isOnline: true,
          offlineReady: false,
          status: "allowed",
        });
        return;
      }

      let availability: Awaited<ReturnType<typeof getOfflinePackAvailability>>;

      try {
        availability = await getOfflinePackAvailability(category);
      } catch {
        availability = {
          downloadedCategory: null,
          offlineReady: false,
          reason: "missing_ready_pack",
        };
      }

      if (isStale()) {
        return;
      }

      if (availability.offlineReady) {
        setState({
          downloadedCategory: availability.downloadedCategory,
          isOnline: false,
          offlineReady: true,
          status: "allowed",
        });
        return;
      }

      setState({
        downloadedCategory: availability.downloadedCategory,
        isOnline: false,
        offlineReady: false,
        reason: availability.reason,
        status: "blocked",
      });
    })();
  }, [category]);

  useEffect(() => {
    refresh();

    return () => {
      refreshIdRef.current += 1;
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
