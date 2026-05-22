import { PropsWithChildren, useEffect } from "react";

import { isMobileSupabaseConfigured } from "../config/env";
import {
  getQuestionBank,
  hydrateQuestionBankFromSupabaseRecords,
  resetQuestionBankToMock,
} from "../features/questions/question-bank";
import type { SupabaseQuestionRecord } from "../features/questions/supabase-question-record";
import { getMobileSupabaseClient } from "../lib/supabase";
import {
  useCurrentUser,
  useAppShellStore,
  useHasHydrated,
} from "../state/app-shell";
import { useQuestionCatalogStore } from "../state/question-catalog";
import {
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../state/question-progress";
import { useErrorLogger } from "./ErrorLoggingProvider";

const QUESTION_CATALOG_SELECT = [
  "question_source_id",
  "source_row_number",
  "question_pl",
  "question_ua",
  "question_en",
  "explanation_pl",
  "explanation_ua",
  "explanation_en",
  "answer_type",
  "correct_answer",
  "option_a",
  "option_b",
  "option_c",
  "points",
  "scope",
  "topic_block",
  "difficulty_seed",
  "media_asset",
  "pjm_question_asset",
  "pjm_answer_a_asset",
  "pjm_answer_b_asset",
  "pjm_answer_c_asset",
].join(", ");

export function QuestionCatalogProvider({ children }: PropsWithChildren) {
  const authMode = useAppShellStore((state) => state.authMode);
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  const preferredCategory = useAppShellStore(
    (state) => state.preferredCategory
  );
  const { captureError, captureFallback } = useErrorLogger();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const appShellHydrated = useHasHydrated();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const reconcileCatalog = useQuestionProgressStore(
    (state) => state.reconcileCatalog
  );
  const setError = useQuestionCatalogStore((state) => state.setError);
  const setLoading = useQuestionCatalogStore((state) => state.setLoading);
  const setMock = useQuestionCatalogStore((state) => state.setMock);
  const setRemote = useQuestionCatalogStore((state) => state.setRemote);

  useEffect(() => {
    if (!appShellHydrated || !questionProgressHydrated || !sessionResolved) {
      return;
    }

    let cancelled = false;

    const applyMockCatalog = (error: string | null = null) => {
      resetQuestionBankToMock();

      const questionIds = getQuestionBank().map((question) => question.id);

      if (cancelled) {
        return;
      }

      reconcileCatalog(questionIds);

      if (error) {
        setError({
          error,
          questionCount: questionIds.length,
        });
        return;
      }

      setMock({
        questionCount: questionIds.length,
      });
    };

    if (
      authMode !== "supabase" ||
      !currentUserId ||
      !isMobileSupabaseConfigured
    ) {
      applyMockCatalog();
      return;
    }

    setLoading();

    void (async () => {
      try {
        const { data, error } = await getMobileSupabaseClient()
          .from("questions")
          .select(QUESTION_CATALOG_SELECT)
          .eq("is_active", true)
          .contains("categories", [preferredCategory])
          .order("source_row_number", { ascending: true });

        if (cancelled) {
          return;
        }

        if (error) {
          if (authMode !== "supabase") {
            captureFallback({
              area: "question_catalog",
              error,
              eventName: "question_catalog_remote_fallback",
              message:
                "Remote question catalog failed, so the app fell back to the bundled mock catalog.",
              metadata: {
                category: preferredCategory,
                reason: "remote_query_failed",
              },
            });
            applyMockCatalog();
            return;
          }

          captureError({
            area: "question_catalog",
            error,
            eventName: "question_catalog_remote_fetch_failed",
            message: "Failed to fetch the remote question catalog.",
            metadata: {
              category: preferredCategory,
              reason: "remote_query_failed",
            },
          });
          applyMockCatalog(getCatalogErrorMessage(error));
          return;
        }

        const records = ((data ?? []) as unknown) as SupabaseQuestionRecord[];

        if (records.length === 0) {
          if (authMode !== "supabase") {
            captureFallback({
              area: "question_catalog",
              eventName: "question_catalog_remote_fallback",
              message:
                "Remote question catalog returned no rows, so the app fell back to the bundled mock catalog.",
              metadata: {
                category: preferredCategory,
                reason: "remote_catalog_empty",
              },
            });
          } else {
            captureError({
              area: "question_catalog",
              eventName: "question_catalog_remote_fetch_failed",
              message: "Remote question catalog returned no active rows.",
              metadata: {
                category: preferredCategory,
                reason: "remote_catalog_empty",
              },
            });
          }
          applyMockCatalog("Supabase returned an empty question catalog.");
          return;
        }

        hydrateQuestionBankFromSupabaseRecords(records);
        reconcileCatalog(records.map((record) => record.question_source_id));
        setRemote({
          questionCount: records.length,
        });
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        if (authMode !== "supabase") {
          captureFallback({
            area: "question_catalog",
            error,
            eventName: "question_catalog_remote_fallback",
            message:
              "Question catalog hydration threw before completion, so the app fell back to the bundled mock catalog.",
            metadata: {
              category: preferredCategory,
              reason: "remote_query_exception",
            },
          });
          applyMockCatalog();
          return;
        }

        captureError({
          area: "question_catalog",
          error,
          eventName: "question_catalog_remote_fetch_failed",
          message: "Question catalog hydration threw before completion.",
          metadata: {
            category: preferredCategory,
            reason: "remote_query_exception",
          },
        });
        applyMockCatalog(getCatalogErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    appShellHydrated,
    authMode,
    captureError,
    captureFallback,
    currentUserId,
    preferredCategory,
    questionProgressHydrated,
    reconcileCatalog,
    sessionResolved,
    setError,
    setLoading,
    setMock,
    setRemote,
  ]);

  return children;
}

function getCatalogErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const code = (error as { code?: unknown })?.code;

  if (typeof code === "string" && code.trim()) {
    return code;
  }

  return "Unknown question catalog error.";
}
