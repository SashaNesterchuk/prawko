import { useEffect, useState } from "react";
import { useIsFocused } from "expo-router/react-navigation";

import { getExamCountry, useAppShellStore } from "../../state/app-shell";
import { fetchRecentExamSessions } from "./exam-history";
import { subscribeExamHistory } from "./exam-snapshot-cache";
import type { RemoteExamSession } from "./types";

export function useRecentExamSessions(limit: number) {
  const isFocused = useIsFocused();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const userId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const [sessions, setSessions] = useState<RemoteExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const country = getExamCountry();
    let cancelled = false;
    let request = 0;
    setSessions([]);
    setIsLoading(true);

    function refresh() {
      const current = ++request;
      void fetchRecentExamSessions(limit, country).then((history) => {
        if (!cancelled && current === request) {
          setSessions(history);
        }
      }).catch((error) => {
        console.warn("Failed to load local exam history.", error);
      }).finally(() => {
        if (!cancelled && current === request) {
          setIsLoading(false);
        }
      });
    }

    const unsubscribe = subscribeExamHistory((changedCountry) => {
      if (changedCountry === country) {
        refresh();
      }
    });
    refresh();
    return () => { cancelled = true; unsubscribe(); };
  }, [examCountry, isFocused, limit, userId]);

  return { sessions, isLoading };
}
