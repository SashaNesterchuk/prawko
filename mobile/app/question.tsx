import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { type SupportedLocale } from "@prawko/config";

import { AppButton } from "../src/components/shell/AppButton";
import { AppScreen } from "../src/components/shell/AppScreen";
import { IconPlaceholder } from "../src/components/shell/IconPlaceholder";
import {
  EmptyStateView,
  LoadingStateView,
} from "../src/components/shell/StateViews";
import { TrainingExitDialog } from "../src/components/shell/TrainingExitDialog";
import { greenWave, greenWaveAccent } from "../src/theme/green-wave";
import { isMobileSupabaseConfigured } from "../src/config/env";
import { recordQuestionAnsweredForAds } from "../src/features/ads/ad-session-policy";
import { useAdInterstitialActions } from "../src/features/ads/show-interstitial";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import {
  buildQuestionRouteParams,
  isUuidString,
} from "../src/features/questions/question-routes";
import { QuestionMediaCard } from "../src/features/questions/QuestionMediaCard";
import {
  createQuestionSessionKey,
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
  getQuestionSessionSummary,
  getQuestionUserState,
  isQuestionSessionMode,
  isTopicBlockId,
} from "../src/features/questions/question-engine";
import type { LocalQuestion } from "../src/features/questions/types";
import { recordQuestionAttemptBySourceId } from "../src/features/questions/supabase-question-attempts";
import { syncQuestionBookmarkState } from "../src/features/questions/supabase-question-state";
import { useAppShellStore } from "../src/state/app-shell";
import { useQuestionCatalogVersion } from "../src/state/question-catalog";
import {
  useActiveQuestionSession,
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../src/state/question-progress";

export default function QuestionScreen() {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    session?: string | string[];
    studyPlanTaskId?: string | string[];
    topic?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const { maybeShowInterstitial } = useAdInterstitialActions();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const activeSession = useActiveQuestionSession();
  const startSession = useQuestionProgressStore((state) => state.startSession);
  const answerCurrentQuestion = useQuestionProgressStore(
    (state) => state.answerCurrentQuestion
  );
  const advanceSession = useQuestionProgressStore((state) => state.advanceSession);
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

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawTopic = getSingleParam(params.topic);
  const routeSessionKey = getSingleParam(params.session);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const mode = rawMode && isQuestionSessionMode(rawMode) ? rawMode : "learning";
  const questionLimit = parsePositiveInteger(rawQuestionLimit);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const topic = rawTopic && isTopicBlockId(rawTopic) ? rawTopic : undefined;
  const sessionKey = useMemo(
    () => routeSessionKey ?? createQuestionSessionKey({ mode, topic }),
    [mode, routeSessionKey, topic]
  );

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
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];
  const isCompleted = Boolean(activeSession?.finishedAt && !activeSession.emptyReason);
  const isEmptyState = Boolean(activeSession?.emptyReason);
  const trainerStyles = getTrainerStyles();

  const handleAnswer = (choiceId: LocalQuestion["correctAnswer"]) => {
    if (!currentQuestion) {
      return;
    }

    const isFirstAnswer = !currentAnswer;
    const answeredAttempt = answerCurrentQuestion(choiceId);

    if (!answeredAttempt) {
      return;
    }

    if (!isFirstAnswer) {
      return;
    }

    recordQuestionAnsweredForAds();
    maybeShowInterstitial("after_question_answer");

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

    Toast.show({
      type: "success",
      text1: isBookmarked
        ? t("toasts.bookmarkSavedTitle")
        : t("toasts.bookmarkRemovedTitle"),
      text2: isBookmarked
        ? t("toasts.bookmarkSavedSubtitle")
        : t("toasts.bookmarkRemovedSubtitle"),
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

  const handleRequestExit = () => {
    setShowExitDialog(true);
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    clearActiveSession();
    router.back();
  };

  useEffect(() => {
    if (!isCompleted || didShowSessionCompleteAdRef.current) {
      return;
    }

    didShowSessionCompleteAdRef.current = true;
    maybeShowInterstitial("after_practice_session_complete");
  }, [isCompleted, maybeShowInterstitial]);

  useEffect(() => {
    didShowSessionCompleteAdRef.current = false;
  }, [sessionKey]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionId]);

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
          ? t(`topics.${sessionTopic}`)
          : t("question.generalPool"),
      });

  const footer = (
    <View style={{ gap: 10 }}>
      {/* Footer: completed session actions */}
      {isCompleted ? (
        <>
          <AppButton
            label={t("question.restartSession")}
            onPress={() =>
              router.replace({
                pathname: "/question",
                params: buildQuestionRouteParams({
                  mode: activeSession?.request.mode ?? sessionMode,
                  questionLimit: activeSession?.request.questionLimit,
                  studyPlanTaskId: activeSession?.request.studyPlanTaskId,
                  topic: activeSession?.request.topic,
                }),
              })
            }
          />
          {summary.wrong > 0 ? (
            <AppButton
              variant="secondary"
              label={t("question.reviewWeakSpots")}
              onPress={() =>
                router.replace({
                  pathname: "/question",
                  params: buildQuestionRouteParams({ mode: "weak_spots" }),
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {/* Footer: empty session actions */}
      {isEmptyState ? (
        <AppButton
          label={t("question.openLearningQueue")}
          onPress={() =>
            router.replace({
              pathname: "/question",
              params: buildQuestionRouteParams({ mode: "learning", topic }),
            })
          }
        />
      ) : null}

      {/* Footer: next question / summary */}
      {!isCompleted && !isEmptyState && currentAnswer ? (
        <AppButton
          label={
            summary.answered >= summary.total
              ? t("question.openSummary")
              : t("question.nextQuestion")
          }
          onPress={() => advanceSession()}
        />
      ) : null}

      {/* Footer: close */}
      <AppButton
        variant="ghost"
        label={t("common.close")}
        onPress={() => router.back()}
      />
    </View>
  );

  if (!questionProgressHydrated || !activeSession) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  if (isEmptyState) {
    return (
      <AppScreen scroll={false} footer={footer}>
        <EmptyStateView
          title={t("question.emptyTitle")}
          description={screenSubtitle}
        />
      </AppScreen>
    );
  }

  if (isCompleted) {
    const total = summary.total || 1;
    const percent = Math.round((summary.correct / total) * 100);
    const passed = percent >= 70;
    const resultAccent = passed ? greenWaveAccent.green : greenWaveAccent.amber;

    return (
      <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={trainerStyles.resultContainer}>
          <View style={trainerStyles.resultHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              hitSlop={8}
              onPress={() => router.back()}
              style={trainerStyles.headerButton}
            >
              <IconPlaceholder color={greenWave.color.ink} />
            </Pressable>
          </View>

          <View style={trainerStyles.resultBodyArea}>
            <View style={trainerStyles.successBadge}>
              <IconPlaceholder color={resultAccent.ink} size={40} />
            </View>

            <Text style={trainerStyles.resultTitle}>
              {passed
                ? t("question.resultGoodTitle")
                : t("question.resultNeedsWorkTitle")}
            </Text>

            <Text style={[trainerStyles.resultPercent, { color: resultAccent.ink }]}>
              {percent}%
            </Text>

            <Text style={trainerStyles.resultCount}>
              {t("question.correctOfTotal", {
                correct: summary.correct,
                total: summary.total,
              })}
            </Text>

            <Text style={trainerStyles.resultBody}>
              {passed
                ? t("question.resultGoodBody")
                : t("question.resultNeedsWorkBody")}
            </Text>

            <View style={trainerStyles.nextCard}>
              <View style={trainerStyles.nextIconBox}>
                <IconPlaceholder color={greenWave.color.ink} />
              </View>
              <View style={trainerStyles.nextCardText}>
                <Text style={trainerStyles.nextTitle}>
                  {t("question.nextCategoryTitle")}
                </Text>
                <Text style={trainerStyles.nextSubtitle}>
                  {t("question.nextCategorySubtitle")}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: "/question",
                params: buildQuestionRouteParams({
                  mode: activeSession?.request.mode ?? sessionMode,
                  questionLimit: activeSession?.request.questionLimit,
                  studyPlanTaskId: activeSession?.request.studyPlanTaskId,
                  topic: activeSession?.request.topic,
                }),
              })
            }
            style={({ pressed }) => [
              trainerStyles.primaryButton,
              pressed ? trainerStyles.pressed : null,
            ]}
          >
            <Text style={trainerStyles.primaryButtonText}>
              {t("question.continueTraining")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={trainerStyles.reportButton}
            onPress={() => router.back()}
          >
            <Text style={trainerStyles.reportText}>{t("question.later")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion || !currentQuestionId || !currentQuestionState) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  const hasAnswered = Boolean(currentAnswer);
  const isCorrectAnswer = Boolean(currentAnswer?.isCorrect);
  const feedbackAccent = isCorrectAnswer
    ? greenWaveAccent.green
    : greenWaveAccent.red;
  const isBooleanQuestion = currentQuestion.answerType === "boolean";
  const totalQuestions = summary.total || activeSession.questionIds.length;
  const currentStep = activeSession.currentIndex + 1;
  const STEP_WINDOW = 24;
  const stepWindowStart =
    activeSession.questionIds.length > STEP_WINDOW
      ? Math.min(
        Math.max(0, activeSession.currentIndex - Math.floor(STEP_WINDOW / 2)),
        activeSession.questionIds.length - STEP_WINDOW
      )
      : 0;
  const visibleSteps = activeSession.questionIds
    .slice(stepWindowStart, stepWindowStart + STEP_WINDOW)
    .map((questionId, offset) => ({
      questionId,
      index: stepWindowStart + offset,
    }));
  const explanationText = getLocalizedText(
    currentQuestion.explanation,
    displayLocale
  );
  const scopeKey = `question.scopes.${currentQuestion.scope}`;
  const scopeLabel = t(scopeKey);

  const renderOption = (choice: { id: string; label: string }) => {
    const isSelected = currentAnswer?.selectedAnswer === choice.id;
    const isCorrectChoice = currentQuestion.correctAnswer === choice.id;
    const revealCorrect = hasAnswered && isCorrectChoice;
    const revealWrong = hasAnswered && isSelected && !isCorrectChoice;
    const dimmed = hasAnswered && !isSelected && !isCorrectChoice;
    const filled = (isSelected && isCorrectChoice) || revealWrong;

    const containerStyle = [
      isBooleanQuestion
        ? trainerStyles.booleanOption
        : trainerStyles.option,
      filled
        ? { backgroundColor: feedbackAccentForChoice(isCorrectChoice).fill }
        : null,
      revealCorrect && !filled
        ? {
          borderWidth: 2,
          borderColor: greenWaveAccent.green.fill,
        }
        : null,
      dimmed ? trainerStyles.optionDimmed : null,
    ];

    const textColor = filled
      ? greenWave.color.onAccent
      : revealCorrect
        ? greenWaveAccent.green.ink
        : greenWave.color.ink;

    return (
      <Pressable
        key={choice.id}
        accessibilityRole="button"
        accessibilityLabel={choice.label}
        disabled={hasAnswered}
        onPress={() =>
          handleAnswer(choice.id as LocalQuestion["correctAnswer"])
        }
        style={containerStyle}
      >
        {!isBooleanQuestion ? (
          revealCorrect || revealWrong ? (
            <IconPlaceholder
              color={filled ? greenWave.color.onAccent : greenWaveAccent.green.fill}
            />
          ) : (
            <View style={trainerStyles.optionBadge}>
              <Text style={trainerStyles.optionBadgeText}>
                {choice.id.toUpperCase()}
              </Text>
            </View>
          )
        ) : null}
        <Text
          style={[
            isBooleanQuestion
              ? trainerStyles.booleanOptionText
              : trainerStyles.optionText,
            { color: textColor },
            filled || revealCorrect ? trainerStyles.optionTextStrong : null,
          ]}
        >
          {choice.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={trainerStyles.container}>
        {/* Header */}
        <View style={trainerStyles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={handleRequestExit}
            style={trainerStyles.headerButton}
          >
            <IconPlaceholder color={greenWave.color.ink} />
          </Pressable>
          <View style={trainerStyles.headerCenter}>
            <Text style={trainerStyles.headerTitle}>
              {t("question.trainerTitle")}
            </Text>
            <Text style={trainerStyles.headerCounter}>
              {currentStep} / {totalQuestions}
            </Text>
          </View>
        </View>

        {/* Stepper */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={trainerStyles.stepperScroll}
          contentContainerStyle={trainerStyles.stepper}
        >
          {visibleSteps.map(({ questionId, index }) => {
            const answer = activeSession.answers[questionId];
            const stepState = answer
              ? answer.isCorrect
                ? "correct"
                : "wrong"
              : index === activeSession.currentIndex
                ? "current"
                : "upcoming";

            const pillStyle =
              stepState === "correct"
                ? { backgroundColor: greenWaveAccent.green.fill }
                : stepState === "wrong"
                  ? { backgroundColor: greenWaveAccent.red.fill }
                  : stepState === "current"
                    ? { backgroundColor: greenWave.color.ink }
                    : { backgroundColor: greenWave.color.track };

            const isFilled = stepState !== "upcoming";

            return (
              <View
                key={questionId}
                style={[trainerStyles.stepPill, pillStyle]}
              >
                <Text
                  style={[
                    trainerStyles.stepPillText,
                    {
                      color: isFilled
                        ? greenWave.color.onAccent
                        : greenWave.color.inkSecondary,
                    },
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Meta row */}
        <View style={trainerStyles.metaRow}>
          <Text style={trainerStyles.metaText}>{scopeLabel}</Text>
          <Text style={trainerStyles.metaText}>
            {t("question.pointsLabel", { points: currentQuestion.points })}
          </Text>
        </View>

        {/* Question body */}
        <ScrollView
          style={trainerStyles.body}
          contentContainerStyle={trainerStyles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {currentQuestion.media ? (
            <View style={trainerStyles.mediaBleed}>
              <QuestionMediaCard
                locale={displayLocale}
                media={currentQuestion.media}
              />
            </View>
          ) : null}

          <Text style={trainerStyles.prompt}>
            {getLocalizedText(currentQuestion.prompt, displayLocale)}
          </Text>

          <View
            style={
              isBooleanQuestion
                ? trainerStyles.booleanOptions
                : trainerStyles.options
            }
          >
            {questionChoices.map(renderOption)}
          </View>
        </ScrollView>

        {/* Footer */}
        {hasAnswered ? (
          <View
            style={[
              trainerStyles.feedbackCard,
              { backgroundColor: feedbackAccent.soft },
            ]}
          >
            <View style={trainerStyles.feedbackHeader}>
              <IconPlaceholder color={feedbackAccent.ink} />
              <Text
                style={[
                  trainerStyles.feedbackTitle,
                  { color: feedbackAccent.ink },
                ]}
              >
                {isCorrectAnswer
                  ? t("question.resultCorrect")
                  : t("question.resultWrong")}
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => handleToggleBookmark(currentQuestionId)}
              >
                <IconPlaceholder
                  color={
                    currentQuestionState.isBookmarked
                      ? greenWaveAccent.amber.fill
                      : greenWave.color.inkMuted
                  }
                />
              </Pressable>
            </View>

            {explanationText ? (
              <Text style={trainerStyles.feedbackBody}>{explanationText}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              style={trainerStyles.explainRow}
              onPress={() =>
                router.push({
                  pathname: "/modals/ai-chat",
                  params: {
                    questionId: currentQuestionId,
                    locale: displayLocale,
                    selectedAnswer: currentAnswer?.selectedAnswer,
                  },
                })
              }
            >
              <Text style={trainerStyles.explainText}>
                {isCorrectAnswer
                  ? t("question.explainOthers")
                  : t("question.explainMistake")}
              </Text>
              <View style={trainerStyles.aiBadge}>
                <IconPlaceholder color={greenWave.color.onAccent} size={14} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => advanceSession()}
              style={({ pressed }) => [
                trainerStyles.primaryButton,
                pressed ? trainerStyles.pressed : null,
              ]}
            >
              <Text style={trainerStyles.primaryButtonText}>
                {summary.answered >= summary.total
                  ? t("question.finish")
                  : isCorrectAnswer
                    ? t("question.nextQuestion")
                    : t("question.gotIt")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={trainerStyles.reportButton}
              onPress={() => router.back()}
            >
              <Text style={trainerStyles.reportText}>
                {t("question.reportProblem")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={trainerStyles.reportButton}
            onPress={() => router.back()}
          >
            <Text style={trainerStyles.reportText}>
              {t("question.reportProblem")}
            </Text>
          </Pressable>
        )}
      </View>

      <TrainingExitDialog
        body={t("question.exitConfirmBody")}
        continueLabel={t("question.exitConfirmContinue")}
        finishLabel={t("question.exitConfirmFinish")}
        onContinue={() => setShowExitDialog(false)}
        onFinish={handleConfirmExit}
        title={t("question.exitConfirmTitle")}
        visible={showExitDialog}
      />
    </SafeAreaView>
  );
}

function feedbackAccentForChoice(isCorrectChoice: boolean) {
  return isCorrectChoice ? greenWaveAccent.green : greenWaveAccent.red;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = Number.parseInt(value, 10);

  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

const getTrainerStyles = () =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: greenWave.color.paper,
    },
    container: {
      flex: 1,
      paddingHorizontal: greenWave.spacing.xl,
      paddingBottom: greenWave.spacing.xl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: greenWave.spacing.sm,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 16,
      lineHeight: 24,
      color: greenWave.color.ink,
    },
    headerCounter: {
      fontSize: 12,
      lineHeight: 16,
      color: greenWave.color.inkSecondary,
    },
    stepperScroll: {
      flexGrow: 0,
      marginTop: greenWave.spacing.md,
    },
    stepper: {
      gap: greenWave.spacing.xs,
      alignItems: "center",
    },
    stepPill: {
      minWidth: 36,
      height: 32,
      paddingHorizontal: greenWave.spacing.md,
      borderRadius: greenWave.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    stepPillText: {
      fontSize: 16,
      lineHeight: 24,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: greenWave.spacing.xl,
      paddingBottom: greenWave.spacing.sm,
    },
    metaText: {
      fontSize: 14,
      lineHeight: 20,
      color: greenWave.color.inkSecondary,
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      paddingBottom: greenWave.spacing.md,
    },
    mediaBleed: {
      marginHorizontal: -greenWave.spacing.xl,
      marginBottom: greenWave.spacing.md,
    },
    prompt: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "500",
      letterSpacing: -0.16,
      color: greenWave.color.ink,
      marginBottom: greenWave.spacing.md,
    },
    options: {
      gap: greenWave.spacing.xs,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: greenWave.spacing.md,
      padding: greenWave.spacing.md,
      borderRadius: 12,
      backgroundColor: greenWave.color.surface,
    },
    optionDimmed: {
      opacity: 0.4,
    },
    optionBadge: {
      width: 24,
      height: 24,
      borderRadius: greenWave.radius.pill,
      borderWidth: 2,
      borderColor: greenWave.color.line,
      alignItems: "center",
      justifyContent: "center",
    },
    optionBadgeText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      color: greenWave.color.inkMuted,
    },
    optionText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: greenWave.color.ink,
    },
    optionTextStrong: {
      fontWeight: "600",
    },
    booleanOptions: {
      flexDirection: "row",
      gap: greenWave.spacing.xs,
    },
    booleanOption: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: greenWave.spacing.md,
      paddingVertical: greenWave.spacing.xl,
      borderRadius: 12,
      backgroundColor: greenWave.color.surface,
    },
    booleanOptionText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: greenWave.color.ink,
    },
    feedbackCard: {
      borderTopLeftRadius: greenWave.radius.xxl,
      borderTopRightRadius: greenWave.radius.xxl,
      padding: greenWave.spacing.xl,
      marginHorizontal: -greenWave.spacing.xl,
      marginBottom: -greenWave.spacing.xl,
      gap: greenWave.spacing.md,
    },
    feedbackHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: greenWave.spacing.md,
    },
    feedbackTitle: {
      flex: 1,
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "600",
      letterSpacing: -0.2,
    },
    feedbackBody: {
      fontSize: 14,
      lineHeight: 20,
      color: greenWave.color.inkSecondary,
    },
    explainRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: greenWave.spacing.sm,
      paddingVertical: greenWave.spacing.sm,
    },
    explainText: {
      fontSize: 16,
      lineHeight: 24,
      color: greenWaveAccent.blue.ink,
    },
    aiBadge: {
      width: 24,
      height: 24,
      borderRadius: greenWave.radius.pill,
      backgroundColor: greenWaveAccent.green.fill,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButton: {
      borderRadius: greenWave.radius.pill,
      paddingHorizontal: greenWave.spacing.xl,
      paddingVertical: greenWave.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: greenWaveAccent.green.fill,
    },
    primaryButtonText: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "600",
      letterSpacing: -0.2,
      color: greenWave.color.onAccent,
    },
    pressed: {
      opacity: 0.9,
    },
    reportButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: greenWave.spacing.lg,
      paddingVertical: greenWave.spacing.md,
    },
    reportText: {
      fontSize: 16,
      lineHeight: 24,
      color: greenWave.color.inkSecondary,
    },
    resultContainer: {
      flex: 1,
      paddingHorizontal: greenWave.spacing.xl,
      paddingBottom: greenWave.spacing.xl,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    resultBodyArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    successBadge: {
      width: 96,
      height: 96,
      borderRadius: greenWave.radius.pill,
      backgroundColor: greenWave.color.paper,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: greenWave.spacing.xl,
    },
    resultTitle: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: "700",
      letterSpacing: -0.64,
      textAlign: "center",
      color: greenWave.color.ink,
      marginBottom: greenWave.spacing.lg,
    },
    resultPercent: {
      fontSize: 52,
      lineHeight: 54,
      fontWeight: "700",
      letterSpacing: -0.52,
      textAlign: "center",
      marginBottom: greenWave.spacing.md,
    },
    resultCount: {
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      color: greenWave.color.inkSecondary,
      marginBottom: greenWave.spacing.lg,
    },
    resultBody: {
      fontSize: 18,
      lineHeight: 28,
      textAlign: "center",
      color: greenWave.color.inkSecondary,
      marginBottom: greenWave.spacing.xl,
    },
    nextCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: greenWave.spacing.md,
      padding: greenWave.spacing.lg,
      borderRadius: greenWave.radius.xl,
      backgroundColor: greenWave.color.surface,
      alignSelf: "stretch",
    },
    nextIconBox: {
      padding: greenWave.spacing.sm,
      borderRadius: greenWave.radius.md,
      backgroundColor: greenWave.color.paper,
    },
    nextCardText: {
      flex: 1,
    },
    nextTitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "600",
      letterSpacing: -0.16,
      color: greenWave.color.ink,
    },
    nextSubtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: greenWave.color.inkMuted,
    },
  });
