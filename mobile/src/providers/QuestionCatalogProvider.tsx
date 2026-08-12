import { PropsWithChildren, useEffect, useRef } from "react";

import {
  isMobileSupabaseConfigured,
  mobileEnv,
} from "../config/env";
import {
  getQuestionBank,
  hydrateQuestionBankFromLocalQuestions,
  hydrateQuestionBankFromSupabaseRecordsAsync,
  resetQuestionBankToMock,
} from "../features/questions/question-bank";
import type {
  QuestionAiExplanationMap,
  SupabaseQuestionRecord,
} from "../features/questions/supabase-question-record";
import { fetchAllSupabasePages } from "../lib/fetch-all-supabase-pages";
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
import { getE2EQuestionScenario } from "../testing/e2e/state";
import { getE2EQuestionScenarioQuestions } from "../testing/e2e/question-scenarios";
import {
  loadReadyOfflineQuestionCatalog,
  setOfflinePackMediaEnabled,
} from "../features/offline/offline-pack";
import { useErrorLogger } from "./ErrorLoggingProvider";

const QUESTION_CATALOG_SELECT = [
  "question_source_id",
  "source_row_number",
  "question_pl",
  "question_ua",
  "question_en",
  "question_de",
  "explanation_pl",
  "explanation_ua",
  "explanation_en",
  "answer_type",
  "correct_answer",
  "option_a",
  "option_b",
  "option_c",
  "option_a_ua",
  "option_b_ua",
  "option_c_ua",
  "option_a_en",
  "option_b_en",
  "option_c_en",
  "option_a_de",
  "option_b_de",
  "option_c_de",
  "points",
  "scope",
  "topic_block",
  "primary_topic_id",
  "topic_ids",
  "difficulty_seed",
  "media_asset",
  "pjm_question_asset",
  "pjm_answer_a_asset",
  "pjm_answer_b_asset",
  "pjm_answer_c_asset",
].join(", ");

const QUESTION_AI_EXPLANATION_SELECT = [
  "question_source_id",
  "explanations",
].join(", ");

type SupabaseQuestionAiExplanationRecord = {
  question_source_id: string;
  explanations: QuestionAiExplanationMap | null;
};

async function fetchAllActiveQuestionsForCategory(
  preferredCategory: string
): Promise<SupabaseQuestionRecord[]> {
  const client = getMobileSupabaseClient();

  return fetchAllSupabasePages(async (from, to) => {
    const { data, error } = await client
      .from("questions")
      .select(QUESTION_CATALOG_SELECT)
      .eq("is_active", true)
      .contains("categories", [preferredCategory])
      .order("source_row_number", { ascending: true })
      .range(from, to);

    return {
      data: ((data ?? []) as unknown) as SupabaseQuestionRecord[],
      error,
    };
  });
}

function normalizeQuestionAiExplanationMap(
  value: unknown
): QuestionAiExplanationMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).flatMap(([locale, text]) => {
    if (typeof text !== "string") {
      return [];
    }

    const normalized = text.trim();
    return normalized ? ([[locale, normalized]] as const) : [];
  });

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as QuestionAiExplanationMap;
}

function mergeQuestionAiExplanations(
  records: SupabaseQuestionRecord[],
  explanationRows: SupabaseQuestionAiExplanationRecord[]
) {
  if (explanationRows.length === 0) {
    return records;
  }

  const explanationsByQuestionId = new Map<string, QuestionAiExplanationMap>();

  for (const row of explanationRows) {
    const questionSourceId = row.question_source_id?.trim();
    const explanations = normalizeQuestionAiExplanationMap(row.explanations);

    if (!questionSourceId || !explanations) {
      continue;
    }

    explanationsByQuestionId.set(questionSourceId, explanations);
  }

  if (explanationsByQuestionId.size === 0) {
    return records;
  }

  return records.map((record) => {
    const aiExplanations = explanationsByQuestionId.get(
      record.question_source_id
    );

    return aiExplanations
      ? {
          ...record,
          ai_explanations: aiExplanations,
        }
      : record;
  });
}

async function fetchQuestionAiExplanations() {
  const client = getMobileSupabaseClient();

  return fetchAllSupabasePages(async (from, to) => {
    const { data, error } = await client
      .from("question_ai_explanations")
      .select(QUESTION_AI_EXPLANATION_SELECT)
      .order("source_row_number", { ascending: true })
      .range(from, to);

    return {
      data: ((data ?? []) as unknown) as SupabaseQuestionAiExplanationRecord[],
      error,
    };
  });
}

export function QuestionCatalogProvider({ children }: PropsWithChildren) {
  const authMode = useAppShellStore((state) => state.authMode);
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  const preferredCategory = useAppShellStore(
    (state) => state.preferredCategory
  );
  const { captureError, captureFallback } = useErrorLogger();
  const captureErrorRef = useRef(captureError);
  const captureFallbackRef = useRef(captureFallback);
  captureErrorRef.current = captureError;
  captureFallbackRef.current = captureFallback;
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const appShellHydrated = useHasHydrated();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const reconcileCatalog = useQuestionProgressStore(
    (state) => state.reconcileCatalog
  );
  const ensureTopicQuestionProgressSeeded = useQuestionProgressStore(
    (state) => state.ensureTopicQuestionProgressSeeded
  );
  const setError = useQuestionCatalogStore((state) => state.setError);
  const setLoading = useQuestionCatalogStore((state) => state.setLoading);
  const setMock = useQuestionCatalogStore((state) => state.setMock);
  const setOffline = useQuestionCatalogStore((state) => state.setOffline);
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
      ensureTopicQuestionProgressSeeded();

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

    const applyOfflineCatalog = (questions: Awaited<
      ReturnType<typeof loadReadyOfflineQuestionCatalog>
    >) => {
      if (!questions || questions.length === 0) {
        return false;
      }

      hydrateQuestionBankFromLocalQuestions(questions);
      setOfflinePackMediaEnabled(true);

      const questionIds = questions.map((question) => question.id);

      if (cancelled) {
        return true;
      }

      reconcileCatalog(questionIds);
      ensureTopicQuestionProgressSeeded();
      setOffline({
        questionCount: questionIds.length,
      });
      return true;
    };

    const e2eQuestionScenario = getE2EQuestionScenario();

    if (e2eQuestionScenario) {
      const questions = getE2EQuestionScenarioQuestions(e2eQuestionScenario);
      hydrateQuestionBankFromLocalQuestions(questions);
      setOfflinePackMediaEnabled(false);

      if (!cancelled) {
        const questionIds = questions.map((question) => question.id);
        reconcileCatalog(questionIds);
        ensureTopicQuestionProgressSeeded();
        setMock({ questionCount: questionIds.length });
      }

      return;
    }

    void (async () => {
      setOfflinePackMediaEnabled(false);

      const requiresAuthForCatalog = mobileEnv.requireAuthForQuestionCatalog;
      const hasCatalogAuthSession =
        authMode === "supabase" && Boolean(currentUserId);
      const canFetchRemoteCatalog =
        isMobileSupabaseConfigured &&
        (!requiresAuthForCatalog || hasCatalogAuthSession);

      const tryLoadOfflineCatalog = async () => {
        try {
          return await loadReadyOfflineQuestionCatalog(preferredCategory);
        } catch (error: unknown) {
          captureErrorRef.current({
            area: "question_catalog",
            error,
            eventName: "question_catalog_offline_catalog_read_failed",
            message:
              "The downloaded offline catalog could not be read, so the app continued with the normal catalog bootstrap flow.",
            metadata: {
              category: preferredCategory,
              reason: "offline_catalog_read_failed",
            },
          });
          return null;
        }
      };

      // Online-first: never block boot on reachability. Try remote when possible;
      // only fall back to the downloaded pack if remote is unavailable/fails.
      if (!canFetchRemoteCatalog) {
        const offlineQuestions = await tryLoadOfflineCatalog();
        if (applyOfflineCatalog(offlineQuestions)) {
          return;
        }
        applyMockCatalog();
        return;
      }

      setLoading();

      try {
        let records: SupabaseQuestionRecord[];

        try {
          records = await fetchAllActiveQuestionsForCategory(preferredCategory);
        } catch (error: unknown) {
          if (cancelled) {
            return;
          }

          const offlineQuestions = await tryLoadOfflineCatalog();
          if (applyOfflineCatalog(offlineQuestions)) {
            captureFallbackRef.current({
              area: "question_catalog",
              error,
              eventName: "question_catalog_offline_catalog_used",
              message:
                "Remote catalog fetch failed, so the app kept using the downloaded offline catalog.",
              metadata: {
                category: preferredCategory,
                reason: "remote_query_failed_offline_catalog_present",
              },
            });
            return;
          }

          if (authMode !== "supabase") {
            captureFallbackRef.current({
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

          captureErrorRef.current({
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

        if (cancelled) {
          return;
        }

        if (records.length === 0) {
          const offlineQuestions = await tryLoadOfflineCatalog();
          if (applyOfflineCatalog(offlineQuestions)) {
            captureFallbackRef.current({
              area: "question_catalog",
              eventName: "question_catalog_offline_catalog_used",
              message:
                "Remote catalog returned no rows, so the app kept using the downloaded offline catalog.",
              metadata: {
                category: preferredCategory,
                reason: "remote_catalog_empty_offline_catalog_present",
              },
            });
            return;
          }

          if (authMode !== "supabase") {
            captureFallbackRef.current({
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
            captureErrorRef.current({
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

        let hydratedRecords = records;

        try {
          const explanationRows = await fetchQuestionAiExplanations();
          hydratedRecords = mergeQuestionAiExplanations(
            records,
            explanationRows
          );
        } catch (error: unknown) {
          captureErrorRef.current({
            area: "question_catalog",
            error,
            eventName: "question_catalog_ai_explanations_fetch_failed",
            message:
              "Failed to fetch remote AI explanations, so the app continued with the base question explanation fields.",
            metadata: {
              category: preferredCategory,
              reason: "remote_ai_explanations_query_failed",
            },
          });
        }

        await hydrateQuestionBankFromSupabaseRecordsAsync(hydratedRecords);
        if (cancelled) {
          return;
        }
        setOfflinePackMediaEnabled(false);
        reconcileCatalog(
          hydratedRecords.map((record) => record.question_source_id)
        );
        ensureTopicQuestionProgressSeeded();
        setRemote({
          questionCount: hydratedRecords.length,
        });
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const offlineQuestions = await tryLoadOfflineCatalog();
        if (applyOfflineCatalog(offlineQuestions)) {
          captureFallbackRef.current({
            area: "question_catalog",
            error,
            eventName: "question_catalog_offline_catalog_used",
            message:
              "Question catalog hydration failed, so the app kept using the downloaded offline catalog.",
            metadata: {
              category: preferredCategory,
              reason: "remote_query_exception_offline_catalog_present",
            },
          });
          return;
        }

        if (authMode !== "supabase") {
          captureFallbackRef.current({
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

        captureErrorRef.current({
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
    currentUserId,
    ensureTopicQuestionProgressSeeded,
    preferredCategory,
    questionProgressHydrated,
    reconcileCatalog,
    sessionResolved,
    setError,
    setLoading,
    setMock,
    setOffline,
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
