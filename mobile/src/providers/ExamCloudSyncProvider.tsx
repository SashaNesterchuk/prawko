import { useEffect, type PropsWithChildren } from "react";
import { AppState } from "react-native";

import { isMobileSupabaseConfigured, mobileEnv } from "../config/env";
import { importCloudExamHistory, syncPendingExamResults } from "../features/exam/exam-cloud-sync";
import { subscribeExamHistory } from "../features/exam/exam-snapshot-cache";
import { checkInternetReachability } from "../features/offline/reachability";
import { useAppShellStore } from "../state/app-shell";

// Serialize across account/country changes as well as foreground retries.
let syncChain: Promise<void> = Promise.resolve();

export function ExamCloudSyncProvider({ children }: PropsWithChildren) {
  const userId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const authMode = useAppShellStore((state) => state.authMode);
  const examCountry = useAppShellStore((state) => state.examCountry);

  useEffect(() => {
    if (!isMobileSupabaseConfigured || mobileEnv.enableE2ETestMode ||
        authMode !== "supabase" || !userId || !examCountry) {
      return;
    }
    let cancelled = false;
    let queued = false;
    let needsImport = true;

    function flush() {
      if (cancelled || queued) { return; }
      queued = true;
      syncChain = syncChain.then(async () => {
        if (cancelled || !await checkInternetReachability()) { return; }
        let failed = false;
        for (const country of ["PL", "CZ", "SK"] as const) {
          if (cancelled) { return; }
          try {
            await syncPendingExamResults(country, userId!);
            if (needsImport) {
              await importCloudExamHistory(country, userId!);
            }
          } catch (error) {
            failed = true;
            console.warn(`Background ${country} exam sync deferred.`, error);
          }
        }
        needsImport = failed;
      }).catch((error) => {
        // Results stay on disk and remain usable; the next retry is idempotent.
        console.warn("Background exam sync deferred.", error);
      }).finally(() => { queued = false; });
    }

    const unsubscribe = subscribeExamHistory((_country, session) => {
      if (session && session.status !== "active") { flush(); }
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { needsImport = true; flush(); }
    });
    const retry = setInterval(flush, 60_000);
    flush();
    return () => {
      cancelled = true;
      unsubscribe();
      subscription.remove();
      clearInterval(retry);
    };
  }, [authMode, examCountry, userId]);

  return children;
}
