import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
import { isMobileSupabaseConfigured } from "../src/config/env";
import { recordQuestionAnsweredForAds } from "../src/features/ads/ad-session-policy";
import { useAdInterstitialActions } from "../src/features/ads/show-interstitial";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../src/portable-ui";
import { useTheme } from "../src/providers/ThemeProvider";
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
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
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
  const sessionResultTotal = summary.total || 1;
  const sessionResultPercent = Math.round((summary.correct / sessionResultTotal) * 100);
  const sessionPassed = sessionResultPercent >= 70;
  const sessionResultAccent = sessionPassed ? accents.green : accents.amber;
  const currentAnswerCorrect = Boolean(currentAnswer?.isCorrect);
  const feedbackAccent = currentAnswerCorrect ? accents.green : accents.red;
  const trainerStyles = useTrainerStyles({
    feedbackBackgroundColor: feedbackAccent.soft,
    feedbackTitleColor: feedbackAccent.ink,
    resultPercentColor: sessionResultAccent.ink,
  });
  const resultIconSize = responsiveFont(40);
  const aiIconSize = responsiveFont(14);

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
    <View style={trainerStyles.footerStack}>
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
              <IconPlaceholder color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={trainerStyles.resultBodyArea}>
            <View style={trainerStyles.successBadge}>
              <IconPlaceholder
                color={sessionResultAccent.ink}
                size={resultIconSize}
              />
            </View>

            <Text style={trainerStyles.resultTitle}>
              {sessionPassed
                ? t("question.resultGoodTitle")
                : t("question.resultNeedsWorkTitle")}
            </Text>

            <Text style={trainerStyles.resultPercent}>{sessionResultPercent}%</Text>

            <Text style={trainerStyles.resultCount}>
              {t("question.correctOfTotal", {
                correct: summary.correct,
                total: summary.total,
              })}
            </Text>

            <Text style={trainerStyles.resultBody}>
              {sessionPassed
                ? t("question.resultGoodBody")
                : t("question.resultNeedsWorkBody")}
            </Text>

            <View style={trainerStyles.nextCard}>
              <View style={trainerStyles.nextIconBox}>
                <IconPlaceholder color={colors.textPrimary} />
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
  const isCorrectAnswer = currentAnswerCorrect;
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
            <IconPlaceholder color={colors.textPrimary} />
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

            return (
              <QuestionStepPill key={questionId} index={index} stepState={stepState} />
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
            {questionChoices.map((choice) => (
              <QuestionChoiceOption
                key={choice.id}
                choice={choice}
                hasAnswered={hasAnswered}
                isBooleanQuestion={isBooleanQuestion}
                isCorrectChoice={currentQuestion.correctAnswer === choice.id}
                isSelected={currentAnswer?.selectedAnswer === choice.id}
                onPress={() =>
                  handleAnswer(choice.id as LocalQuestion["correctAnswer"])
                }
              />
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        {hasAnswered ? (
          <View style={trainerStyles.feedbackCard}>
            <View style={trainerStyles.feedbackHeader}>
              <IconPlaceholder color={feedbackAccent.ink} />
              <Text style={trainerStyles.feedbackTitle}>
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
                      ? accents.amber.fill
                      : colors.textMuted
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
                <IconPlaceholder color={colors.onAccent} size={aiIconSize} />
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

type QuestionChoice = {
  id: string;
  label: string;
};

type QuestionStepState = "correct" | "wrong" | "current" | "upcoming";

function QuestionChoiceOption({
  choice,
  hasAnswered,
  isBooleanQuestion,
  isCorrectChoice,
  isSelected,
  onPress,
}: {
  choice: QuestionChoice;
  hasAnswered: boolean;
  isBooleanQuestion: boolean;
  isCorrectChoice: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { accents, colors } = useTheme();
  const revealCorrect = hasAnswered && isCorrectChoice;
  const revealWrong = hasAnswered && isSelected && !isCorrectChoice;
  const filled = (isSelected && isCorrectChoice) || revealWrong;
  const styles = useQuestionChoiceStyles({
    dimmed: hasAnswered && !isSelected && !isCorrectChoice,
    filled,
    isBooleanQuestion,
    isCorrectChoice,
    revealCorrect,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={choice.label}
      disabled={hasAnswered}
      onPress={onPress}
      style={styles.container}
    >
      {!isBooleanQuestion ? (
        revealCorrect || revealWrong ? (
          <IconPlaceholder
            color={filled ? colors.onAccent : accents.green.fill}
          />
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{choice.id.toUpperCase()}</Text>
          </View>
        )
      ) : null}
      <Text style={styles.label}>{choice.label}</Text>
    </Pressable>
  );
}

function useQuestionChoiceStyles({
  dimmed,
  filled,
  isBooleanQuestion,
  isCorrectChoice,
  revealCorrect,
}: {
  dimmed: boolean;
  filled: boolean;
  isBooleanQuestion: boolean;
  isCorrectChoice: boolean;
  revealCorrect: boolean;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => {
      const fillColor = isCorrectChoice ? accents.green.fill : accents.red.fill;
      const labelColor = filled
        ? colors.onAccent
        : revealCorrect
          ? accents.green.ink
          : colors.textPrimary;

      return {
        container: {
          ...(isBooleanQuestion
            ? {
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.exact(12),
              paddingVertical: spacing.exact(24),
            }
            : {
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.exact(12),
              padding: spacing.exact(12),
            }),
          borderRadius: spacing.exact(12),
          backgroundColor: filled ? fillColor : colors.surface,
          borderWidth: revealCorrect && !filled ? 2 : 0,
          borderColor:
            revealCorrect && !filled ? accents.green.fill : colors.transparent,
          opacity: dimmed ? 0.4 : 1,
        },
        badge: {
          width: spacing.exact(24),
          height: spacing.exact(24),
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: colors.line,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: {
          fontSize: responsiveFont(12),
          lineHeight: responsiveFont(16),
          fontWeight: "600",
          color: colors.textMuted,
        },
        label: {
          ...(isBooleanQuestion
            ? {
              fontSize: responsiveFont(14),
              lineHeight: responsiveFont(20),
              textAlign: "center",
            }
            : {
              flex: 1,
              fontSize: responsiveFont(14),
              lineHeight: responsiveFont(20),
            }),
          color: labelColor,
          fontWeight: filled || revealCorrect ? "600" : "400",
        },
      };
    }
  );
}

function QuestionStepPill({
  index,
  stepState,
}: {
  index: number;
  stepState: QuestionStepState;
}) {
  const styles = useQuestionStepPillStyles({ stepState });

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{index + 1}</Text>
    </View>
  );
}

function useQuestionStepPillStyles({
  stepState,
}: {
  stepState: QuestionStepState;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => {
      const backgroundColor =
        stepState === "correct"
          ? accents.green.fill
          : stepState === "wrong"
            ? accents.red.fill
            : stepState === "current"
              ? colors.textPrimary
              : colors.track;

      return {
        pill: {
          minWidth: spacing.exact(36),
          height: spacing.exact(32),
          paddingHorizontal: spacing.exact(12),
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
        },
        label: {
          fontSize: responsiveFont(16),
          lineHeight: responsiveFont(24),
          color:
            stepState === "upcoming" ? colors.textSecondary : colors.onAccent,
        },
      };
    }
  );
}

function useTrainerStyles({
  feedbackBackgroundColor,
  feedbackTitleColor,
  resultPercentColor,
}: {
  feedbackBackgroundColor: string;
  feedbackTitleColor: string;
  resultPercentColor: string;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
        backgroundColor: colors.paper,
      },
      footerStack: {
        gap: spacing.exact(10),
      },
      container: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      headerButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
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
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textPrimary,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      stepperScroll: {
        flexGrow: 0,
        marginTop: spacing.exact(12),
      },
      stepper: {
        gap: spacing.exact(4),
        alignItems: "center",
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: spacing.exact(24),
        paddingBottom: spacing.exact(8),
      },
      metaText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      body: {
        flex: 1,
      },
      bodyContent: {
        paddingBottom: spacing.exact(12),
      },
      mediaBleed: {
        marginHorizontal: -spacing.exact(24),
        marginBottom: spacing.exact(12),
      },
      prompt: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "500",
        letterSpacing: -0.16,
        color: colors.textPrimary,
        marginBottom: spacing.exact(12),
      },
      options: {
        gap: spacing.exact(4),
      },
      booleanOptions: {
        flexDirection: "row",
        gap: spacing.exact(4),
      },
      feedbackCard: {
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        padding: spacing.exact(24),
        marginHorizontal: -spacing.exact(24),
        marginBottom: -spacing.exact(24),
        gap: spacing.exact(12),
        backgroundColor: feedbackBackgroundColor,
      },
      feedbackHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      feedbackTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: feedbackTitleColor,
      },
      feedbackBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      explainRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingVertical: spacing.exact(8),
      },
      explainText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: accents.blue.ink,
      },
      aiBadge: {
        width: spacing.exact(24),
        height: spacing.exact(24),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        alignItems: "center",
        justifyContent: "center",
      },
      primaryButton: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
      },
      primaryButtonText: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      pressed: {
        opacity: 0.9,
      },
      reportButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      reportText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textSecondary,
      },
      resultContainer: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
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
        width: spacing.exact(96),
        height: spacing.exact(96),
        borderRadius: radius.pill,
        backgroundColor: colors.paper,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.exact(24),
      },
      resultTitle: {
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(36),
        fontWeight: "700",
        letterSpacing: -0.64,
        textAlign: "center",
        color: colors.textPrimary,
        marginBottom: spacing.exact(16),
      },
      resultPercent: {
        fontSize: responsiveFont(52),
        lineHeight: responsiveFont(54),
        fontWeight: "700",
        letterSpacing: -0.52,
        textAlign: "center",
        marginBottom: spacing.exact(12),
        color: resultPercentColor,
      },
      resultCount: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(16),
      },
      resultBody: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(24),
      },
      nextCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(16),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        alignSelf: "stretch",
      },
      nextIconBox: {
        padding: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: colors.paper,
      },
      nextCardText: {
        flex: 1,
      },
      nextTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      nextSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
    })
  );
}
