import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";

import type { SupportedLocale } from "@prawko/config";
import { AD_POLICY } from "@prawko/config";

import { hideModalAndWait } from "../../../components/shell/hide-modal-and-wait";
import { isMobileSupabaseConfigured } from "../../../config/env";
import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { trainingPracticeEntry } from "../../../analytics/practice-entry";
import { createTrainingLifecycle } from "../../../analytics/training-lifecycle";
import { useAnalyticsDuration } from "../../../analytics/useAnalyticsDuration";
import { useAnalyticsViewState } from "../../../analytics/useAnalyticsViewState";
import { useLearningReadyAnalytics } from "../../../analytics/useLearningReadyAnalytics";
import { reportLearningOperationFailure } from "../../../analytics/operations";
import { recordQuestionAnsweredForAds } from "../../ads/ad-session-policy";
import { useAdInterstitialActions } from "../../ads/show-interstitial";
import { maybeRequestInAppReview } from "../../profile/request-in-app-review";
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
  getQuestionById,
  getQuestionChoices,
  getQuestionSessionSummary,
  getQuestionUserState,
  getRemainingSessionSeconds,
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

import { isHomeDailySessionKey } from "../../home/home-daily-practice";
import { captureHomeContextualCompletion } from "../../home/home-contextual-record";
import {
  getFreeRoadmapTopicIds,
  resolveTopicSessionAccess,
} from "../../home/roadmap";
import { useRoadmapProgressStore } from "../../home/roadmap-progress";
import { shouldAutoShowPracticeSessionCompleteAd } from "../initial-diagnostic/session-ads";
import { getTrainingResultOutcome } from "./training-result-stats";
import { useQuestionRouteParams } from "./route-params";
import { useTrainerStyles } from "./useTrainerStyles";
import { getVisibleQuestionSteps } from "./visible-steps";
import { useMonetizationStore } from "../../monetization/monetization-store";
import { trackPremiumGateOpen } from "../../monetization/v2/analytics";
import { buildPaywallHref } from "../../monetization/v2/paywall";
import type { Href } from "expo-router";
import {
  isMonetizationV2Active,
  useMonetizationV2Store,
} from "../../monetization/v2/store";
import {
  freeQuestionsRemaining,
  isTrainingQuotaMode,
  resolveTrainingStart,
  usesFreeTopicPool,
  type TrainingAccessMethod,
} from "../../monetization/v2/usage";
import { readHasPlusAccess } from "../../../state/entitlements";

function roadmapStepAnalytics(roadmapStepId: string | null | undefined) {
  return { roadmap_step_id: roadmapStepId ?? null };
}

export function useQuestionTrainingSession() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const routeParams = useQuestionRouteParams();
  const { mode, questionLimit, roadmapStepId, sessionKey, studyPlanTaskId, timeLimitSeconds, topic, topics } =
    routeParams;

  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const examCountry = useAppShellStore((state) => state.examCountry);
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
  const finishActiveSession = useQuestionProgressStore(
    (state) => state.finishActiveSession
  );
  const toggleBookmark = useQuestionProgressStore((state) => state.toggleBookmark);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const recordTrainingCompleted = useMonetizationStore(
    (state) => state.recordTrainingCompleted
  );

  const [displayLocale, setDisplayLocale] =
    useState<SupportedLocale>(preferredLocale);
  const [hasAnsweredThisEntry, setHasAnsweredThisEntry] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const questionStartedAtRef = useRef(Date.now());
  const didShowSessionCompleteAdRef = useRef(false);
  const [lifecycle] = useState(createTrainingLifecycle);
  const [entrySessionId, setEntrySessionId] = useState<string | null>(null);
  const viewedQuestionRef = useRef<string | null>(null);
  const trackedAccessSessionIdRef = useRef<string | null>(null);
  const trainingAccessMethodRef = useRef<TrainingAccessMethod>("free_quota");
  const paywallRequestedRef = useRef(false);
  const [paywallHref, setPaywallHref] = useState<Href | null>(null);
  const trackedCompletedSessionIdRef = useRef<string | null>(null);
  const completionReasonRef = useRef("unknown_transition");
  const trackedEmptySessionIdRef = useRef<string | null>(null);
  const shouldAttemptPracticeAdRef = useRef(false);
  const showExitDialogRef = useRef(false);
  const modalHideResolverRef = useRef<(() => void) | null>(null);
  const pendingExitAdRef = useRef<(() => void) | null>(null);
  showExitDialogRef.current = showExitDialog;

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

    // Read the store snapshot instead of subscribing to `activeSession`.
    // Answering, finishing, or abandoning must not rebuild this entry; a
    // stale screen that is still mounted after exit must not overwrite a
    // newer session either.
    const previousState = useQuestionProgressStore.getState();
    const currentSession = previousState.activeSession;

    if (
      currentSession?.request.sessionKey === sessionKey &&
      currentSession.request.currentCategory === preferredCategory
    ) {
      lifecycle.enter(currentSession, currentSession);
      setEntrySessionId(currentSession.id);
      return;
    }

    // A finished session already on screen (e2e seed, Fast Refresh remount)
    // must keep the result. A new sessionKey would otherwise draw a fresh
    // queue and look like "started at question 1 of a new attempt".
    if (
      currentSession?.finishedAt &&
      !currentSession.emptyReason &&
      currentSession.request.mode === mode &&
      currentSession.request.currentCategory === preferredCategory &&
      (currentSession.request.topic ?? null) === (topic ?? null) &&
      (currentSession.request.topics ?? []).join("\0") ===
        (topics ?? []).join("\0") &&
      (currentSession.request.roadmapStepId ?? null) === (roadmapStepId ?? null) &&
      (currentSession.request.questionLimit ?? null) === (questionLimit ?? null) &&
      !isHomeDailySessionKey(currentSession.request.sessionKey) &&
      !isHomeDailySessionKey(sessionKey)
    ) {
      lifecycle.enter(currentSession, currentSession);
      setEntrySessionId(currentSession.id);
      return;
    }

    const v2 = isMonetizationV2Active();
    const isPlus = readHasPlusAccess();
    const scopedTopicIds = [...(topic ? [topic] : []), ...(topics ?? [])];
    const topicAccess = resolveTopicSessionAccess(examCountry, scopedTopicIds);
    const savedMode = mode === "saved" || mode === "saved_sprint";
    const freeTopicIds = getFreeRoadmapTopicIds(examCountry);
    const unscopedFreeLimit = freeTopicIds.reduce((sum, topicId) => {
      const access = resolveTopicSessionAccess(examCountry, [topicId]);
      return sum + (access.freeQuestionLimit ?? 0);
    }, 0);

    if (v2 && !isPlus && topicAccess.locked && !savedMode) {
      const usage = useMonetizationV2Store.getState().usage;
      if (!paywallRequestedRef.current) {
        const gateId = trackPremiumGateOpen(track, {
          free_questions_remaining: freeQuestionsRemaining(usage),
          source: "roadmap",
          surface: "question_start",
          topic_id: topic ?? null,
          ...roadmapStepAnalytics(roadmapStepId),
        });
        paywallRequestedRef.current = true;
        setPaywallHref(
          buildPaywallHref({
            premiumGateId: gateId,
            topicId: topic,
            roadmapStepId: roadmapStepId ?? undefined,
            source: "roadmap",
            surface: "question_start",
            postPurchaseAction: {
              type: "START_TRAINING",
              mode,
              topic,
              topics: topics?.join(","),
              questionLimit: questionLimit ?? undefined,
            },
          })
        );
      }
      return;
    }

    const decision = resolveTrainingStart({
      isPlus,
      mode,
      questionLimit: questionLimit ?? null,
      topicFreeQuestionLimit:
        v2 && !isPlus
          ? (topicAccess.freeQuestionLimit ??
            (scopedTopicIds.length === 0 && unscopedFreeLimit > 0
              ? unscopedFreeLimit
              : null))
          : null,
      usage: useMonetizationV2Store.getState().usage,
      v2,
    });

    if (decision.action === "paywall") {
      const usage = useMonetizationV2Store.getState().usage;
      if (!paywallRequestedRef.current) {
        const gateId = trackPremiumGateOpen(track, {
          free_questions_remaining: freeQuestionsRemaining(usage),
          source: decision.source,
          topic_id: topic ?? null,
          ...roadmapStepAnalytics(roadmapStepId),
        });
        paywallRequestedRef.current = true;
        setPaywallHref(
          buildPaywallHref({
            premiumGateId: gateId,
            topicId: topic,
            roadmapStepId: roadmapStepId ?? undefined,
            source: decision.source,
            postPurchaseAction:
              decision.source === "wrong_answers"
                ? { type: "START_WRONG_ANSWERS" }
                : decision.source === "training_limit" ||
                    decision.source === "smart_reviews" ||
                    decision.source === "trap_questions"
                  ? {
                      type: "START_TRAINING",
                      mode,
                      topic,
                      topics: topics?.join(","),
                      questionLimit: questionLimit ?? undefined,
                    }
                  : { type: "NONE" },
          })
        );
      }
      return;
    }

    trainingAccessMethodRef.current = decision.accessMethod;
    const nextSession = startOrResumeSession({
      allowedTopicIds:
        v2 && !isPlus && scopedTopicIds.length === 0 && usesFreeTopicPool(mode)
          ? freeTopicIds
          : undefined,
      currentCategory: preferredCategory,
      mode,
      questionLimit: decision.questionLimit,
      roadmapStepId,
      timeLimitSeconds,
      topic,
      topics,
      sessionKey,
      studyPlanTaskId,
    });
    const previousSession =
      currentSession?.id === nextSession.id
        ? currentSession
        : previousState.homeDailySession?.id === nextSession.id
          ? previousState.homeDailySession
          : null;
    lifecycle.enter(nextSession, previousSession);
    setEntrySessionId(nextSession.id);
  }, [
    examCountry,
    lifecycle,
    mode,
    preferredCategory,
    questionLimit,
    questionProgressHydrated,
    roadmapStepId,
    sessionKey,
    startOrResumeSession,
    studyPlanTaskId,
    timeLimitSeconds,
    topic,
    topics,
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
  const questionDuration = useAnalyticsDuration(
    `${activeSession?.id ?? ""}:${currentQuestionId ?? ""}`,
    isFocused && Boolean(currentQuestion) && !currentAnswer && !activeSession?.finishedAt && !showExitDialog
  );
  const attemptDuration = useAnalyticsDuration(
    activeSession?.id ?? null,
    isFocused && Boolean(activeSession) && !activeSession?.finishedAt
  );
  const feedbackDuration = useAnalyticsDuration(
    currentAnswer?.answeredAt ?? null,
    isFocused && Boolean(currentAnswer) && !activeSession?.finishedAt && !showExitDialog
  );
  useAnalyticsViewState(
    !activeSession ? "loading" : activeSession.emptyReason ? "empty"
      : activeSession.finishedAt ? null : showExitDialog ? "exit_confirmation"
      : currentQuestion ? currentAnswer ? "feedback" : "question" : "missing_question",
    {
      screen_name: "question_training",
      training_session_id: activeSession?.id ?? null,
      question_id: currentQuestionId,
      mode: sessionMode,
      topic_id: sessionTopic ?? null,
    }
  );
  useLearningReadyAnalytics(sessionKey,
    Boolean(activeSession?.id === entrySessionId && currentQuestion && !activeSession?.finishedAt && !activeSession?.emptyReason && !showExitDialog),
    {
      feature: "training", training_session_id: activeSession?.id ?? null,
      question_id: currentQuestionId, learning_intent_id: routeParams.learningIntentId,
    }
  );
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];
  const isCompleted = Boolean(activeSession?.finishedAt && !activeSession.emptyReason);
  const completeRoadmapStep = useRoadmapProgressStore((state) => state.completeStep);

  useEffect(() => {
    if (
      !activeSession ||
      activeSession.request.sessionKey !== sessionKey ||
      activeSession.request.currentCategory !== preferredCategory ||
      trackedAccessSessionIdRef.current === activeSession.id
    ) {
      return;
    }
    trackedAccessSessionIdRef.current = activeSession.id;
    if (
      trainingAccessMethodRef.current === "wrong_answers_preview" &&
      isMonetizationV2Active()
    ) {
      useMonetizationV2Store.getState().markWrongAnswersPreviewUsed();
    }
  }, [activeSession, preferredCategory, sessionKey]);

  useEffect(() => {
    if (!isCompleted || !roadmapStepId) {
      return;
    }

    completeRoadmapStep(roadmapStepId);
  }, [completeRoadmapStep, isCompleted, roadmapStepId]);
  const isEmptyState = Boolean(activeSession?.emptyReason);
  const remainingSeconds = getRemainingSessionSeconds(
    activeSession,
    new Date(nowMs)
  );
  const isTimedSession = remainingSeconds !== null;
  const isTimerPaused = Boolean(activeSession?.timerPausedAt);

  useEffect(() => {
    setNowMs(Date.now());
  }, [activeSession?.timerPausedAt]);

  useEffect(() => {
    if (
      !activeSession ||
      activeSession.finishedAt ||
      !isTimedSession ||
      isTimerPaused
    ) {
      return;
    }

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [activeSession, isTimedSession, isTimerPaused]);

  useEffect(() => {
    if (
      !activeSession ||
      activeSession.finishedAt ||
      remainingSeconds === null ||
      remainingSeconds > 0
    ) {
      return;
    }

    completionReasonRef.current = "timer_elapsed";
    finishActiveSession();
  }, [activeSession, finishActiveSession, remainingSeconds]);
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

  // Record the transition before result components emit passive view events.
  useLayoutEffect(() => {
    if (!activeSession || !lifecycle.matches(activeSession.id)) {
      return;
    }
    const transition = lifecycle.observe(activeSession);
    const usage = useMonetizationV2Store.getState().usage;
    const accessMethod = readHasPlusAccess()
      ? "premium"
      : trainingAccessMethodRef.current;
    const context = {
      learning_intent_id: routeParams.learningIntentId,
      training_session_id: activeSession.id,
      mode: activeSession.request.mode,
      topic_id: activeSession.request.topic ?? null,
      ...roadmapStepAnalytics(activeSession.request.roadmapStepId),
      ...trainingPracticeEntry({
        mode: activeSession.request.mode,
        roadmapStepId: activeSession.request.roadmapStepId,
        topicId: activeSession.request.topic ?? null,
      }),
    };
    if (transition.entryEvent) {
      track(
        transition.entryEvent === "resumed"
          ? ANALYTICS_EVENTS.trainingSessionResumed.key
          : ANALYTICS_EVENTS.trainingSessionStarted.key,
        {
          ...context,
          question_limit: activeSession.request.questionLimit ?? null,
          question_total: activeSession.questionIds.length,
          time_limit_seconds: activeSession.request.timeLimitSeconds ?? null,
          answered_count: summary.answered,
          ...(transition.entryEvent === "resumed"
            ? { resumed_at_question: activeSession.currentIndex + 1 } : {}),
          ...(isMonetizationV2Active()
            ? {
                access_method: transition.entryEvent === "resumed" && !readHasPlusAccess()
                  ? "unknown"
                  : accessMethod,
                access_tier: readHasPlusAccess() ? "premium" : "free",
                free_questions_remaining: freeQuestionsRemaining(usage),
              }
            : {}),
        }
      );
    }
    if (transition.completed) {
      track(ANALYTICS_EVENTS.trainingSessionCompleted.key, {
        ...context,
        answered_count: summary.answered,
        correct_count: summary.correct,
        incorrect_count: summary.wrong,
        passed: sessionPassed,
        question_total: summary.total,
        score_percent: sessionResultPercent,
        completion_reason: completionReasonRef.current,
        visit_foreground_ms: attemptDuration.measure().visible_foreground_ms,
        duration_scope: "current_component_visit",
      });
    }
  }, [activeSession, attemptDuration, lifecycle, routeParams.learningIntentId, sessionPassed, sessionResultPercent, summary, track]);

  useEffect(() => {
    if (!activeSession || !isCompleted) {
      return;
    }

    if (trackedCompletedSessionIdRef.current === activeSession.id) {
      return;
    }

    trackedCompletedSessionIdRef.current = activeSession.id;
    captureHomeContextualCompletion({
      answeredCount: summary.answered,
      mode: activeSession.request.mode,
      sessionId: activeSession.id,
      topicId: activeSession.request.topic ?? null,
      totalCount: summary.total,
    });
    recordTrainingCompleted(activeSession.id);
  }, [
    activeSession,
    isCompleted,
    sessionPassed,
    sessionResultPercent,
    summary.answered,
    summary.correct,
    summary.total,
    summary.wrong,
    recordTrainingCompleted,
  ]);

  useEffect(() => {
    if (!isFocused) {
      viewedQuestionRef.current = null;
      return;
    }
    if (
      !activeSession ||
      activeSession.id !== entrySessionId ||
      !lifecycle.matches(activeSession.id) ||
      activeSession.finishedAt ||
      isEmptyState ||
      !currentQuestion
    ) {
      return;
    }
    const key = `${activeSession.id}:${activeSession.currentIndex}`;
    if (viewedQuestionRef.current === key) {
      return;
    }
    viewedQuestionRef.current = key;
    track(ANALYTICS_EVENTS.trainingQuestionViewed.key, {
      training_session_id: activeSession.id,
      mode: activeSession.request.mode,
      question_id: currentQuestion.id,
      question_index: activeSession.currentIndex + 1,
      question_total: activeSession.questionIds.length,
      already_answered: Boolean(currentAnswer),
      media_type: currentQuestion.media?.type ?? "none",
      previous_times_seen: currentQuestionState?.timesSeen ?? 0,
      topic_id: activeSession.request.topic ?? null,
      ...roadmapStepAnalytics(activeSession.request.roadmapStepId),
    });
  }, [activeSession, currentAnswer, currentQuestion, entrySessionId, isEmptyState, isFocused, lifecycle, track]);

  useEffect(() => {
    if (
      !isFocused ||
      !activeSession ||
      activeSession.id !== entrySessionId ||
      !lifecycle.matches(activeSession.id) ||
      !isEmptyState
    ) {
      return;
    }

    if (trackedEmptySessionIdRef.current === activeSession.id) {
      return;
    }

    trackedEmptySessionIdRef.current = activeSession.id;
    track(ANALYTICS_EVENTS.trainingSessionEmpty.key, {
      training_session_id: activeSession.id,
      empty_reason: activeSession.emptyReason ?? "general_empty",
      mode: activeSession.request.mode,
      ...roadmapStepAnalytics(activeSession.request.roadmapStepId),
      ...trainingPracticeEntry({
        mode: activeSession.request.mode,
        roadmapStepId: activeSession.request.roadmapStepId,
        topicId: activeSession.request.topic ?? null,
      }),
      topic_id: activeSession.request.topic ?? null,
    });
  }, [activeSession, entrySessionId, isEmptyState, isFocused, lifecycle, track]);

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

    if (
      isMonetizationV2Active() &&
      !readHasPlusAccess() &&
      isTrainingQuotaMode(sessionMode)
    ) {
      useMonetizationV2Store.getState().recordTrainingQuestion(currentQuestion.id);
    }

    recordQuestionAnsweredForAds();
    shouldAttemptPracticeAdRef.current = true;
    const answerDurationMs = Math.max(
      0,
      Date.now() - questionStartedAtRef.current
    );

    track(ANALYTICS_EVENTS.trainingQuestionAnswered.key, {
      training_session_id: answeredAttempt.sessionId,
      answer_id: answeredAttempt.id,
      answer_duration_ms: answerDurationMs,
      answer_foreground_ms: questionDuration.measure().visible_foreground_ms,
      previous_times_seen: currentQuestionState?.timesSeen ?? 0,
      first_encounter: (currentQuestionState?.timesSeen ?? 0) === 0,
      answer_type: currentQuestion.answerType,
      is_correct: answeredAttempt.isCorrect,
      media_type: currentQuestion.media?.type ?? "none",
      mode: sessionMode,
      points: currentQuestion.points,
      primary_topic_id: currentQuestion.primaryTopicId ?? null,
      question_id: currentQuestion.id,
      question_index: (activeSession?.currentIndex ?? 0) + 1,
      question_total: summary.total,
      ...roadmapStepAnalytics(activeSession?.request.roadmapStepId),
      scope: currentQuestion.scope,
      topic_block: currentQuestion.topicBlock,
      topic_id: sessionTopic ?? null,
      ...trainingPracticeEntry({
        mode: sessionMode,
        roadmapStepId: activeSession?.request.roadmapStepId,
        topicId: sessionTopic ?? null,
      }),
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
      explanationOpened: readHasPlusAccess(),
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
      reportLearningOperationFailure(track, "sync_answer", error, {
        training_session_id: answeredAttempt.sessionId, answer_id: answeredAttempt.id,
        question_id: currentQuestion.id, user_visible: false,
      });
      console.warn(
        `Failed to sync question attempt for ${currentQuestion.id}.`,
        error
      );
    });
  };

  const handleToggleBookmark = (questionId: string) => {
    const isBookmarked = toggleBookmark(questionId);
    track(ANALYTICS_EVENTS.questionBookmarkChanged.key, {
      training_session_id: activeSession?.id ?? null,
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
    if (activeSession && currentQuestionId && currentAnswer) {
      track(ANALYTICS_EVENTS.trainingFeedbackContinued.key, {
        training_session_id: activeSession.id,
        feedback_foreground_ms: feedbackDuration.measure().visible_foreground_ms,
        question_id: currentQuestionId,
        question_index: activeSession.currentIndex + 1,
        question_total: summary.total,
        mode: sessionMode,
        is_correct: currentAnswer.isCorrect,
        action: activeSession.currentIndex >= activeSession.questionIds.length - 1
          ? "finish"
          : "next",
      });
    }
    const shouldAttemptInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    if (activeSession && activeSession.currentIndex >= activeSession.questionIds.length - 1) {
      completionReasonRef.current = "queue_finished";
    }
    advanceSession();

    if (shouldAttemptInterstitial) {
      // Opportunistic only — never wait for AdMob mid-session.
      // Controller still waits for UI idle before native show().
      maybeShowInterstitial("after_question_answer");
    }
  }, [activeSession, advanceSession, currentAnswer, currentQuestionId, maybeShowInterstitial, sessionMode, summary.total, track]);

  const hideExitDialogAndWait = useCallback(() => {
    return hideModalAndWait(
      () => setShowExitDialog(false),
      modalHideResolverRef,
      showExitDialogRef.current
    );
  }, []);

  const handleExitDialogDismissed = useCallback(() => {
    modalHideResolverRef.current?.();
  }, []);

  const showPendingExitAd = useCallback(() => {
    const showAd = pendingExitAdRef.current;
    pendingExitAdRef.current = null;
    showAd?.();
  }, []);

  const handleConfirmExit = useCallback(() => {
    setShowExitDialog(false);
    const shouldAttemptPracticeInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    const answeredCount = summary.answered;
    const wasCompleted = isCompleted;

    // Explicit leave always drops the in-memory session. The next "start"
    // must draw a fresh queue; resume is only for a process that never
    // confirmed exit (app kill). Clearing here also stops a still-mounted
    // question screen from rebuilding the abandoned session.
    clearActiveSession();

    if (wasCompleted || !activeSession || !lifecycle.matches(activeSession.id)) {
      pendingExitAdRef.current = null;
      return;
    }

    track(ANALYTICS_EVENTS.trainingSessionAbandoned.key, {
      training_session_id: activeSession?.id ?? null,
      exit_reason: activeSession.emptyReason
        ? "empty_pool"
        : answeredCount === 0 ? "zero_answer_exit" : "explicit_exit",
      answered_count: answeredCount,
      correct_count: summary.correct,
      incorrect_count: summary.wrong,
      mode: sessionMode,
      question_total: summary.total,
      ...roadmapStepAnalytics(activeSession?.request.roadmapStepId),
      ...trainingPracticeEntry({
        mode: sessionMode,
        roadmapStepId: activeSession?.request.roadmapStepId,
        topicId: sessionTopic ?? null,
      }),
      topic_id: sessionTopic ?? null,
      visit_foreground_ms: attemptDuration.measure().visible_foreground_ms,
      duration_scope: "current_component_visit",
    });

    // Caller navigates after this returns. Show the ad only after replace()
    // so AdMob is not presented over the exit Modal / outgoing screen.
    pendingExitAdRef.current = () => {
      if (!shouldAutoShowPracticeSessionCompleteAd(sessionMode)) {
        return;
      }

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
  }, [
    activeSession,
    clearActiveSession,
    isCompleted,
    lifecycle,
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

    if (!shouldAutoShowPracticeSessionCompleteAd(sessionMode)) {
      didShowSessionCompleteAdRef.current = true;
      shouldAttemptPracticeAdRef.current = false;
      return;
    }

    didShowSessionCompleteAdRef.current = true;
    shouldAttemptPracticeAdRef.current = false;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      void (async () => {
        await showInterstitialForTrigger("after_practice_session_complete", {
          practiceAnsweredCount: summary.answered,
        });

        if (cancelled) {
          return;
        }

        await maybeRequestInAppReview({
          isTimedSession,
          mode: sessionMode,
          positiveOutcome:
            getTrainingResultOutcome(sessionResultPercent) === "good",
          source: "training_good",
          track,
        });
      })();
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [
    isCompleted,
    isTimedSession,
    sessionMode,
    sessionResultPercent,
    showInterstitialForTrigger,
    summary.answered,
    track,
  ]);

  useEffect(() => {
    didShowSessionCompleteAdRef.current = false;
  }, [preferredCategory, sessionKey]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionId]);

  return {
    activeSession,
    resultOrigin: activeSession
      ? lifecycle.resultOrigin(activeSession.id)
      : "existing_result" as const,
    paywallHref,
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
    handleExitDialogDismissed,
    handleRequestExit,
    handleToggleBookmark,
    hasStartedTraining,
    hideExitDialogAndWait,
    isCompleted,
    isEmptyState,
    isReady: questionProgressHydrated && Boolean(activeSession && activeSession.id === entrySessionId),
    premiumIconSize,
    questionChoices,
    remainingSeconds,
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
    showPendingExitAd,
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
