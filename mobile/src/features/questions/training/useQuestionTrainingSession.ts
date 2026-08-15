import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import { AD_POLICY, QUESTION_MASTERY_RULES } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../../config/env";
import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { recordQuestionAnsweredForAds } from "../../ads/ad-session-policy";
import { useAdInterstitialActions } from "../../ads/show-interstitial";
import { useResponsiveFonts } from "../../../portable-ui";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { useTheme } from "../../../providers/ThemeProvider";
import { useAppShellStore } from "../../../state/app-shell";
import { useQuestionCatalogVersion } from "../../../state/question-catalog";
import { getLearningTopicTitle } from "../../question-topics/catalog";
import {
  useActiveQuestionSession,
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../../../state/question-progress";
import {
  getLocalizedText,
  getMasteryProgress,
  getQuestionById,
  getQuestionChoices,
  getQuestionSessionSummary,
  getQuestionUserState,
} from "../question-engine";
import type {
  LocalQuestion,
  QuestionOptionValue,
  QuestionSession,
  QuestionSessionAnswer,
  QuestionSessionSummary,
  QuestionUserState,
} from "../types";
import { recordQuestionAttemptBySourceId } from "../supabase-question-attempts";
import { syncQuestionBookmarkState } from "../supabase-question-state";

import { usePrefetchQuestionMedia } from "../usePrefetchQuestionMedia";
import { useQuestionRouteParams } from "./route-params";
import { useTrainerStyles } from "./useTrainerStyles";
import { getVisibleQuestionSteps } from "./visible-steps";

export function useQuestionTrainingSession() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const routeParams = useQuestionRouteParams();
  const { mode, questionLimit, sessionKey, studyPlanTaskId, topic } =
    routeParams;

  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const {
    maybeShowInterstitial,
    preloadInterstitial,
    showInterstitialForTrigger,
  } = useAdInterstitialActions();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const activeSession = useActiveQuestionSession();
  const startOrResumeSession = useQuestionProgressStore(
    (state) => state.startOrResumeSession
  );
  const answerCurrentQuestion = useQuestionProgressStore(
    (state) => state.answerCurrentQuestion
  );
  const advanceSession = useQuestionProgressStore((state) => state.advanceSession);
  const retreatSession = useQuestionProgressStore((state) => state.retreatSession);
  const clearActiveSession = useQuestionProgressStore(
    (state) => state.clearActiveSession
  );
  const toggleBookmark = useQuestionProgressStore((state) => state.toggleBookmark);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );

  const [displayLocale, setDisplayLocale] =
    useState<SupportedLocale>(preferredLocale);
  const [hasAnsweredThisEntry, setHasAnsweredThisEntry] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const questionStartedAtRef = useRef(Date.now());
  const didShowSessionCompleteAdRef = useRef(false);
  const trackedSessionIdRef = useRef<string | null>(null);
  const trackedCompletedSessionIdRef = useRef<string | null>(null);
  const trackedEmptySessionIdRef = useRef<string | null>(null);
  const shouldAttemptPracticeAdRef = useRef(false);

  useEffect(() => {
    setDisplayLocale(preferredLocale);
  }, [preferredLocale, sessionKey]);

  useEffect(() => {
    setHasAnsweredThisEntry(false);
  }, [sessionKey]);

  useEffect(() => {
    if (!questionProgressHydrated) {
      return;
    }

    // A resumed session adopts the route key, so this entry is already
    // resolved and later state changes (an answer, the summary) must not
    // rebuild it.
    if (
      activeSession?.request.sessionKey === sessionKey &&
      activeSession.request.currentCategory === preferredCategory
    ) {
      return;
    }

    startOrResumeSession({
      currentCategory: preferredCategory,
      mode,
      questionLimit,
      topic,
      sessionKey,
      studyPlanTaskId,
    });
  }, [
    activeSession,
    mode,
    preferredCategory,
    questionLimit,
    questionProgressHydrated,
    sessionKey,
    startOrResumeSession,
    studyPlanTaskId,
    topic,
  ]);

  const summary = useMemo(
    () => getQuestionSessionSummary(activeSession),
    [activeSession]
  );
  const currentQuestionId =
    activeSession?.questionIds[activeSession.currentIndex] ?? null;
  const currentQuestion = useMemo(
    () => (currentQuestionId ? getQuestionById(currentQuestionId) : null),
    [currentQuestionId, questionCatalogVersion]
  );

  usePrefetchQuestionMedia({
    catalogVersion: questionCatalogVersion,
    currentIndex: activeSession?.currentIndex ?? -1,
    questionIds: activeSession?.questionIds,
  });
  const currentAnswer = currentQuestionId
    ? activeSession?.answers[currentQuestionId] ?? null
    : null;
  const sessionMode = activeSession?.request.mode ?? mode;
  const sessionTopic = activeSession?.request.topic ?? topic;
  const currentQuestionState = currentQuestionId
    ? getQuestionUserState(questionUserState, currentQuestionId)
    : null;
  const masteryProgress = currentQuestionState
    ? getMasteryProgress(currentQuestionState)
    : {
        current: 0,
        target: QUESTION_MASTERY_RULES.consecutiveCorrect,
      };
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];
  const isCompleted = Boolean(activeSession?.finishedAt && !activeSession.emptyReason);
  const isEmptyState = Boolean(activeSession?.emptyReason);
  const sessionResultTotal = summary.total || 1;
  const sessionResultPercent = Math.round(
    (summary.correct / sessionResultTotal) * 100
  );
  const sessionPassed = sessionResultPercent >= 70;
  const sessionResultAccent = sessionPassed ? accents.green : accents.amber;
  const currentAnswerCorrect = Boolean(currentAnswer?.isCorrect);
  const feedbackAccent = currentAnswerCorrect ? accents.green : accents.red;
  const feedbackGradientColors = [
    feedbackAccent.wash,
    colors.white,
  ] as const;
  const trainerStyles = useTrainerStyles({
    feedbackTitleColor: feedbackAccent.ink,
    resultPercentColor: sessionResultAccent.ink,
  });
  const resultIconSize = responsiveFont(40);
  const premiumIconSize = responsiveFont(12);
  const canGoPrevious = Boolean(
    activeSession && activeSession.currentIndex > 0
  );
  const visibleSteps = activeSession
    ? getVisibleQuestionSteps(
        activeSession.questionIds,
        activeSession.currentIndex
      )
    : [];

  const screenSubtitle = isCompleted
    ? t("question.summarySubtitle", {
        correct: summary.correct,
        total: summary.total,
        mode: t(`modes.${sessionMode}`),
      })
    : isEmptyState
      ? t(`question.emptyReasons.${activeSession?.emptyReason ?? "general_empty"}`)
      : t("question.subtitle", {
          current: activeSession ? activeSession.currentIndex + 1 : 1,
          total: summary.total || 1,
          mode: t(`modes.${sessionMode}`),
          topic: sessionTopic
            ? getLearningTopicTitle(sessionTopic, displayLocale, t)
            : t("question.generalPool"),
          });

  useEffect(() => {
    if (
      !activeSession ||
      activeSession.request.sessionKey !== sessionKey ||
      activeSession.request.currentCategory !== preferredCategory ||
      trackedSessionIdRef.current === activeSession.id
    ) {
      return;
    }

    trackedSessionIdRef.current = activeSession.id;
    track(
      activeSession.answers && Object.keys(activeSession.answers).length > 0
        ? ANALYTICS_EVENTS.trainingSessionResumed.key
        : ANALYTICS_EVENTS.trainingSessionStarted.key,
      {
        mode: activeSession.request.mode,
        question_limit: activeSession.request.questionLimit ?? null,
        question_total: activeSession.questionIds.length,
        topic_id: activeSession.request.topic ?? null,
      }
    );
  }, [activeSession, preferredCategory, sessionKey, track]);

  useEffect(() => {
    if (!activeSession || !isCompleted) {
      return;
    }

    if (trackedCompletedSessionIdRef.current === activeSession.id) {
      return;
    }

    trackedCompletedSessionIdRef.current = activeSession.id;
    track(ANALYTICS_EVENTS.trainingSessionCompleted.key, {
      correct_count: summary.correct,
      incorrect_count: summary.wrong,
      mode: activeSession.request.mode,
      passed: sessionPassed,
      question_total: summary.total,
      score_percent: sessionResultPercent,
      topic_id: activeSession.request.topic ?? null,
    });
  }, [
    activeSession,
    isCompleted,
    sessionPassed,
    sessionResultPercent,
    summary.correct,
    summary.total,
    summary.wrong,
    track,
  ]);

  useEffect(() => {
    if (!activeSession || !isEmptyState) {
      return;
    }

    if (trackedEmptySessionIdRef.current === activeSession.id) {
      return;
    }

    trackedEmptySessionIdRef.current = activeSession.id;
    track(ANALYTICS_EVENTS.trainingSessionEmpty.key, {
      empty_reason: activeSession.emptyReason ?? "general_empty",
      mode: activeSession.request.mode,
      topic_id: activeSession.request.topic ?? null,
    });
  }, [activeSession, isEmptyState, track]);

  const handleAnswer = (choiceId: QuestionOptionValue) => {
    if (!currentQuestion) {
      return;
    }

    const isFirstAnswer = !currentAnswer;
    const answeredAttempt = answerCurrentQuestion(choiceId);

    if (!answeredAttempt) {
      return;
    }

    setHasAnsweredThisEntry(true);

    if (!isFirstAnswer) {
      return;
    }

    recordQuestionAnsweredForAds();
    shouldAttemptPracticeAdRef.current = true;
    const answerDurationMs = Math.max(
      0,
      Date.now() - questionStartedAtRef.current
    );

    track(ANALYTICS_EVENTS.trainingQuestionAnswered.key, {
      answer_duration_ms: answerDurationMs,
      answer_type: currentQuestion.answerType,
      is_correct: answeredAttempt.isCorrect,
      media_type: currentQuestion.media?.type ?? "none",
      mode: sessionMode,
      points: currentQuestion.points,
      primary_topic_id: currentQuestion.primaryTopicId ?? null,
      question_id: currentQuestion.id,
      question_index: (activeSession?.currentIndex ?? 0) + 1,
      question_total: summary.total,
      scope: currentQuestion.scope,
      topic_block: currentQuestion.topicBlock,
      topic_id: sessionTopic ?? null,
    });

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      return;
    }

    void recordQuestionAttemptBySourceId({
      questionSourceId: currentQuestion.id,
      mode: sessionMode,
      selectedAnswer: answeredAttempt.selectedAnswer,
      isCorrect: answeredAttempt.isCorrect,
      locale: displayLocale,
      studyPlanId: currentStudyPlanRemoteId,
      answerDurationMs,
      explanationOpened: true,
      aiChatUsed: false,
      metadata: {
        answered_at: answeredAttempt.answeredAt,
        client_attempt_id: answeredAttempt.id,
        client_session_id: answeredAttempt.sessionId,
        displayed_locale: displayLocale,
        source: "question_screen",
        study_plan_task_id: activeSession?.request.studyPlanTaskId ?? null,
        session_question_limit: activeSession?.request.questionLimit ?? null,
        topic_block: currentQuestion.topicBlock,
        primary_topic_id: currentQuestion.primaryTopicId ?? null,
        topic_ids: currentQuestion.topicIds ?? [],
      },
    }).catch((error) => {
      console.warn(
        `Failed to sync question attempt for ${currentQuestion.id}.`,
        error
      );
    });
  };

  const handleToggleBookmark = (questionId: string) => {
    const isBookmarked = toggleBookmark(questionId);
    track(ANALYTICS_EVENTS.questionBookmarkChanged.key, {
      is_bookmarked: isBookmarked,
      mode: sessionMode,
      question_id: questionId,
      source: "training",
    });

    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      void syncQuestionBookmarkState({
        questionSourceId: questionId,
        isBookmarked,
        savedFromMode: sessionMode,
        metadata: {
          source: "mobile_question_screen",
        },
      }).catch((error) => {
        console.warn(
          `Failed to sync bookmark state for ${questionId}.`,
          error
        );
      });
    }
  };

  // Nothing answered in this sitting = miss-click: skip the confirm dialog
  // (caller exits directly). Answers carried over by a resumed session do not
  // count, because leaving right away changes nothing for them.
  const hasStartedTraining = hasAnsweredThisEntry || Boolean(currentAnswer);

  const handleRequestExit = () => {
    if (!hasStartedTraining) {
      return;
    }

    setShowExitDialog(true);
  };

  const handleContinueAfterFeedback = useCallback(() => {
    const shouldAttemptInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    advanceSession();

    if (shouldAttemptInterstitial) {
      // Opportunistic only — never wait for AdMob mid-session.
      maybeShowInterstitial("after_question_answer");
    }
  }, [advanceSession, maybeShowInterstitial]);

  const handleConfirmExit = useCallback(() => {
    setShowExitDialog(false);
    const shouldAttemptPracticeInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    const answeredCount = summary.answered;
    const wasCompleted = isCompleted;

    // An unfinished session is kept so the next entry into the same mode
    // resumes at the first unanswered question; a finished one has nothing
    // left to resume and would only linger in storage.
    if (wasCompleted || isEmptyState) {
      clearActiveSession();
    }

    if (wasCompleted) {
      return;
    }

    track(ANALYTICS_EVENTS.trainingSessionAbandoned.key, {
      answered_count: answeredCount,
      correct_count: summary.correct,
      incorrect_count: summary.wrong,
      mode: sessionMode,
      question_total: summary.total,
      topic_id: sessionTopic ?? null,
    });

    // Caller navigates immediately after this returns. Schedule the ad after
    // the transition — awaiting AdMob load/show here freezes/glitches the stack
    // (exam result stays on a stable screen; exit must not).
    const showExitAd = () => {
      if (
        shouldAttemptPracticeInterstitial &&
        answeredCount >= AD_POLICY.questionsBetweenInterstitials
      ) {
        void showInterstitialForTrigger("after_question_answer");
        return;
      }

      void showInterstitialForTrigger("after_practice_session_complete", {
        practiceAnsweredCount: answeredCount,
      });
    };

    setTimeout(showExitAd, 400);
  }, [
    clearActiveSession,
    isCompleted,
    isEmptyState,
    showInterstitialForTrigger,
    summary.answered,
    summary.correct,
    summary.total,
    summary.wrong,
    sessionMode,
    sessionTopic,
    track,
  ]);

  const handleDismissExitDialog = () => {
    setShowExitDialog(false);
  };

  // Warm the creative before the streak / session-end show, same as exam gate.
  useEffect(() => {
    if (summary.answered < AD_POLICY.questionsBetweenInterstitials - 2) {
      return;
    }

    void preloadInterstitial();
  }, [preloadInterstitial, summary.answered]);

  useEffect(() => {
    if (!isCompleted || didShowSessionCompleteAdRef.current) {
      return;
    }

    didShowSessionCompleteAdRef.current = true;
    shouldAttemptPracticeAdRef.current = false;

    // Let the result view mount first (exam-result pattern).
    const timer = setTimeout(() => {
      void showInterstitialForTrigger("after_practice_session_complete", {
        practiceAnsweredCount: summary.answered,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [isCompleted, showInterstitialForTrigger, summary.answered]);

  useEffect(() => {
    didShowSessionCompleteAdRef.current = false;
  }, [preferredCategory, sessionKey]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionId]);

  return {
    activeSession,
    advanceSession,
    canGoPrevious,
    currentAnswer,
    currentAnswerCorrect,
    currentQuestion,
    currentQuestionId,
    currentQuestionState,
    displayLocale,
    feedbackAccent,
    feedbackGradientColors,
    handleAnswer,
    handleContinueAfterFeedback,
    handleConfirmExit,
    handleDismissExitDialog,
    handleRequestExit,
    handleToggleBookmark,
    hasStartedTraining,
    isCompleted,
    isEmptyState,
    isReady: questionProgressHydrated && Boolean(activeSession),
    masteryProgress,
    premiumIconSize,
    questionChoices,
    resultIconSize,
    retreatSession,
    routeParams,
    screenSubtitle,
    sessionMode,
    sessionPassed,
    sessionResultAccent,
    sessionResultPercent,
    sessionTopic,
    showExitDialog,
    summary,
    topic,
    trainerStyles,
    visibleSteps,
  };
}

export type QuestionTrainingSession = ReturnType<
  typeof useQuestionTrainingSession
>;

export type QuestionTrainingSessionData = {
  activeSession: QuestionSession;
  currentAnswer: QuestionSessionAnswer | null;
  currentQuestion: LocalQuestion;
  currentQuestionId: string;
  currentQuestionState: QuestionUserState;
  summary: QuestionSessionSummary;
};
