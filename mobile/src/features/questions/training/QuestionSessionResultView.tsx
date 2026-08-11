import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import { CText, getFontFamily, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";
import { useAppShellStore } from "../../../state/app-shell";
import { useQuestionProgressStore } from "../../../state/question-progress";
import type { AppThemeAccent } from "../../../theme";
import { ExamAnswersReviewView } from "../../exam/ExamAnswersReviewView";
import type {
  RemoteExamAnswer,
  RemoteExamQuestionRef,
} from "../../exam/types";
import { getQuestionById, getQuestionUserState } from "../question-engine";
import { buildQuestionRouteParams } from "../question-routes";
import { syncQuestionBookmarkState } from "../supabase-question-state";
import { getQuestionTopicTitle } from "../../question-topics/catalog";

import {
  buildTrainingQuestionChips,
  buildTrainingTopicStats,
  createTrainingResultScoreKey,
  getProgressBarAccent,
  getTrainingResultOutcome,
  getTrainingScoreDelta,
  getWeakestTrainingTopic,
  type TrainingResultQuestionChip,
  type TrainingResultTopicStat,
  type TrainingScoreDelta,
} from "./training-result-stats";
import type { QuestionTrainingSession } from "./useQuestionTrainingSession";

/** How far the content has to scroll before the top fade is at full strength. */
const TOP_FADE_RAMP = 16;

export function QuestionSessionResultView({
  activeSession,
  onClose,
  sessionMode,
  sessionResultPercent,
  summary,
}: Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "sessionMode"
  | "sessionResultPercent"
  | "summary"
> & {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { accents, background, colors } = useTheme();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const lastTrainingSessionPercents = useQuestionProgressStore(
    (state) => state.lastTrainingSessionPercents
  );
  const recordTrainingSessionPercent = useQuestionProgressStore(
    (state) => state.recordTrainingSessionPercent
  );
  const toggleBookmark = useQuestionProgressStore(
    (state) => state.toggleBookmark
  );
  const clearActiveSession = useQuestionProgressStore(
    (state) => state.clearActiveSession
  );

  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const didRecordPercentRef = useRef(false);

  const outcome = getTrainingResultOutcome(sessionResultPercent);
  const resultAccent =
    outcome === "good"
      ? accents.green
      : outcome === "medium"
        ? accents.amber
        : accents.red;
  const styles = useStyles({
    scoreColor: resultAccent.fill,
    statusBadgeColor: resultAccent.fill,
  });

  const scoreKey = createTrainingResultScoreKey({
    mode: activeSession?.request.mode ?? sessionMode,
    topic: activeSession?.request.topic,
  });

  // Capture delta against the previous stored percent before we overwrite it.
  const scoreDeltaRef = useRef<TrainingScoreDelta | null | undefined>(
    undefined
  );
  if (scoreDeltaRef.current === undefined) {
    scoreDeltaRef.current = getTrainingScoreDelta(
      sessionResultPercent,
      lastTrainingSessionPercents[scoreKey]
    );
  }
  const scoreDelta = scoreDeltaRef.current;

  useEffect(() => {
    if (didRecordPercentRef.current) {
      return;
    }

    didRecordPercentRef.current = true;
    recordTrainingSessionPercent({
      key: scoreKey,
      percent: sessionResultPercent,
    });
  }, [recordTrainingSessionPercent, scoreKey, sessionResultPercent]);

  const questionChips = useMemo(
    () =>
      activeSession
        ? buildTrainingQuestionChips(activeSession, questionUserState)
        : [],
    [activeSession, questionUserState]
  );
  const topicStats = useMemo(
    () => (activeSession ? buildTrainingTopicStats(activeSession) : []),
    [activeSession]
  );
  const weakestTopic = getWeakestTrainingTopic(topicStats);
  const weakestTopicLabel = weakestTopic
    ? getQuestionTopicTitle(weakestTopic, preferredLocale)
    : null;

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

  const isPositiveResult = outcome === "good";
  const statusIconName =
    outcome === "good" ? "check" : outcome === "medium" ? "alert" : "close";

  const primaryLabel = isPositiveResult
    ? t("question.resultFinishCta")
    : t("question.workOnMistakesCta");

  const whatsNextBody = isPositiveResult
    ? t("question.whatsNextGoodBody")
    : weakestTopicLabel
      ? t("question.whatsNextNeedsWorkBody", { topic: weakestTopicLabel })
      : t("question.whatsNextNeedsWorkBodyGeneric");

  const reviewQuestionIds = activeSession?.questionIds ?? [];
  const reviewQuestionId =
    reviewIndex !== null ? reviewQuestionIds[reviewIndex] ?? null : null;

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
        canGoNext={reviewIndex < reviewQuestionIds.length - 1}
        canGoPrevious={reviewIndex > 0}
        currentIndex={reviewIndex}
        displayLocale={preferredLocale}
        isBookmarked={
          getQuestionUserState(questionUserState, reviewQuestionId).isBookmarked
        }
        onBack={() => setReviewIndex(null)}
        onNext={() =>
          setReviewIndex((current) =>
            current === null
              ? null
              : Math.min(current + 1, reviewQuestionIds.length - 1)
          )
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
                source: "mobile_training_answers_review",
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

  function handlePrimaryAction() {
    if (isPositiveResult) {
      onClose();
      return;
    }

    clearActiveSession();
    router.replace("/mistakes");
  }

  function handleNewAttempt() {
    clearActiveSession();
    router.replace({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: activeSession?.request.mode ?? sessionMode,
        questionLimit: activeSession?.request.questionLimit,
        studyPlanTaskId: activeSession?.request.studyPlanTaskId,
        topic: activeSession?.request.topic,
      }),
    });
  }

  function handleReviewAnswers() {
    if (reviewQuestionIds.length === 0) {
      return;
    }

    setReviewIndex(0);
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
            onPress={onClose}
          />
        </View>

        <View style={styles.scrollArea}>
          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.statusBadge}>
                <Icon name={statusIconName} size={40} color={colors.white} />
              </View>

              <CText style={styles.score}>{sessionResultPercent}%</CText>

              {scoreDelta ? (
                <View
                  style={[
                    styles.deltaBadge,
                    scoreDelta.percentPoints > 0
                      ? styles.deltaBadgePositive
                      : styles.deltaBadgeNegative,
                  ]}
                >
                  <CText
                    style={[
                      styles.deltaBadgeText,
                      scoreDelta.percentPoints > 0
                        ? styles.deltaBadgeTextPositive
                        : styles.deltaBadgeTextNegative,
                    ]}
                  >
                    {scoreDelta.percentPoints > 0
                      ? t("question.deltaBetter", {
                          percent: Math.abs(scoreDelta.percentPoints),
                        })
                      : t("question.deltaWorse", {
                          percent: Math.abs(scoreDelta.percentPoints),
                        })}
                  </CText>
                </View>
              ) : null}

              <CText style={styles.statLine}>
                {t("question.correctAnswersLine", {
                  correct: summary.correct,
                  total: summary.total,
                })}
              </CText>
            </View>

            {questionChips.length > 0 ? (
              <View style={styles.card}>
                <CText style={styles.questionsTitle}>
                  {t("question.questionsCardTitle")}
                </CText>
                <View style={styles.chipGrid}>
                  {questionChips.map((question) => (
                    <QuestionResultChip
                      key={question.questionSourceId}
                      question={question}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {topicStats.length > 0 ? (
              <View style={styles.card}>
                {topicStats.map((stat) => (
                  <TopicProgressRow key={stat.topicId} stat={stat} />
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <CText style={styles.whatsNextTitle}>
                {t("question.whatsNextTitle")}
              </CText>
              <CText style={styles.whatsNextBody}>{whatsNextBody}</CText>
            </View>
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
            <Pressable
              accessibilityRole="button"
              onPress={handlePrimaryAction}
              testID="question-result-primary"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CText style={styles.primaryButtonText}>{primaryLabel}</CText>
            </Pressable>

            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleReviewAnswers}
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
                onPress={handleNewAttempt}
                testID="question-result-new-attempt"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="replay" size={20} color={colors.ink2} />
                <CText style={styles.secondaryButtonText}>
                  {t("question.newAttemptCta")}
                </CText>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function TopicProgressRow({
  stat,
}: {
  stat: TrainingResultTopicStat;
}) {
  const { accents, colors } = useTheme();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const styles = useStyles();
  const accentKey = getProgressBarAccent(stat.percent);
  const fillColor = accents[accentKey as AppThemeAccent].fill;

  return (
    <View style={styles.topicRow}>
      <CText style={styles.topicLabel} numberOfLines={1}>
        {getQuestionTopicTitle(stat.topicId, preferredLocale)}
      </CText>
      <View style={styles.topicMeter}>
        <View style={styles.topicTrack}>
          <View
            style={[
              styles.topicFill,
              {
                width: `${Math.max(0, Math.min(100, stat.percent))}%`,
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>
        <CText style={styles.topicPercent}>{stat.percent}%</CText>
      </View>
    </View>
  );
}

function QuestionResultChip({
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

function useStyles({
  scoreColor,
  statusBadgeColor,
}: {
  scoreColor?: string;
  statusBadgeColor?: string;
} = {}) {
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
      statusBadge: {
        width: spacing.exact(80),
        height: spacing.exact(80),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: statusBadgeColor ?? accents.green.fill,
        marginBottom: spacing.exact(8),
      },
      score: {
        fontSize: responsiveFont(40),
        lineHeight: responsiveFont(40),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -0.8,
        textAlign: "center",
        color: scoreColor ?? accents.green.fill,
      },
      deltaBadge: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(8),
        paddingVertical: spacing.exact(4),
      },
      deltaBadgePositive: {
        backgroundColor: accents.green.soft,
      },
      deltaBadgeNegative: {
        backgroundColor: accents.red.soft,
      },
      deltaBadgeText: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
      },
      deltaBadgeTextPositive: {
        color: accents.green.ink,
      },
      deltaBadgeTextNegative: {
        color: accents.red.ink,
      },
      statLine: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.ink,
      },
      card: {
        borderRadius: radius.xxl,
        backgroundColor: colors.surface,
        padding: spacing.exact(16),
        gap: spacing.exact(12),
      },
      questionsTitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      topicRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      topicLabel: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      topicMeter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      topicTrack: {
        flex: 1,
        height: spacing.exact(4),
        borderRadius: radius.pill,
        backgroundColor: colors.surface2,
        overflow: "hidden",
      },
      topicFill: {
        height: "100%",
        borderRadius: radius.pill,
      },
      topicPercent: {
        width: spacing.exact(40),
        textAlign: "right",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
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
      whatsNextTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.16,
        color: colors.ink,
      },
      whatsNextBody: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink3,
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
      primaryButton: {
        height: spacing.exact(52),
        borderRadius: radius.xxl,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
      },
      primaryButtonText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        color: colors.white,
      },
      secondaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.exact(8),
        minHeight: spacing.exact(48),
      },
      secondaryButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingVertical: spacing.exact(12),
      },
      secondaryButtonText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
        color: colors.ink2,
      },
      pressed: {
        opacity: 0.85,
      },
    })
  );
}

export type { TrainingScoreDelta };
