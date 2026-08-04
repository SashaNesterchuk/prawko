import { useCallback, useEffect, useRef, useState } from "react";

import type { DrivingCategory } from "@prawko/config";

import {
  getOfflinePackBlockedReason,
  hasReadyOfflinePackForCategory,
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
    const reachabilityPromise = checkInternetReachability().catch(() => false);
    const isStale = () => refreshIdRef.current !== refreshId;

    setState({
      downloadedCategory: null,
      isOnline: null,
      offlineReady: false,
      status: "checking",
    });

    const localStatePromise = Promise.allSettled([
      hasReadyOfflinePackForCategory(category),
      getOfflinePackBlockedReason(category),
    ]).then(([offlineReadyResult, blockedResult]) => {
      if (isStale()) {
        return null;
      }

      const offlineReady =
        offlineReadyResult.status === "fulfilled"
          ? offlineReadyResult.value
          : false;
      const blocked =
        blockedResult.status === "fulfilled"
          ? blockedResult.value
          : {
              downloadedCategory: null,
              reason: "missing_ready_pack" as const,
            };

      setState({
        downloadedCategory: blocked.downloadedCategory,
        isOnline: null,
        offlineReady,
        status: "checking",
      });

      return {
        blocked,
        offlineReady,
      };
    });

    void localStatePromise.then(async (localState) => {
      if (!localState || isStale()) {
        return;
      }

      const isOnline = await reachabilityPromise;

      if (isStale()) {
        return;
      }

      if (isOnline || localState.offlineReady) {
        setState({
          downloadedCategory: localState.blocked.downloadedCategory,
          isOnline,
          offlineReady: localState.offlineReady,
          status: "allowed",
        });
        return;
      }

      setState({
        downloadedCategory: localState.blocked.downloadedCategory,
        isOnline,
        offlineReady: localState.offlineReady,
        reason: localState.blocked.reason,
        status: "blocked",
      });
    });
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
