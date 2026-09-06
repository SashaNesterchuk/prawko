import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { isMobileSupabaseConfigured } from "../../../config/env";
import { Icon } from "../../../components/icons";
import { AppButton } from "../../../components/shell/AppButton";
import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import { ResultTopicProgressRow } from "../../../components/shell/ResultTopicProgressRow";
import { CText, getFontFamily, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";
import { ANALYTICS_EVENTS, getAnalyticsErrorCode } from "../../../analytics/catalog";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { useAdInterstitialActions } from "../../ads/show-interstitial";
import {
  enableStudyNotificationsAsync,
} from "../../notifications/runtime";
import { useAppShellStore } from "../../../state/app-shell";
import { useQuestionProgressStore } from "../../../state/question-progress";
import { ExamAnswersReviewView } from "../../exam/ExamAnswersReviewView";
import type {
  RemoteExamAnswer,
  RemoteExamQuestionRef,
} from "../../exam/types";
import { getQuestionById, getQuestionUserState } from "../question-engine";
import { syncQuestionBookmarkState } from "../supabase-question-state";
import { getQuestionTopicTitle } from "../../question-topics/catalog";
import { buildTrainingQuestionChips } from "../training/training-result-stats";
import type { TrainingResultQuestionChip } from "../training/training-result-stats";
import type { QuestionTrainingSession } from "../training/useQuestionTrainingSession";

import { DiagnosticReminderPrompt } from "./DiagnosticReminderPrompt";
import { formatDiagnosticExamDate } from "./format-exam-date";
import {
  consumeDiagnosticReminderPrompt,
  hasConsumedDiagnosticReminderPrompt,
} from "./reminder-prompt";
import {
  buildDiagnosticTopicStats,
  getDiagnosticStrongArea,
  getDiagnosticSummaryBand,
  getDiagnosticWeakAreas,
} from "./result-stats";

const TOP_FADE_RAMP = 16;

export function InitialDiagnosticResultView({
  activeSession,
  onClose,
  onWorkOnMistakes,
  summary,
}: Pick<
  QuestionTrainingSession,
  "activeSession" | "summary"
> & {
  onClose: () => void;
  onWorkOnMistakes: () => void;
}) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { colors, background } = useTheme();
  const { showInterstitialForTrigger } = useAdInterstitialActions();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const examDate = useAppShellStore((state) => state.studyPlanSetup.examDate);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const toggleBookmark = useQuestionProgressStore(
    (state) => state.toggleBookmark
  );
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderPresentKey, setReminderPresentKey] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const followupStartedRef = useRef(false);
  const styles = useStyles();
  const scrollY = useSharedValue(0);
  const handleScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, TOP_FADE_RAMP],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const questionChips = activeSession
    ? buildTrainingQuestionChips(activeSession, questionUserState)
    : [];
  const topicStats = activeSession
    ? buildDiagnosticTopicStats(activeSession)
    : [];
  const weakAreas = getDiagnosticWeakAreas(topicStats);
  const strongArea = getDiagnosticStrongArea(topicStats);
  const summaryBand = getDiagnosticSummaryBand(summary.correct, summary.total);
  const examDateLabel = formatDiagnosticExamDate(examDate, preferredLocale);
  const reviewQuestionIds = activeSession?.questionIds ?? [];
  const reviewQuestionId =
    reviewIndex !== null ? reviewQuestionIds[reviewIndex] ?? null : null;

  async function finishFollowup() {
    if (followupStartedRef.current) {
      return;
    }

    followupStartedRef.current = true;
    setIsFinishing(true);
    consumeDiagnosticReminderPrompt();
    setReminderVisible(false);

    try {
      await showInterstitialForTrigger("after_practice_session_complete", {
        practiceAnsweredCount: summary.answered,
        waitForLoad: false,
      });
    } catch (error) {
      console.warn("Diagnostic follow-up interstitial failed.", error);
    }

    onClose();
  }

  async function handleEnableReminders() {
    track(ANALYTICS_EVENTS.notificationPermissionRequested.key, {
      source: "initial_diagnostic",
    });

    try {
      const result = await enableStudyNotificationsAsync();
      track(ANALYTICS_EVENTS.notificationPermissionResolved.key, {
        can_ask_again: result.ok ? null : result.canAskAgain,
        enabled: result.ok,
        source: "initial_diagnostic",
      });
    } catch (error) {
      console.warn("Failed to enable study notifications.", error);
      track(ANALYTICS_EVENTS.notificationPermissionResolved.key, {
        enabled: false,
        error_code: getAnalyticsErrorCode(error),
        source: "initial_diagnostic",
      });
    }

    await finishFollowup();
  }

  function handleContinue() {
    track(ANALYTICS_EVENTS.diagnosticResultAction.key, {
      action: "continue",
    });

    if (hasConsumedDiagnosticReminderPrompt()) {
      void finishFollowup();
      return;
    }

    setReminderVisible(true);
    setReminderPresentKey((current) => current + 1);
  }

  if (reviewIndex !== null && reviewQuestionId && activeSession) {
    const question = getQuestionById(reviewQuestionId);
    const answer = activeSession.answers[reviewQuestionId] ?? null;
    const questionRef: RemoteExamQuestionRef = {
      order: reviewIndex + 1,
      points: question?.points ?? 1,
      questionId: reviewQuestionId,
      questionSourceId: reviewQuestionId,
      scope: question?.scope ?? "base",
    };
    const reviewAnswer: RemoteExamAnswer | null = answer
      ? {
          answerGiven: answer.selectedAnswer,
          answeredAt: answer.answeredAt,
          isCorrect: answer.isCorrect,
          order: reviewIndex + 1,
          pointsAwarded: answer.isCorrect ? questionRef.points : 0,
          questionAttemptId: null,
          questionId: reviewQuestionId,
          questionSourceId: reviewQuestionId,
        }
      : null;

    return (
      <ExamAnswersReviewView
        answer={reviewAnswer}
        canGoNext
        canGoPrevious={reviewIndex > 0}
        currentIndex={reviewIndex}
        displayLocale={preferredLocale}
        isBookmarked={
          getQuestionUserState(questionUserState, reviewQuestionId).isBookmarked
        }
        onBack={() => setReviewIndex(null)}
        onNext={() =>
          setReviewIndex((current) => {
            if (current === null) {
              return null;
            }

            if (current >= reviewQuestionIds.length - 1) {
              return null;
            }

            return current + 1;
          })
        }
        onPrevious={() =>
          setReviewIndex((current) =>
            current === null ? null : Math.max(current - 1, 0)
          )
        }
        onToggleBookmark={() => {
          const isBookmarked = toggleBookmark(reviewQuestionId);
          if (authMode === "supabase" && isMobileSupabaseConfigured) {
            void syncQuestionBookmarkState({
              questionSourceId: reviewQuestionId,
              isBookmarked,
              savedFromMode: activeSession.request.mode,
              metadata: {
                source: "mobile_diagnostic_answers_review",
                session_id: activeSession.id,
              },
            }).catch((error) => {
              console.warn(
                `Failed to sync bookmark state for ${reviewQuestionId}.`,
                error
              );
            });
          }
        }}
        questionRef={questionRef}
        title={t("question.answersReviewTitle")}
        testID="screen-question-answers-review"
        totalQuestions={reviewQuestionIds.length}
      />
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        testID="screen-question-result"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="close"
            accessibilityLabel={t("common.close")}
            onPress={() => {
              track(ANALYTICS_EVENTS.diagnosticResultAction.key, {
                action: "close",
              });
              onClose();
            }}
          />
        </View>

        <View style={styles.scrollArea}>
          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero} testID="screen-diagnostic-result">
              <CText style={styles.title}>
                {t("diagnostic.startingPointTitle")}
              </CText>
              <CText style={styles.scoreLine}>
                {t("diagnostic.correctOfTotal", {
                  correct: summary.correct,
                  total: summary.total,
                })}
              </CText>
              <CText style={styles.percentLine}>
                {t("diagnostic.percentCorrect", {
                  percent: Math.round(
                    (summary.correct / Math.max(summary.total, 1)) * 100
                  ),
                })}
              </CText>
              {summaryBand !== "mid" ? (
                <CText style={styles.summaryBody}>
                  {summaryBand === "low"
                    ? t("diagnostic.summaryLow")
                    : t("diagnostic.summaryHigh")}
                </CText>
              ) : null}
            </View>

            {weakAreas.length > 0 ? (
              <View style={styles.card} testID="diagnostic-focus-areas">
                <CText style={styles.cardTitle}>
                  {t("diagnostic.focusAreasTitle")}
                </CText>
                {weakAreas.map((stat) => (
                  <View key={stat.topicId} style={styles.focusRow}>
                    <CText style={styles.focusTitle}>
                      {getQuestionTopicTitle(stat.topicId, preferredLocale)}
                    </CText>
                    <CText style={styles.focusHint}>
                      {t("diagnostic.focusAreaHint")}
                    </CText>
                  </View>
                ))}
                <CText style={styles.personalizeBody}>
                  {t("diagnostic.personalizeBody")}
                </CText>
              </View>
            ) : null}

            {strongArea ? (
              <View style={styles.card} testID="diagnostic-strongest-area">
                <CText style={styles.cardTitle}>
                  {t("diagnostic.strongestTitle")}
                </CText>
                <CText style={styles.focusTitle}>
                  {getQuestionTopicTitle(strongArea.topicId, preferredLocale)}
                </CText>
              </View>
            ) : null}

            {questionChips.length > 0 ? (
              <View style={[styles.card, styles.questionsCard]}>
                <CText style={styles.questionsTitle}>
                  {t("question.questionsCardTitle")}
                </CText>
                <View style={styles.chipGrid}>
                  {questionChips.map((question) => (
                    <DiagnosticResultChip
                      key={question.questionSourceId}
                      question={question}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {topicStats.length > 0 ? (
              <View style={styles.card} testID="question-result-topics">
                {topicStats.map((stat) => (
                  <ResultTopicProgressRow
                    key={stat.topicId}
                    percent={stat.percent}
                    title={getQuestionTopicTitle(stat.topicId, preferredLocale)}
                  />
                ))}
              </View>
            ) : null}
          </Animated.ScrollView>

          <Animated.View
            pointerEvents="none"
            style={[styles.topFade, topFadeStyle]}
          >
            <LinearGradient
              colors={[background.start, background.transparent]}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={styles.footerWrap}>
          <LinearGradient
            colors={[background.transparent, background.end]}
            end={{ x: 0.5, y: 1 }}
            locations={[0, 0.4]}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            style={styles.footerFade}
          />
          <View style={styles.footer}>
            <AppButton
              disabled={isFinishing}
              label={t("diagnostic.continueCta")}
              onPress={handleContinue}
              testID="question-result-primary"
            />

            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (reviewQuestionIds.length === 0) {
                    return;
                  }

                  track(ANALYTICS_EVENTS.diagnosticResultAction.key, {
                    action: "answers",
                  });
                  setReviewIndex(0);
                }}
                testID="question-result-answers"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="checkmark" size={20} color={colors.ink2} />
                <CText style={styles.secondaryButtonText}>
                  {t("question.answersCta")}
                </CText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  track(ANALYTICS_EVENTS.diagnosticResultAction.key, {
                    action: "mistakes",
                  });
                  onWorkOnMistakes();
                }}
                testID="diagnostic-result-mistakes"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="replay" size={20} color={colors.ink2} />
                <CText style={styles.secondaryButtonText}>
                  {t("diagnostic.workOnMistakesCta")}
                </CText>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
      <DiagnosticReminderPrompt
        examDateLabel={examDateLabel}
        key={reminderPresentKey}
        onEnable={() => {
          void handleEnableReminders();
        }}
        onLater={() => {
          void finishFollowup();
        }}
        visible={reminderVisible}
      />
    </GreenWaveScreen>
  );
}

function DiagnosticResultChip({
  question,
}: {
  question: TrainingResultQuestionChip;
}) {
  const { accents, colors } = useTheme();
  const styles = useStyles();
  const palette =
    question.status === "correct"
      ? {
          backgroundColor: accents.green.soft,
          color: accents.green.ink,
        }
      : question.status === "wrong"
        ? {
            backgroundColor: accents.red.soft,
            color: accents.red.ink,
          }
        : {
            backgroundColor: colors.surface2,
            color: colors.ink3,
          };

  return (
    <View style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
      <CText style={[styles.chipText, { color: palette.color }]}>
        {question.number}
      </CText>
      {question.isBookmarked ? (
        <View style={styles.bookmarkFlag}>
          <Icon name="stateActive" size={12} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      header: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(8),
      },
      scrollArea: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(160),
        gap: spacing.exact(8),
      },
      topFade: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: spacing.exact(48),
      },
      hero: {
        alignItems: "center",
        gap: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      title: {
        fontSize: responsiveFont(28),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        textAlign: "center",
        color: colors.ink,
      },
      scoreLine: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        textAlign: "center",
        color: colors.ink,
      },
      percentLine: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.ink3,
      },
      summaryBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.ink2,
        paddingHorizontal: spacing.exact(12),
      },
      card: {
        borderRadius: radius.xxl,
        backgroundColor: colors.surface,
        padding: spacing.exact(16),
        gap: spacing.exact(12),
      },
      cardTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("semiBold"),
        color: colors.ink,
      },
      focusRow: {
        gap: spacing.exact(2),
      },
      focusTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        color: colors.ink,
      },
      focusHint: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink3,
      },
      personalizeBody: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink3,
      },
      questionsCard: {
        gap: spacing.exact(8),
      },
      questionsTitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      chipGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.exact(4),
      },
      chip: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
      },
      chipText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
      },
      bookmarkFlag: {
        position: "absolute",
        top: -spacing.exact(2),
        right: -spacing.exact(2),
        width: spacing.exact(16),
        height: spacing.exact(16),
        borderRadius: radius.lg,
        backgroundColor: accents.amber.fill,
        alignItems: "center",
        justifyContent: "center",
      },
      footerWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
      },
      footerFade: {
        position: "absolute",
        left: 0,
        right: 0,
        top: -spacing.exact(24),
        height: spacing.exact(24),
      },
      footer: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
        gap: spacing.exact(8),
        backgroundColor: colors.background,
      },
      secondaryRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: spacing.exact(48),
      },
      secondaryButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      secondaryButtonText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      pressed: {
        opacity: 0.7,
      },
    })
  );
}
