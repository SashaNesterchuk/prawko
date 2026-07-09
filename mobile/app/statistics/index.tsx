import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS, type TopicBlockId } from "@prawko/config";

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
  getQuestionDisplayStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { getDaysUntilExamFromDate } from "../../src/features/study-plan/generate-local-study-plan";
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
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

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

function resolveRingColor(readiness: number) {
  const level = resolveReadinessLevel(readiness);

  if (level === "high") {
    return greenWaveAccent.green.fill;
  }

  if (level === "mid") {
    return greenWaveAccent.amber.fill;
  }

  return greenWaveAccent.red.fill;
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
      TOPIC_BLOCK_IDS.map((topicId) => {
        const progress = getTopicProgress(topicId, questionUserState);

        return {
          topicId,
          title: t(`topics.${topicId}`),
          seen: progress.seen,
          total: progress.total,
          progress: progress.progress,
        };
      }),
    [questionUserState, questionCatalogVersion, t]
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

  const openTopicTraining = (topicId: TopicBlockId) =>
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
            <Ionicons color={greenWave.color.ink} name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t("statistics.title", { defaultValue: "Статистика" })}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 24 + safeBottom },
          ]}
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
              size={160}
              stroke={10}
              color={resolveRingColor(readiness)}
            >
              <Text
                style={[
                  styles.ringValue,
                  { color: resolveRingColor(readiness) },
                ]}
              >
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
                      color={greenWave.color.inkSecondary}
                      name="information-circle-outline"
                      size={16}
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
                              color={greenWave.color.inkSecondary}
                              name="chevron-forward"
                              size={16}
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
                  label={t("statistics.totalExams", {
                    defaultValue: "Всього іспитів",
                  })}
                  value={String(examSessions.length)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
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
                  label={t("statistics.totalTrainings", {
                    defaultValue: "Всього тренувань",
                  })}
                  value={String(metrics.sessions)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  label={t("statistics.bestTraining", {
                    defaultValue: "Краще тренування",
                  })}
                  value={
                    bestTrainingAccuracy > 0 ? `${bestTrainingAccuracy}%` : "—"
                  }
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  label={t("statistics.questionsCovered", {
                    defaultValue: "Охоплено питань",
                  })}
                  value={`${stats.seen} / ${stats.total}`}
                  badge={`${localReadiness}%`}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
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
  title,
  subtitle,
  count,
  accent,
  premium = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  count: number;
  accent: "blue" | "red";
  premium?: boolean;
  onPress?: () => void;
}) {
  const accentColors =
    accent === "blue" ? greenWaveAccent.blue : greenWaveAccent.red;

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
              <Ionicons color="#ffffff" name="star" size={10} />
            </View>
          ) : null}
        </View>
        <Text style={styles.queueSubtitle}>{subtitle}</Text>
      </View>
      <View
        style={[
          styles.queueCount,
          { backgroundColor: accentColors.soft },
        ]}
      >
        <Text style={[styles.queueCountText, { color: accentColors.ink }]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function StatisticsSummaryRow({
  label,
  value,
  badge,
}: {
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.lg,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.xl,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    padding: 2,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: greenWave.radius.xxl,
  },
  segmentItemActive: {
    backgroundColor: greenWave.color.inkMuted,
  },
  segmentLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: greenWave.color.ink,
  },
  segmentLabelActive: {
    color: "#ffffff",
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.lg,
  },
  ringValue: {
    fontSize: 40,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  overviewCopy: {
    flex: 1,
    gap: greenWave.spacing.md,
  },
  overviewBlock: {
    gap: greenWave.spacing.xs,
  },
  levelTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  levelSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkSecondary,
  },
  trendBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: greenWave.spacing.xs,
    paddingVertical: 2,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.soft,
  },
  trendText: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "500",
    color: greenWaveAccent.green.ink,
  },
  daysValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  card: {
    borderRadius: greenWave.radius.xl,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: greenWave.spacing.lg,
    padding: greenWave.spacing.lg,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  infoButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.track,
  },
  topicList: {
    paddingHorizontal: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.lg,
    gap: greenWave.spacing.sm,
  },
  topicPressable: {
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: greenWave.color.line,
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.lg,
  },
  queueCopy: {
    flex: 1,
    gap: greenWave.spacing.xs,
  },
  queueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  queueTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: greenWave.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWaveAccent.green.fill,
  },
  queueSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  queueCount: {
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.sm,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
  },
  queueCountText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
  },
  weakSection: {
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.lg,
    gap: greenWave.spacing.xs,
  },
  weakTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  weakSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: greenWave.spacing.sm,
    marginTop: greenWave.spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
    paddingLeft: greenWave.spacing.md,
    paddingRight: greenWave.spacing.sm,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.track,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.ink,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.md,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkSecondary,
  },
  summaryValueGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  summaryBadge: {
    paddingHorizontal: greenWave.spacing.xs,
    paddingVertical: 2,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
  },
  summaryBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkSecondary,
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: greenWave.color.ink,
  },
  pressed: {
    opacity: 0.88,
  },
});
