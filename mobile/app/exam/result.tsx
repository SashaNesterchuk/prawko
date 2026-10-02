import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager } from "react-native";

import { isMobileSupabaseConfigured } from "../../src/config/env";
import { ExamRestartGateDialog } from "../../src/components/shell/ExamRestartGateDialog";
import { ExamAnswersReviewView } from "../../src/features/exam/ExamAnswersReviewView";
import { examCompletionAnalytics } from "../../src/features/exam/exam-entry";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import { getExamProfile } from "../../src/features/exam/exam-profile";
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
import { useRecentExamSessions } from "../../src/features/exam/useRecentExamSessions";
import type {
  RemoteExamSnapshot,
} from "../../src/features/exam/types";
import { useAdInterstitialActions } from "../../src/features/ads/show-interstitial";
import { maybeRequestInAppReview } from "../../src/features/profile/request-in-app-review";
import { captureHomeContextualCompletion } from "../../src/features/home/home-contextual-record";
import { useMonetizationStore } from "../../src/features/monetization/monetization-store";
import { getQuestionTopicTitle } from "../../src/features/question-topics/catalog";
import { getQuestionUserState } from "../../src/features/questions/question-engine";
import { syncQuestionBookmarkState } from "../../src/features/questions/supabase-question-state";
import { usePrefetchQuestionMedia } from "../../src/features/questions/usePrefetchQuestionMedia";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import {
  ANALYTICS_EVENTS,
  ANALYTICS_EXAM_RESTART_CHOICES,
  ANALYTICS_PROPERTIES,
  ANALYTICS_SCREENS,
} from "../../src/analytics/catalog";
import { useAppShellStore } from "../../src/state/app-shell";
import { isMonetizationV2Active } from "../../src/features/monetization/v2/store";
import { useHasPlusAccess } from "../../src/state/entitlements";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStore,
  useQuestionCatalogVersion,
} from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { useExamCategoryMismatchAnalytics } from "../../src/features/exam/useExamCategoryMismatchAnalytics";
import { useIsFocused } from "expo-router/react-navigation";
import { useAnalyticsViewState } from "../../src/analytics/useAnalyticsViewState";
import { createAnalyticsId } from "../../src/analytics/runtime-context";
import { withLearningIntent, reportLearningOperationFailure } from "../../src/analytics/operations";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const setPreferredCategory = useAppShellStore(
    (state) => state.setPreferredCategory
  );
  const params = useLocalSearchParams<{
    justFinished?: string | string[];
    sessionId?: string | string[];
  }>();
  const {
    preloadInterstitial,
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
  const recordExamCompleted = useMonetizationStore(
    (state) => state.recordExamCompleted
  );
  const requestMonetizationSurface = useMonetizationStore(
    (state) => state.requestSurface
  );

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;

  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(() =>
    sessionId ? getCachedExamSnapshot(sessionId) : null
  );
  const { sessions: recentSessions } = useRecentExamSessions(20);
  const [isLoading, setIsLoading] = useState(() => !snapshot);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestartGateVisible, setIsRestartGateVisible] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const modalHideResolverRef = useRef<(() => void) | null>(null);
  const isReviewingRef = useRef(false);
  const didAttemptResultFollowUpForSessionRef = useRef<string | null>(null);
  const didTrackCompletionRef = useRef<string | null>(null);
  const reviewIdRef = useRef<string | null>(null);
  const resultViewedRef = useRef(false);
  const categoryMismatch = useExamCategoryMismatchAnalytics({
    examSessionId: snapshot?.session.id ?? null,
    currentCategory: preferredCategory,
    sessionCategory: snapshot?.session.currentCategory,
    screenName: "exam_result",
    eligible: !isLoading,
    resolvedReady: questionCatalogResolved,
  });

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
          reportLearningOperationFailure(track, "load_result", error, {
            exam_session_id: sessionId, screen_name: "exam_result", user_visible: true,
          });
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
    if (
      !snapshot ||
      snapshot.session.status === "active" ||
      didAttemptResultFollowUpForSessionRef.current === snapshot.session.id
    ) {
      return;
    }

    didAttemptResultFollowUpForSessionRef.current = snapshot.session.id;
    const passed = getExamResultOutcome(snapshot.session) === "passed";
    const examMode = snapshot.session.mode;

    // Wait until the result fade (and the exam exit Modal) have finished.
    // Showing AdMob during that transition flashes a native overlay that
    // then eats every tap on this screen.
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      void (async () => {
        if (cancelled) {
          return;
        }

        await maybeRequestInAppReview({
          mode: examMode,
          positiveOutcome: passed,
          source: "exam_passed",
          track,
        });
      })();
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [snapshot, track]);

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

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.session.status !== "completed" ||
      didTrackCompletionRef.current === snapshot.session.id
    ) {
      return;
    }

    didTrackCompletionRef.current = snapshot.session.id;
    const answeredCount =
      snapshot.session.correctAnswersCount + snapshot.session.wrongAnswersCount;
    captureHomeContextualCompletion({
      answeredCount,
      mode: "exam",
      sessionId: snapshot.session.id,
      totalCount: snapshot.session.totalQuestionsTarget,
    });
    const completion = recordExamCompleted(
      snapshot.session.id,
      snapshot.session.totalQuestionsTarget
    );
    if (completion.isNew && !isMonetizationV2Active()) {
      requestMonetizationSurface("paywall", "after_exam");
    }
    const completionAnalytics = examCompletionAnalytics({
      justFinished: getSingleParam(params.justFinished) === "1",
      metadata: snapshot.session.metadata,
    });
    if (completionAnalytics) {
      track(ANALYTICS_EVENTS.examSessionCompleted.key, {
        exam_session_id: snapshot.session.id,
        ...completionAnalytics,
        correct_count: snapshot.session.correctAnswersCount,
        duration_seconds: getExamDurationSeconds(snapshot.session),
        mode: snapshot.session.mode,
        passed: Boolean(snapshot.session.passed),
        question_total: snapshot.session.totalQuestionsTarget,
        score_points: snapshot.session.scorePoints,
        total_points_target: snapshot.session.totalPointsTarget,
        wrong_count: snapshot.session.wrongAnswersCount,
      });
    }
  }, [
    recordExamCompleted,
    requestMonetizationSurface,
    snapshot,
    track,
  ]);
  const topicStats = useMemo(
    () => (snapshot ? buildExamTopicStats(snapshot) : []),
    [snapshot]
  );
  const scopeSections = useMemo(
    () =>
      snapshot && getExamProfile().showWordScopes
        ? buildExamScopeSections(snapshot, questionUserState)
        : [],
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

    categoryMismatch.selectAction("switch_category");
    useQuestionCatalogStore.getState().setLoading();
    setPreferredCategory(sessionCategory);
  }
  const resultViewState = isLoading ? "loading" : !snapshot ? "error"
    : snapshot.session.currentCategory !== preferredCategory ? "category_mismatch"
    : !questionCatalogResolved ? "loading"
    : snapshot.session.status === "active" ? "session_redirect"
    : reviewIndex !== null ? "review" : isRestartGateVisible ? "restart_gate" : "result";
  useAnalyticsViewState(reviewIndex !== null ? null : resultViewState, {
    screen_name: "exam_result", exam_session_id: sessionId,
    mode: snapshot?.session.mode ?? null,
    review_id: reviewIndex !== null ? reviewIdRef.current : null,
  });
  useEffect(() => {
    if (!isFocused || resultViewState !== "result") { resultViewedRef.current = false; return; }
    if (!snapshot || resultViewedRef.current) return;
    resultViewedRef.current = true;
    track(ANALYTICS_EVENTS.examResultViewed.key, {
      exam_session_id: snapshot.session.id,
      ...examCompletionAnalytics({ justFinished: getSingleParam(params.justFinished) === "1", metadata: snapshot.session.metadata }),
      result_origin: getSingleParam(params.justFinished) === "1" ? "just_finished" : "existing_result",
      status: snapshot.session.status, mode: snapshot.session.mode, outcome,
      answered_count: snapshot.session.totalQuestionsAnswered,
      question_total: snapshot.session.totalQuestionsTarget,
      correct_count: snapshot.session.correctAnswersCount,
      wrong_count: snapshot.session.wrongAnswersCount,
    });
  }, [isFocused, outcome, params.justFinished, resultViewState, snapshot, track]);
  function resultAction(action: string) {
    track(ANALYTICS_EVENTS.examResultAction.key, {
      exam_session_id: sessionId, mode: snapshot?.session.mode ?? null, action,
    });
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
    entry: "result_restart",
    mode: loadedSnapshot.session.mode,
    questionLimit: loadedSnapshot.session.totalQuestionsTarget,
    studyPlanTaskId: getStudyPlanTaskId(loadedSnapshot.session.metadata),
  });

  function goHome() {
    resultAction("home");
    router.replace("/(tabs)");
  }

  function startNewExam() {
    setIsRestartGateVisible(false);
    router.replace({
      pathname: "/exam",
      params: withLearningIntent(restartParams, { source: "result_restart", previous_exam_session_id: loadedSnapshot.session.id }),
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
    resultAction("new_attempt");
    if (isMonetizationV2Active()) {
      startNewExam();
      return;
    }

    if (hasPlusAccess) {
      track(ANALYTICS_EVENTS.examRestartSelected.key, {
        exam_session_id: loadedSnapshot.session.id,
        [ANALYTICS_PROPERTIES.choice]: ANALYTICS_EXAM_RESTART_CHOICES.plus,
        source: "exam_result",
      });
      startNewExam();
      return;
    }

    track(ANALYTICS_EVENTS.examRestartGateShown.key, {
      exam_session_id: loadedSnapshot.session.id,
      source: "exam_result",
    });
    setIsRestartGateVisible(true);
    void preloadInterstitial();
  }

  function handleCloseGate() {
    if (isWatchingAd) {
      return;
    }

    setIsRestartGateVisible(false);
    track(ANALYTICS_EVENTS.examRestartSelected.key, {
      exam_session_id: loadedSnapshot.session.id,
      [ANALYTICS_PROPERTIES.choice]: ANALYTICS_EXAM_RESTART_CHOICES.dismiss,
      source: "exam_result",
    });
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

      track(ANALYTICS_EVENTS.examRestartSelected.key, {
        exam_session_id: loadedSnapshot.session.id,
        ad_shown: shown,
        [ANALYTICS_PROPERTIES.choice]: ANALYTICS_EXAM_RESTART_CHOICES.watchAd,
        source: "exam_result",
      });
      startNewExam();
    } catch (error) {
      console.warn("Exam restart ad failed.", error);
      track(ANALYTICS_EVENTS.examRestartSelected.key, {
        exam_session_id: loadedSnapshot.session.id,
        ad_shown: false,
        [ANALYTICS_PROPERTIES.choice]: ANALYTICS_EXAM_RESTART_CHOICES.watchAd,
        source: "exam_result",
      });
      startNewExam();
    } finally {
      setIsWatchingAd(false);
    }
  }

  function handlePremium() {
    setIsRestartGateVisible(false);
    track(ANALYTICS_EVENTS.examRestartSelected.key, {
      exam_session_id: loadedSnapshot.session.id,
      [ANALYTICS_PROPERTIES.choice]: ANALYTICS_EXAM_RESTART_CHOICES.upgrade,
      source: "exam_result",
    });
    router.replace({
      pathname: "/paywall",
      params: {
        examSessionId: loadedSnapshot.session.id,
        feature: "premium_access",
        returnTo: "exam",
        ...restartParams,
      },
    });
  }

  function goWorkOnMistakes() {
    resultAction("work_on_mistakes");
    router.replace("/mistakes");
  }

  function handleReviewAnswers() {
    resultAction("answers");
    if (sortedQuestions.length === 0) {
      console.warn("Exam Answers review has no questions in snapshot.", {
        sessionId: loadedSnapshot.session.id,
        status: loadedSnapshot.session.status,
      });
      reportLearningOperationFailure(track, "open_review", { code: "empty_snapshot" }, {
        exam_session_id: loadedSnapshot.session.id, user_visible: false,
      });
      return;
    }

    cacheExamSnapshot(loadedSnapshot);
    reviewIdRef.current = createAnalyticsId("review");
    track(ANALYTICS_EVENTS.examAnswersReviewOpened.key, {
      exam_session_id: loadedSnapshot.session.id,
      review_id: reviewIdRef.current,
      source: "result",
      mode: loadedSnapshot.session.mode,
      question_total: sortedQuestions.length,
    });
    track(ANALYTICS_EVENTS.screenViewed.key, {
      exam_session_id: loadedSnapshot.session.id,
      route_pattern: "/exam/answers",
      screen_name: ANALYTICS_SCREENS.examAnswers,
    });
    setReviewIndex(0);
  }

  function handleToggleBookmark(questionSourceId: string) {
    const isBookmarked = toggleBookmark(questionSourceId);
    track(ANALYTICS_EVENTS.questionBookmarkChanged.key, {
      exam_session_id: loadedSnapshot.session.id,
      is_bookmarked: isBookmarked,
      mode: loadedSnapshot.session.mode,
      question_id: questionSourceId,
      source: "exam_review",
    });

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
          examSessionId={loadedSnapshot.session.id}
          reviewId={reviewIdRef.current ?? undefined}
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
        onClose={handleCloseGate}
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
