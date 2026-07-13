import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { ProgressRing } from "../../src/components/shell/ProgressRing";
import { StatisticsActivityCard } from "../../src/components/shell/StatisticsActivityCard";
import { StatisticsTopicProgressRow } from "../../src/components/shell/StatisticsTopicProgressRow";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import type { RemoteExamSession } from "../../src/features/exam/types";
import {
  buildWeekActivity,
  getLearningDaysCount,
  getProfileStatMetrics,
} from "../../src/features/profile/profile-stats";
import {
  ROAD_SIGN_CATEGORIES,
  getRoadSignsByCategory,
} from "../../src/features/road-signs/catalog";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import {
  getQuestionDisplayStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { getDaysUntilExamFromDate } from "../../src/features/study-plan/generate-local-study-plan";
import {
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import {
  useAppShellStore,
  useCurrentStudyPlan,
} from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

type StatisticsTab = "exam" | "signs";

function resolveReadinessLevel(readiness: number) {
  if (readiness >= 85) {
    return "high" as const;
  }

  if (readiness >= 40) {
    return "mid" as const;
  }

  return "low" as const;
}

function resolveRingColor(
  readiness: number,
  accents: ReturnType<typeof useTheme>["accents"]
) {
  const level = resolveReadinessLevel(readiness);

  if (level === "high") {
    return accents.green.fill;
  }

  if (level === "mid") {
    return accents.amber.fill;
  }

  return accents.red.fill;
}

function getBestExamScore(sessions: RemoteExamSession[]) {
  if (sessions.length === 0) {
    return null;
  }

  return sessions.reduce((best, session) =>
    session.scorePoints > best.scorePoints ? session : best
  );
}

function getBestSessionAccuracy(
  attempts: ReturnType<typeof useQuestionProgressStore.getState>["attempts"]
) {
  const bySession = new Map<
    string,
    { correct: number; total: number }
  >();

  for (const attempt of attempts) {
    const current = bySession.get(attempt.sessionId) ?? {
      correct: 0,
      total: 0,
    };
    current.total += 1;

    if (attempt.isCorrect) {
      current.correct += 1;
    }

    bySession.set(attempt.sessionId, current);
  }

  let best = 0;

  for (const session of bySession.values()) {
    if (session.total === 0) {
      continue;
    }

    best = Math.max(best, Math.round((session.correct / session.total) * 100));
  }

  return best;
}

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const spacing = useResponsiveSpacing();
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const currentStudyPlan = useCurrentStudyPlan();
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [activeTab, setActiveTab] = useState<StatisticsTab>("exam");
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);
  const [examSessions, setExamSessions] = useState<RemoteExamSession[]>([]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setReadinessSummary(null);
      setExamSessions([]);
      return;
    }

    let cancelled = false;

    void fetchRemoteHomeProgress(getWarsawIsoDate())
      .then(({ readinessSummary: summary }) => {
        if (!cancelled) {
          setReadinessSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadinessSummary(null);
        }
      });

    void fetchRecentExamSessions(100)
      .then((sessions) => {
        if (!cancelled) {
          setExamSessions(sessions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExamSessions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, isFocused]);

  const stats = useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const topicRows = useMemo(
    () =>
      getQuestionTopicIds()
        .map((topicId) => {
          const progress = getTopicProgress(topicId, questionUserState);

          return {
            topicId,
            title: getQuestionTopicTitle(topicId, preferredLocale),
            seen: progress.seen,
            total: progress.total,
            progress: progress.progress,
          };
        })
        .filter((topic) => topic.total > 0),
    [preferredLocale, questionUserState, questionCatalogVersion]
  );

  const signsTopic = useMemo(
    () => getTopicProgress("signs", questionUserState),
    [questionUserState, questionCatalogVersion]
  );

  const signCategoryRows = useMemo(
    () =>
      ROAD_SIGN_CATEGORIES.map((category) => ({
        category,
        count: getRoadSignsByCategory(category.id).length,
      })),
    []
  );

  const localReadiness =
    stats.total > 0 ? Math.round((stats.seen / stats.total) * 100) : 0;
  const examReadiness = Math.round(
    readinessSummary?.readinessScore ?? localReadiness
  );
  const signsReadiness = signsTopic.progress;
  const readiness = activeTab === "exam" ? examReadiness : signsReadiness;
  const readinessLevel = resolveReadinessLevel(readiness);
  const ringColor = resolveRingColor(readiness, accents);
  const styles = useStyles({ ringColor, safeBottom });
  const backIconSize = responsiveFont(22);
  const smallIconSize = responsiveFont(16);
  const ringSize = spacing.exact(160);
  const ringStroke = spacing.exact(10);

  const metrics = useMemo(
    () => getProfileStatMetrics(attempts, examSessions.length),
    [attempts, examSessions.length]
  );
  const learningDays = useMemo(
    () => getLearningDaysCount(attempts),
    [attempts]
  );
  const weekDays = useMemo(
    () => buildWeekActivity(attempts, preferredLocale),
    [attempts, preferredLocale]
  );

  const daysUntilExam = currentStudyPlan?.examDate
    ? getDaysUntilExamFromDate(currentStudyPlan.examDate)
    : readinessSummary?.daysUntilExam ?? null;

  const weakTopics = useMemo(
    () =>
      [...topicRows]
        .filter((topic) => topic.seen > 0)
        .sort((left, right) => left.progress - right.progress)
        .slice(0, 3),
    [topicRows]
  );

  const bestExam = getBestExamScore(examSessions);
  const bestTrainingAccuracy = getBestSessionAccuracy(attempts);
  const mistakesFixedPercent =
    stats.wrongAnswers + stats.seen > 0
      ? Math.round(
          ((stats.seen - stats.wrongAnswers) / Math.max(stats.seen, 1)) * 100
        )
      : 100;

  const openTopicTraining = (
    topicId: ReturnType<typeof getQuestionTopicIds>[number]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: "learning",
        topic: topicId,
      }),
    });

  const openMistakes = () => router.push("/mistakes");
  const openReview = () =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode: "seen_not_mastered" }),
    });

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back", { defaultValue: "Назад" })}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Ionicons
              color={colors.textPrimary}
              name="chevron-back"
              size={backIconSize}
            />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t("statistics.title", { defaultValue: "Статистика" })}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.segment}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("exam")}
              style={[
                styles.segmentItem,
                activeTab === "exam" ? styles.segmentItemActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  activeTab === "exam" ? styles.segmentLabelActive : null,
                ]}
              >
                {t("statistics.tabExam", { defaultValue: "Іспит" })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("signs")}
              style={[
                styles.segmentItem,
                activeTab === "signs" ? styles.segmentItemActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  activeTab === "signs" ? styles.segmentLabelActive : null,
                ]}
              >
                {t("statistics.tabSigns", { defaultValue: "Знаки" })}
              </Text>
            </Pressable>
          </View>

          <View style={styles.overviewRow}>
            <ProgressRing
              progress={readiness}
              size={ringSize}
              stroke={ringStroke}
              color={ringColor}
            >
              <Text style={styles.ringValue}>
                {`${readiness}%`}
              </Text>
            </ProgressRing>

            <View style={styles.overviewCopy}>
              <View style={styles.overviewBlock}>
                <Text style={styles.levelTitle}>
                  {t(`statistics.level.${readinessLevel}`, {
                    defaultValue:
                      readinessLevel === "high"
                        ? "Високий"
                        : readinessLevel === "mid"
                          ? "Середній"
                          : "Низький",
                  })}
                </Text>
                <Text style={styles.levelSubtitle}>
                  {t("statistics.readinessIndex", {
                    defaultValue: "Індекс готовності",
                  })}
                </Text>
              </View>

              {daysUntilExam != null ? (
                <View style={styles.overviewBlock}>
                  <Text style={styles.daysValue}>{daysUntilExam}</Text>
                  <Text style={styles.levelSubtitle}>
                    {t("statistics.daysUntilExam", {
                      defaultValue: "Днів до іспиту",
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <StatisticsActivityCard
            learningDays={learningDays}
            sessions={metrics.sessions}
            streak={metrics.streak}
            weekDays={weekDays}
            labels={{
              learningDays: t("statistics.learningDays", {
                defaultValue: "Дні навчання",
              }),
              sessions: t("statistics.sessions", {
                defaultValue: "Сесій",
              }),
              streak: t("statistics.streak", {
                defaultValue: "Стрік",
              }),
            }}
          />

          {activeTab === "exam" ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {t("statistics.topicsTitle", {
                      defaultValue: "Готовність за темами",
                    })}
                  </Text>
                  <View style={styles.infoButton}>
                    <Ionicons
                      color={colors.textSecondary}
                      name="information-circle-outline"
                      size={smallIconSize}
                    />
                  </View>
                </View>

                <View style={styles.topicList}>
                  {topicRows.map((topic) => (
                    <Pressable
                      key={topic.topicId}
                      accessibilityRole="button"
                      onPress={() => openTopicTraining(topic.topicId)}
                      style={({ pressed }) => [
                        styles.topicPressable,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <StatisticsTopicProgressRow
                        title={topic.title}
                        seen={topic.seen}
                        total={topic.total}
                        progress={topic.progress}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <StatisticsQueueRow
                  styles={styles}
                  title={t("statistics.smartReviewTitle", {
                    defaultValue: "Розумні повторення",
                  })}
                  subtitle={t("statistics.smartReviewSubtitle", {
                    defaultValue: "Питання готові до повторення",
                  })}
                  count={stats.reviewDue}
                  accent="blue"
                  premium
                  onPress={openReview}
                />
                <View style={styles.divider} />
                <StatisticsQueueRow
                  styles={styles}
                  title={t("statistics.mistakesTitle", {
                    defaultValue: "Питання з помилками",
                  })}
                  subtitle={t("statistics.mistakesSubtitle", {
                    defaultValue: "Виправ минулі помилки",
                  })}
                  count={stats.wrongAnswers}
                  accent="red"
                  onPress={openMistakes}
                />
                {weakTopics.length > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.weakSection}>
                      <Text style={styles.weakTitle}>
                        {t("statistics.weakTopicsTitle", {
                          defaultValue: "Потребують тренування",
                        })}
                      </Text>
                      <Text style={styles.weakSubtitle}>
                        {t("statistics.weakTopicsSubtitle", {
                          defaultValue: "Найслабші теми",
                        })}
                      </Text>
                      <View style={styles.chipRow}>
                        {weakTopics.map((topic) => (
                          <Pressable
                            key={topic.topicId}
                            accessibilityRole="button"
                            onPress={() => openTopicTraining(topic.topicId)}
                            style={({ pressed }) => [
                              styles.chip,
                              pressed ? styles.pressed : null,
                            ]}
                          >
                            <Text style={styles.chipLabel}>{topic.title}</Text>
                            <Ionicons
                              color={colors.textSecondary}
                              name="chevron-forward"
                              size={smallIconSize}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.card}>
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.totalExams", {
                    defaultValue: "Всього іспитів",
                  })}
                  value={String(examSessions.length)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.bestExam", {
                    defaultValue: "Кращий іспит",
                  })}
                  value={
                    bestExam
                      ? t("statistics.bestExamValue", {
                          defaultValue: "{{score}} / {{total}} балів",
                          score: bestExam.scorePoints,
                          total: bestExam.totalPointsTarget,
                        })
                      : "—"
                  }
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.totalTrainings", {
                    defaultValue: "Всього тренувань",
                  })}
                  value={String(metrics.sessions)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.bestTraining", {
                    defaultValue: "Краще тренування",
                  })}
                  value={
                    bestTrainingAccuracy > 0 ? `${bestTrainingAccuracy}%` : "—"
                  }
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.questionsCovered", {
                    defaultValue: "Охоплено питань",
                  })}
                  value={`${stats.seen} / ${stats.total}`}
                  badge={`${localReadiness}%`}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.mistakesFixed", {
                    defaultValue: "Виправлено помилок",
                  })}
                  value={`${Math.max(0, stats.seen - stats.wrongAnswers)}/${stats.seen}`}
                  badge={`${mistakesFixedPercent}%`}
                />
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {t("statistics.signCategoriesTitle", {
                    defaultValue: "Категорії знаків",
                  })}
                </Text>
              </View>

              <View style={styles.topicList}>
                {signCategoryRows.map(({ category, count }) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/signs/category/[categoryId]",
                        params: { categoryId: category.id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.topicPressable,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <StatisticsTopicProgressRow
                      title={category.titlePl}
                      seen={Math.min(signsTopic.seen, count)}
                      total={count}
                      progress={
                        count > 0
                          ? Math.round(
                              (Math.min(signsTopic.seen, count) / count) * 100
                            )
                          : 0
                      }
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function StatisticsQueueRow({
  styles,
  title,
  subtitle,
  count,
  accent,
  premium = false,
  onPress,
}: {
  styles: ReturnType<typeof useStyles>;
  title: string;
  subtitle: string;
  count: number;
  accent: "blue" | "red";
  premium?: boolean;
  onPress?: () => void;
}) {
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const accentColors = accent === "blue" ? accents.blue : accents.red;
  const { colors } = useTheme();
  const rowStyles = useQueueRowStyles({
    countBackgroundColor: accentColors.soft,
    countTextColor: accentColors.ink,
  });
  const premiumIconSize = responsiveFont(10);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.queueCopy}>
        <View style={styles.queueTitleRow}>
          <Text style={styles.queueTitle}>{title}</Text>
          {premium ? (
            <View style={styles.premiumBadge}>
              <Ionicons color={colors.onAccent} name="star" size={premiumIconSize} />
            </View>
          ) : null}
        </View>
        <Text style={styles.queueSubtitle}>{subtitle}</Text>
      </View>
      <View style={rowStyles.queueCount}>
        <Text style={rowStyles.queueCountText}>{count}</Text>
      </View>
    </Pressable>
  );
}

function useQueueRowStyles({
  countBackgroundColor,
  countTextColor,
}: {
  countBackgroundColor: string;
  countTextColor: string;
}) {
  return useResponsiveStyles(
    ({ radius, responsiveFont, spacing }) => ({
      queueCount: {
        minWidth: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(8),
        paddingVertical: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: countBackgroundColor,
      },
      queueCountText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: countTextColor,
      },
    })
  );
}

function StatisticsSummaryRow({
  styles,
  label,
  value,
  badge,
}: {
  styles: ReturnType<typeof useStyles>;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueGroup}>
        {badge ? (
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

function useStyles({
  ringColor,
  safeBottom,
}: {
  ringColor: string;
  safeBottom: number;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      backButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.lg,
        backgroundColor: colors.glassTint,
      },
      headerTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      scroll: {
        flex: 1,
      },
      content: {
        padding: spacing.exact(24),
        paddingBottom: spacing.exact(24) + safeBottom,
        gap: spacing.exact(24),
      },
      segment: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.exact(2),
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
      },
      segmentItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(8),
        borderRadius: radius.xxl,
      },
      segmentItemActive: {
        backgroundColor: colors.textMuted,
      },
      segmentLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "500",
        color: colors.textPrimary,
      },
      segmentLabelActive: {
        color: colors.onAccent,
      },
      overviewRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(16),
      },
      ringValue: {
        fontSize: responsiveFont(40),
        lineHeight: responsiveFont(40),
        fontWeight: "700",
        letterSpacing: -0.8,
        color: ringColor,
      },
      overviewCopy: {
        flex: 1,
        gap: spacing.exact(12),
      },
      overviewBlock: {
        gap: spacing.exact(4),
      },
      levelTitle: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      levelSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      daysValue: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      card: {
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceStrong,
        overflow: "hidden",
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: spacing.exact(6),
        shadowOffset: { width: 0, height: spacing.exact(2) },
        elevation: 2,
      },
      cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.exact(16),
        padding: spacing.exact(16),
      },
      cardTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      infoButton: {
        width: spacing.exact(32),
        height: spacing.exact(32),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        backgroundColor: colors.track,
      },
      topicList: {
        paddingHorizontal: spacing.exact(16),
        paddingBottom: spacing.exact(16),
        gap: spacing.exact(8),
      },
      topicPressable: {
        width: "100%",
      },
      divider: {
        height: 1,
        backgroundColor: colors.line,
      },
      queueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(16),
      },
      queueCopy: {
        flex: 1,
        gap: spacing.exact(4),
      },
      queueTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      queueTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      premiumBadge: {
        width: spacing.exact(20),
        height: spacing.exact(20),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
      },
      queueSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      weakSection: {
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(16),
        gap: spacing.exact(4),
      },
      weakTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      weakSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.exact(8),
        marginTop: spacing.exact(8),
      },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(4),
        paddingLeft: spacing.exact(12),
        paddingRight: spacing.exact(8),
        paddingVertical: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: colors.track,
      },
      chipLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textPrimary,
      },
      summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.exact(12),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      summaryLabel: {
        flex: 1,
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      summaryValueGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      summaryBadge: {
        paddingHorizontal: spacing.exact(4),
        paddingVertical: spacing.exact(2),
        borderRadius: radius.pill,
        backgroundColor: colors.track,
      },
      summaryBadgeText: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      summaryValue: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "500",
        color: colors.textPrimary,
      },
      pressed: {
        opacity: 0.88,
      },
    })
  );
}
