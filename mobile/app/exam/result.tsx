import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isMobileSupabaseConfigured } from "../../src/config/env";
import { ExamRestartGateDialog } from "../../src/components/shell/ExamRestartGateDialog";
import { ExamAnswersReviewView } from "../../src/features/exam/ExamAnswersReviewView";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import {
  buildExamScopeSections,
  buildExamTopicStats,
  getExamDurationSeconds,
  getExamResultOutcome,
  getExamScoreDelta,
  getWeakestTopic,
} from "../../src/features/exam/exam-result-stats";
import {
  ExamResultCenteredState,
  ExamResultView,
} from "../../src/features/exam/ExamResultView";
import {
  cacheExamSnapshot,
  getCachedExamSnapshot,
  isFinishedExamStatus,
  loadPersistedExamSnapshot,
  sortExamQuestionsByOrder,
} from "../../src/features/exam/exam-snapshot-cache";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
} from "../../src/features/exam/exam-session";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import type {
  RemoteExamSession,
  RemoteExamSnapshot,
} from "../../src/features/exam/types";
import { useAdInterstitialActions } from "../../src/features/ads/show-interstitial";
import { getQuestionTopicTitle } from "../../src/features/question-topics/catalog";
import { getQuestionUserState } from "../../src/features/questions/question-engine";
import { syncQuestionBookmarkState } from "../../src/features/questions/supabase-question-state";
import { usePrefetchQuestionMedia } from "../../src/features/questions/usePrefetchQuestionMedia";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useHasPlusAccess } from "../../src/state/entitlements";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStore,
  useQuestionCatalogVersion,
} from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const setPreferredCategory = useAppShellStore(
    (state) => state.setPreferredCategory
  );
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const {
    preloadInterstitial,
    showInterstitialForTrigger,
    showInterstitialForUnlockGate,
  } = useAdInterstitialActions();
  const hasPlusAccess = useHasPlusAccess();
  const questionCatalogResolved = useQuestionCatalogResolved();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const toggleBookmark = useQuestionProgressStore(
    (state) => state.toggleBookmark
  );

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;

  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(() =>
    sessionId ? getCachedExamSnapshot(sessionId) : null
  );
  const [recentSessions, setRecentSessions] = useState<RemoteExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(() => !snapshot);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestartGateVisible, setIsRestartGateVisible] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const modalHideResolverRef = useRef<(() => void) | null>(null);
  const isReviewingRef = useRef(false);
  const didAttemptResultInterstitialRef = useRef(false);

  const canFetchRecent =
    authMode === "supabase" && isMobileSupabaseConfigured;

  useEffect(() => {
    isReviewingRef.current = reviewIndex !== null;
  }, [reviewIndex]);

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage("Invalid exam session id.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    didAttemptResultInterstitialRef.current = false;
    setErrorMessage(null);
    setReviewIndex(null);

    const memoryCached = getCachedExamSnapshot(sessionId);
    if (memoryCached) {
      setSnapshot(memoryCached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    void (async () => {
      const persisted = memoryCached
        ? memoryCached
        : await loadPersistedExamSnapshot(sessionId);

      if (cancelled) {
        return;
      }

      if (persisted) {
        setSnapshot(persisted);
        setIsLoading(false);
      }

      try {
        const nextSnapshot = await fetchExamSessionSnapshot(sessionId);
        if (cancelled) {
          return;
        }

        cacheExamSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to fetch exam result snapshot.", error);

        // Keep a finished cached/persisted snapshot so Answers review still works
        // even when the live session store was wiped (Fast Refresh / local Map).
        if (!persisted || !isFinishedExamStatus(persisted.session.status)) {
          setErrorMessage(getErrorMessage(error));
          if (!persisted) {
            setSnapshot(null);
          }
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
  }, [sessionId]);

  useEffect(() => {
    if (!canFetchRecent || !snapshot || snapshot.session.status === "active") {
      return;
    }

    let cancelled = false;
    void fetchRecentExamSessions(5)
      .then((sessions) => {
        if (!cancelled) {
          setRecentSessions(sessions);
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch recent exam sessions for delta.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [canFetchRecent, snapshot]);

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.session.status === "active" ||
      hasPlusAccess ||
      didAttemptResultInterstitialRef.current
    ) {
      return;
    }

    didAttemptResultInterstitialRef.current = true;

    // Fire-and-forget: ensure → show → retry → skip. Hard timeouts in the
    // interstitial controller keep this screen tappable even if the ad dies.
    void showInterstitialForTrigger("after_exam_complete").catch((error) => {
      console.warn("Exam result interstitial failed open.", error);
    });
  }, [hasPlusAccess, showInterstitialForTrigger, snapshot]);

  // Only bounce an *active* session back to the player — never while reviewing
  // answers, and never for finished sessions (completed/abandoned/expired).
  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    if (isReviewingRef.current) {
      return;
    }

    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId: snapshot.session.id,
      },
    });
  }, [snapshot]);

  const outcome = useMemo(
    () => (snapshot ? getExamResultOutcome(snapshot.session) : "failed"),
    [snapshot]
  );
  const topicStats = useMemo(
    () => (snapshot ? buildExamTopicStats(snapshot) : []),
    [snapshot]
  );
  const scopeSections = useMemo(
    () =>
      snapshot ? buildExamScopeSections(snapshot, questionUserState) : [],
    [questionUserState, snapshot]
  );
  const scoreDelta = useMemo(
    () =>
      snapshot ? getExamScoreDelta(snapshot.session, recentSessions) : null,
    [recentSessions, snapshot]
  );
  const weakestTopic = getWeakestTopic(topicStats);
  const weakestTopicLabel = weakestTopic
    ? getQuestionTopicTitle(weakestTopic, preferredLocale)
    : null;
  const sortedQuestions = useMemo(
    () => (snapshot ? sortExamQuestionsByOrder(snapshot.questions) : []),
    [snapshot]
  );
  const reviewQuestionIds = useMemo(
    () => sortedQuestions.map((question) => question.questionSourceId),
    [sortedQuestions]
  );

  usePrefetchQuestionMedia({
    catalogVersion: questionCatalogVersion,
    currentIndex: reviewIndex ?? -1,
    questionIds: reviewIndex === null ? null : reviewQuestionIds,
  });

  const answerByOrder = useMemo(() => {
    if (!snapshot) {
      return new Map<number, RemoteExamSnapshot["answers"][number]>();
    }

    return new Map(
      (snapshot.answers ?? []).map((answer) => [answer.order, answer])
    );
  }, [snapshot]);

  function switchToSessionCategory() {
    const sessionCategory = snapshot?.session.currentCategory;

    if (!sessionCategory || sessionCategory === preferredCategory) {
      return;
    }

    useQuestionCatalogStore.getState().setLoading();
    setPreferredCategory(sessionCategory);
  }

  if (isLoading) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-result-loading"
        title={t("states.loadingTitle")}
        description={t("exam.resultLoading")}
      />
    );
  }

  if (!snapshot) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-result-missing"
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
        actionTestID="exam-result-switch-category"
        title={t("exam.categoryMismatchTitle")}
        description={t("exam.categoryMismatchBody", {
          currentCategory: preferredCategory,
          sessionCategory: snapshot.session.currentCategory,
        })}
        actionLabel={t("exam.categoryMismatchSwitchCta", {
          category: snapshot.session.currentCategory,
        })}
        onAction={switchToSessionCategory}
        testID="screen-exam-result-category-mismatch"
      />
    );
  }

  if (!questionCatalogResolved) {
    return (
      <ExamResultCenteredState
        testID="screen-exam-result-loading"
        title={t("states.loadingTitle")}
        description={t("exam.resultLoading")}
      />
    );
  }

  // Do not render the result CTA row (incl. Answers) for a still-active session —
  // that race used to let users tap Answers right before replace → /exam/session
  // which then failed with sessionErrorTitle when currentQuestionIndex was past end.
  if (snapshot.session.status === "active") {
    return (
      <ExamResultCenteredState
        testID="screen-exam-result-loading"
        title={t("states.loadingTitle")}
        description={t("exam.sessionLoading")}
      />
    );
  }

  const loadedSnapshot = snapshot;

  const restartParams = buildExamRouteParams({
    mode: loadedSnapshot.session.mode,
    questionLimit: loadedSnapshot.session.totalQuestionsTarget,
    studyPlanTaskId: getStudyPlanTaskId(loadedSnapshot.session.metadata),
  });

  function goHome() {
    router.replace("/(tabs)");
  }

  function startNewExam() {
    setIsRestartGateVisible(false);
    router.replace({
      pathname: "/exam",
      params: restartParams,
    });
  }

  function waitForModalHidden() {
    return new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        modalHideResolverRef.current = null;
        resolve();
      };

      modalHideResolverRef.current = finish;
      setIsRestartGateVisible(false);
      setTimeout(finish, 450);
    });
  }

  function handleNewAttempt() {
    if (hasPlusAccess) {
      startNewExam();
      return;
    }

    track("exam_restart_gate_shown", {
      source: "exam_result",
    });
    setIsRestartGateVisible(true);
    void preloadInterstitial();
  }

  async function handleWatchAd() {
    if (isWatchingAd) {
      return;
    }

    setIsWatchingAd(true);

    try {
      await waitForModalHidden();
      const shown = await showInterstitialForUnlockGate();

      if (shown) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      track("exam_restart_via_ad", {
        ad_shown: shown,
        source: "exam_result",
      });
      startNewExam();
    } catch (error) {
      console.warn("Exam restart ad failed.", error);
      track("exam_restart_via_ad", {
        ad_shown: false,
        source: "exam_result",
      });
      startNewExam();
    } finally {
      setIsWatchingAd(false);
    }
  }

  function handlePremium() {
    setIsRestartGateVisible(false);
    track("exam_restart_via_plus", {
      source: "exam_result",
    });
    router.replace({
      pathname: "/paywall",
      params: {
        feature: "premium_access",
        returnTo: "exam",
        ...restartParams,
      },
    });
  }

  function goWorkOnMistakes() {
    router.replace("/mistakes");
  }

  function handleReviewAnswers() {
    if (sortedQuestions.length === 0) {
      console.warn("Exam Answers review has no questions in snapshot.", {
        sessionId: loadedSnapshot.session.id,
        status: loadedSnapshot.session.status,
      });
      return;
    }

    cacheExamSnapshot(loadedSnapshot);
    setReviewIndex(0);
  }

  function handleToggleBookmark(questionSourceId: string) {
    const isBookmarked = toggleBookmark(questionSourceId);

    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      void syncQuestionBookmarkState({
        questionSourceId,
        isBookmarked,
        savedFromMode: loadedSnapshot.session.mode,
        metadata: {
          source: "mobile_exam_answers_review",
          exam_session_id: loadedSnapshot.session.id,
        },
      }).catch((error) => {
        console.warn(
          `Failed to sync bookmark state for ${questionSourceId}.`,
          error
        );
      });
    }
  }

  if (reviewIndex !== null) {
    const questionRef = sortedQuestions[reviewIndex];

    if (questionRef) {
      const currentAnswer = answerByOrder.get(questionRef.order) ?? null;
      const currentQuestionState = getQuestionUserState(
        questionUserState,
        questionRef.questionSourceId
      );

      return (
        <ExamAnswersReviewView
          answer={currentAnswer}
          canGoNext
          canGoPrevious={reviewIndex > 0}
          currentIndex={reviewIndex}
          displayLocale={preferredLocale}
          isBookmarked={Boolean(currentQuestionState.isBookmarked)}
          onBack={() => setReviewIndex(null)}
          onNext={() => {
            if (reviewIndex >= sortedQuestions.length - 1) {
              setReviewIndex(null);
              return;
            }

            setReviewIndex(reviewIndex + 1);
          }}
          onPrevious={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
          onToggleBookmark={() =>
            handleToggleBookmark(questionRef.questionSourceId)
          }
          questionRef={questionRef}
          testID="screen-exam-answers-review"
          totalQuestions={sortedQuestions.length}
        />
      );
    }
  }

  return (
    <>
      <ExamResultView
        correctAnswersCount={loadedSnapshot.session.correctAnswersCount}
        durationSeconds={getExamDurationSeconds(loadedSnapshot.session)}
        onClose={goHome}
        onNewAttempt={handleNewAttempt}
        onPrimaryAction={outcome === "passed" ? goHome : goWorkOnMistakes}
        onReviewAnswers={handleReviewAnswers}
        outcome={outcome}
        passPoints={loadedSnapshot.session.passPoints}
        scoreDelta={scoreDelta}
        scorePoints={loadedSnapshot.session.scorePoints}
        scopeSections={scopeSections}
        testID="screen-exam-result"
        topicStats={topicStats}
        totalPointsTarget={loadedSnapshot.session.totalPointsTarget}
        totalQuestionsAnswered={loadedSnapshot.session.totalQuestionsTarget}
        weakestTopicLabel={weakestTopicLabel}
      />

      <ExamRestartGateDialog
        visible={isRestartGateVisible}
        title={t("exam.restartGateTitle")}
        body={t("exam.restartGateBody")}
        watchAdLabel={
          isWatchingAd
            ? t("exam.restartGateWatchingAd")
            : t("exam.restartGateWatchAdCta")
        }
        premiumLabel={t("exam.restartGatePremiumCta")}
        isWatchingAd={isWatchingAd}
        onClose={() => {
          if (isWatchingAd) {
            return;
          }

          setIsRestartGateVisible(false);
        }}
        onDismiss={() => {
          modalHideResolverRef.current?.();
        }}
        onWatchAd={() => {
          void handleWatchAd();
        }}
        onPremium={handlePremium}
      />
    </>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getStudyPlanTaskId(metadata: Record<string, unknown>) {
  const value = metadata.study_plan_task_id;

  return typeof value === "string" && value.trim() ? value : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to load exam result.";
}
