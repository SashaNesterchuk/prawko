import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { isMobileSupabaseConfigured } from "../../src/config/env";
import { ExamAnswersReviewView } from "../../src/features/exam/ExamAnswersReviewView";
import {
  ExamResultCenteredState,
} from "../../src/features/exam/ExamResultView";
import {
  cacheExamSnapshot,
  getCachedExamSnapshot,
  loadPersistedExamSnapshot,
  sortExamQuestionsByOrder,
} from "../../src/features/exam/exam-snapshot-cache";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
} from "../../src/features/exam/exam-session";
import type {
  RemoteExamAnswer,
  RemoteExamSnapshot,
} from "../../src/features/exam/types";
import {
  getQuestionUserState,
} from "../../src/features/questions/question-engine";
import { syncQuestionBookmarkState } from "../../src/features/questions/supabase-question-state";
import { useAppShellStore } from "../../src/state/app-shell";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStore,
} from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

/**
 * Deep-link / history entry for exam answer review.
 * The primary path after finishing an exam is in-place review on `result.tsx`
 * (avoids re-fetch + never redirects into the live `/exam/session` screen).
 */
export default function ExamAnswersReviewScreen() {
  const { t } = useTranslation();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const setPreferredCategory = useAppShellStore(
    (state) => state.setPreferredCategory
  );
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
    startOrder?: string | string[];
  }>();
  const questionCatalogResolved = useQuestionCatalogResolved();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const toggleBookmark = useQuestionProgressStore(
    (state) => state.toggleBookmark
  );

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;
  const startOrder = parseOptionalOrder(getSingleParam(params.startOrder));

  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(() =>
    sessionId ? getCachedExamSnapshot(sessionId) : null
  );
  const [isLoading, setIsLoading] = useState(!snapshot);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage("Invalid exam session id.");
      setIsLoading(false);
      return;
    }

    const cached = getCachedExamSnapshot(sessionId);
    if (cached) {
      cacheExamSnapshot(cached);
      setSnapshot(cached);
      setCurrentIndex(resolveInitialIndex(cached, startOrder));
      setIsLoading(false);
      setErrorMessage(null);
      // Still try a fresh fetch below when possible, but don't block review.
    }

    let cancelled = false;
    if (!cached) {
      setIsLoading(true);
    }
    setErrorMessage(null);

    void (async () => {
      try {
        if (!cached) {
          const persisted = await loadPersistedExamSnapshot(sessionId);
          if (cancelled) {
            return;
          }
          if (persisted) {
            setSnapshot(persisted);
            setCurrentIndex(resolveInitialIndex(persisted, startOrder));
            setIsLoading(false);
          }
        }

        const nextSnapshot = await fetchExamSessionSnapshot(sessionId);
        if (cancelled) {
          return;
        }

        cacheExamSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
        setCurrentIndex(resolveInitialIndex(nextSnapshot, startOrder));
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to fetch exam answers snapshot.", error);
        if (!cached && !getCachedExamSnapshot(sessionId)) {
          setErrorMessage(getErrorMessage(error));
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, startOrder]);

  const sortedQuestions = useMemo(
    () => (snapshot ? sortExamQuestionsByOrder(snapshot.questions) : []),
    [snapshot]
  );
  const answerByOrder = useMemo(() => {
    if (!snapshot) {
      return new Map<number, RemoteExamAnswer>();
    }

    return new Map(snapshot.answers.map((answer) => [answer.order, answer]));
  }, [snapshot]);

  const currentQuestionRef = sortedQuestions[currentIndex] ?? null;
  const currentAnswer = currentQuestionRef
    ? answerByOrder.get(currentQuestionRef.order) ?? null
    : null;
  const currentQuestionState = currentQuestionRef
    ? getQuestionUserState(
        questionUserState,
        currentQuestionRef.questionSourceId
      )
    : null;

  function switchToSessionCategory() {
    const sessionCategory = snapshot?.session.currentCategory;

    if (!sessionCategory || sessionCategory === preferredCategory) {
      return;
    }

    useQuestionCatalogStore.getState().setLoading();
    setPreferredCategory(sessionCategory);
  }

  function goBackToResult() {
    if (!sessionId) {
      router.replace("/(tabs)");
      return;
    }

    router.replace({
      pathname: "/exam/result",
      params: { sessionId },
    });
  }

  function handlePrevious() {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  function handleNext() {
    if (currentIndex >= sortedQuestions.length - 1) {
      goBackToResult();
      return;
    }

    setCurrentIndex((index) =>
      Math.min(sortedQuestions.length - 1, index + 1)
    );
  }

  function handleToggleBookmark() {
    if (!currentQuestionRef) {
      return;
    }

    const questionSourceId = currentQuestionRef.questionSourceId;
    const isBookmarked = toggleBookmark(questionSourceId);

    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      void syncQuestionBookmarkState({
        questionSourceId,
        isBookmarked,
        savedFromMode: snapshot?.session.mode ?? "exam",
        metadata: {
          source: "mobile_exam_answers_review",
          exam_session_id: sessionId,
        },
      }).catch((error) => {
        console.warn(
          `Failed to sync bookmark state for ${questionSourceId}.`,
          error
        );
      });
    }
  }

  if (isLoading) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-answers-loading"
        title={t("states.loadingTitle")}
        description={t("exam.resultLoading")}
      />
    );
  }

  if (!snapshot) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-answers-missing"
        title={t("exam.resultMissingTitle")}
        description={errorMessage ?? t("exam.resultMissingBody")}
        actionLabel={t("exam.backToPracticeCta")}
        onAction={() => router.replace("/(tabs)")}
      />
    );
  }

  if (snapshot.session.currentCategory !== preferredCategory) {
    return (
      <ExamResultCenteredState
        actionTestID="exam-answers-switch-category"
        title={t("exam.categoryMismatchTitle")}
        description={t("exam.categoryMismatchBody", {
          currentCategory: preferredCategory,
          sessionCategory: snapshot.session.currentCategory,
        })}
        actionLabel={t("exam.categoryMismatchSwitchCta", {
          category: snapshot.session.currentCategory,
        })}
        onAction={switchToSessionCategory}
        testID="screen-exam-answers-category-mismatch"
      />
    );
  }

  if (!questionCatalogResolved) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-answers-loading"
        title={t("states.loadingTitle")}
        description={t("exam.resultLoading")}
      />
    );
  }

  if (!currentQuestionRef) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-answers-missing"
        title={t("exam.resultMissingTitle")}
        description={errorMessage ?? t("exam.resultMissingBody")}
        actionLabel={t("exam.backToPracticeCta")}
        onAction={() => router.replace("/(tabs)")}
      />
    );
  }

  return (
    <ExamAnswersReviewView
      answer={currentAnswer}
      canGoNext
      canGoPrevious={currentIndex > 0}
      currentIndex={currentIndex}
      displayLocale={preferredLocale}
      isBookmarked={Boolean(currentQuestionState?.isBookmarked)}
      onBack={goBackToResult}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onToggleBookmark={handleToggleBookmark}
      questionRef={currentQuestionRef}
      testID="screen-exam-answers-review"
      totalQuestions={sortedQuestions.length}
    />
  );
}

function resolveInitialIndex(
  snapshot: RemoteExamSnapshot,
  startOrder: number | null
) {
  const sortedQuestions = sortExamQuestionsByOrder(snapshot.questions);

  if (startOrder == null) {
    return 0;
  }

  const index = sortedQuestions.findIndex(
    (question) => question.order === startOrder
  );

  return index >= 0 ? index : 0;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseOptionalOrder(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to load exam answers.";
}
