import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import { AD_POLICY, QUESTION_MASTERY_RULES } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../../config/env";
import { recordQuestionAnsweredForAds } from "../../ads/ad-session-policy";
import { useAdInterstitialActions } from "../../ads/show-interstitial";
import { useResponsiveFonts } from "../../../portable-ui";
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

import { useQuestionRouteParams } from "./route-params";
import { useTrainerStyles } from "./useTrainerStyles";
import { getVisibleQuestionSteps } from "./visible-steps";

export function useQuestionTrainingSession() {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const routeParams = useQuestionRouteParams();
  const {
    mode,
    questionLimit,
    routeSessionKey,
    sessionKey,
    studyPlanTaskId,
    topic,
  } = routeParams;

  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const { maybeShowInterstitial, showInterstitialForTrigger } =
    useAdInterstitialActions();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const activeSession = useActiveQuestionSession();
  const startSession = useQuestionProgressStore((state) => state.startSession);
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
  const [showExitDialog, setShowExitDialog] = useState(false);
  const questionStartedAtRef = useRef(Date.now());
  const didShowSessionCompleteAdRef = useRef(false);
  const shouldAttemptPracticeAdRef = useRef(false);

  useEffect(() => {
    setDisplayLocale(preferredLocale);
  }, [preferredLocale, sessionKey]);

  useEffect(() => {
    if (!questionProgressHydrated) {
      return;
    }

    const shouldReuseExistingSession =
      !routeSessionKey &&
      activeSession &&
      activeSession.request.mode === mode &&
      activeSession.request.questionLimit === questionLimit &&
      activeSession.request.studyPlanTaskId === studyPlanTaskId &&
      activeSession.request.topic === topic;

    if (shouldReuseExistingSession) {
      return;
    }

    const shouldStartSession =
      !activeSession ||
      activeSession.request.sessionKey !== sessionKey ||
      activeSession.request.mode !== mode ||
      activeSession.request.questionLimit !== questionLimit ||
      activeSession.request.studyPlanTaskId !== studyPlanTaskId ||
      activeSession.request.topic !== topic;

    if (shouldStartSession) {
      startSession({
        mode,
        questionLimit,
        topic,
        sessionKey,
        studyPlanTaskId,
      });
    }
  }, [
    activeSession,
    mode,
    questionLimit,
    questionProgressHydrated,
    routeSessionKey,
    sessionKey,
    startSession,
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

  const handleAnswer = (choiceId: QuestionOptionValue) => {
    if (!currentQuestion) {
      return;
    }

    const isFirstAnswer = !currentAnswer;
    const answeredAttempt = answerCurrentQuestion(choiceId);

    if (!answeredAttempt || !isFirstAnswer) {
      return;
    }

    recordQuestionAnsweredForAds();
    shouldAttemptPracticeAdRef.current = true;

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      return;
    }

    const answerDurationMs = Math.max(
      0,
      Date.now() - questionStartedAtRef.current
    );

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

  // No answers yet = miss-click: skip the confirm dialog (caller exits directly).
  const hasStartedTraining =
    summary.answered > 0 || Boolean(currentAnswer);

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
      maybeShowInterstitial("after_question_answer");
    }
  }, [advanceSession, maybeShowInterstitial]);

  const handleConfirmExit = useCallback(async () => {
    setShowExitDialog(false);
    const shouldAttemptPracticeInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    const answeredCount = summary.answered;
    const wasCompleted = isCompleted;

    // Clear before any async ad work so a cancelled swipe / remount cannot
    // reopen into a stale persisted training session.
    clearActiveSession();

    if (wasCompleted) {
      return;
    }

    if (
      shouldAttemptPracticeInterstitial &&
      answeredCount >= AD_POLICY.questionsBetweenInterstitials
    ) {
      await showInterstitialForTrigger("after_question_answer");
      return;
    }

    await showInterstitialForTrigger("after_practice_session_complete", {
      practiceAnsweredCount: answeredCount,
    });
  }, [
    clearActiveSession,
    isCompleted,
    showInterstitialForTrigger,
    summary.answered,
  ]);

  const handleDismissExitDialog = () => {
    setShowExitDialog(false);
  };

  useEffect(() => {
    if (!isCompleted || didShowSessionCompleteAdRef.current) {
      return;
    }

    didShowSessionCompleteAdRef.current = true;
    shouldAttemptPracticeAdRef.current = false;
    void showInterstitialForTrigger("after_practice_session_complete", {
      practiceAnsweredCount: summary.answered,
    });
  }, [isCompleted, showInterstitialForTrigger, summary.answered]);

  useEffect(() => {
    didShowSessionCompleteAdRef.current = false;
  }, [sessionKey]);

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
