import { Ionicons } from "@expo/vector-icons";
import { type LearningTopicId } from "@prawko/config";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../src/components/icons";
import { CalendarSheet } from "../../src/components/shell/CalendarSheet";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { ProgressRing } from "../../src/components/shell/ProgressRing";
import {
  resolveReadinessLevel,
  resolveReadinessRingColor,
} from "../../src/components/shell/ReadinessIndexCard";
import { SignCategoryProgressCard } from "../../src/components/shell/SignCategoryProgressCard";
import {
  QuestionCountDialog,
  resolveQuestionCountDialog,
  type QuestionCountSelection,
} from "../../src/components/shell/QuestionCountDialog";
import { SignsSummaryCard } from "../../src/components/shell/SignsSummaryCard";
import { StatisticsActivityCard } from "../../src/components/shell/StatisticsActivityCard";
import { StatisticsTopicProgressRow } from "../../src/components/shell/StatisticsTopicProgressRow";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import type { RemoteExamSession } from "../../src/features/exam/types";
import {
  buildWeekActivity,
  getCoverageReadinessWeekChangePercent,
  getLearningDaysCount,
  getProfileStatMetrics,
} from "../../src/features/profile/profile-stats";
import {
  ROAD_SIGN_CATEGORIES,
} from "../../src/features/road-signs/catalog";
import { buildAllSignTestQuestions } from "../../src/features/road-signs/category-test";
import {
  getAllSignsProgress,
  getCategorySignProgress,
} from "../../src/features/road-signs/sign-progress";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import {
  getMistakesFixedStats,
  getQuestionDisplayStats,
  getSeenQuestionIds,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import { resolveLocalReadinessPercent } from "../../src/features/questions/readiness-assessment";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useQuestionModeCountDialog } from "../../src/features/questions/useQuestionModeCountDialog";
import {
  applyExamDateChange,
  parseNullableIsoDate,
  toIsoDate,
} from "../../src/features/study-plan/exam-date";
import { getDaysUntilExamFromDate } from "../../src/features/study-plan/generate-local-study-plan";
import {
  CText,
  getFontFamily,
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
import { useSignPracticeProgressStore } from "../../src/state/sign-practice-progress";

type StatisticsTab = "exam" | "signs";

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
  const { t, i18n } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const spacing = useResponsiveSpacing();
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const hydrateRemoteStudyPlan = useAppShellStore(
    (state) => state.hydrateRemoteStudyPlan
  );
  const patchExamDate = useAppShellStore((state) => state.patchExamDate);
  const currentStudyPlan = useCurrentStudyPlan();
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );
  const readinessAssessment = useQuestionProgressStore(
    (state) => state.readinessAssessment
  );
  const signPracticeRecords = useSignPracticeProgressStore(
    (state) => state.records
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [activeTab, setActiveTab] = useState<StatisticsTab>("exam");
  const [topicsInfoVisible, setTopicsInfoVisible] = useState(false);
  const [signsCountDialogVisible, setSignsCountDialogVisible] = useState(false);
  const [signsSelectedCount, setSignsSelectedCount] =
    useState<QuestionCountSelection>("all");
  const [examDatePickerVisible, setExamDatePickerVisible] = useState(false);
  const [isSavingExamDate, setIsSavingExamDate] = useState(false);
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);
  const [examSessions, setExamSessions] = useState<RemoteExamSession[]>([]);
  const { openMode, dialog: questionModeCountDialog } =
    useQuestionModeCountDialog();

  const availableSignQuestions = useMemo(
    () => buildAllSignTestQuestions(),
    []
  );

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
          const progress = getTopicProgress(
            topicId,
            questionUserState,
            topicQuestionProgress
          );

          return {
            topicId,
            title: getQuestionTopicTitle(topicId, preferredLocale),
            seen: progress.seen,
            total: progress.total,
            progress: progress.progress,
          };
        })
        .filter((topic) => topic.total > 0),
    [
      preferredLocale,
      questionCatalogVersion,
      questionUserState,
      topicQuestionProgress,
    ]
  );

  const signsCatalogProgress = useMemo(
    () => getAllSignsProgress(signPracticeRecords),
    [signPracticeRecords]
  );

  const signCategoryRows = useMemo(
    () =>
      ROAD_SIGN_CATEGORIES.map((category) => ({
        category,
        progress: getCategorySignProgress(category.id, signPracticeRecords),
      })).filter((row) => row.progress.total > 0),
    [signPracticeRecords]
  );

  const coveragePercent =
    stats.total > 0 ? Math.round((stats.seen / stats.total) * 100) : 0;
  const localReadiness = resolveLocalReadinessPercent({
    assessmentScorePercent: readinessAssessment?.scorePercent,
    seen: stats.seen,
    total: stats.total,
  });
  const usesLocalReadiness = readinessSummary == null;
  const examReadiness = Math.round(
    readinessSummary?.readinessScore ?? localReadiness
  );
  const signsLearnedPercent =
    signsCatalogProgress.total > 0
      ? Math.round(
          (signsCatalogProgress.seen / signsCatalogProgress.total) * 100
        )
      : 0;
  const readiness = examReadiness;
  const readinessLevel = resolveReadinessLevel(readiness);
  const ringColor = resolveReadinessRingColor(readiness, accents);
  const styles = useStyles({ ringColor, safeBottom });
  const backIconSize = responsiveFont(22);
  const smallIconSize = responsiveFont(16);
  const weekBadgeIconSize = responsiveFont(12);
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

  // User-set / remote exam date only — never invent from plan horizon.
  const examDate =
    studyPlanSetup.examDate ??
    (readinessSummary?.examDate?.trim()
      ? readinessSummary.examDate
      : null);
  const daysUntilExam =
    examDate != null ? getDaysUntilExamFromDate(examDate) : null;

  const readinessWeekChangePercent = useMemo(() => {
    if (!usesLocalReadiness || stats.seen <= 0) {
      return null;
    }

    return getCoverageReadinessWeekChangePercent({
      attempts,
      seenQuestionIds: getSeenQuestionIds(questionUserState),
      totalQuestions: stats.total,
    });
  }, [
    attempts,
    questionCatalogVersion,
    questionUserState,
    stats.seen,
    stats.total,
    usesLocalReadiness,
  ]);

  const showWeekChangeBadge =
    activeTab === "exam" && readinessWeekChangePercent != null;
  const isWeekChangeUp = (readinessWeekChangePercent ?? 0) > 0;
  const isWeekChangeFlat = readinessWeekChangePercent === 0;
  const readinessWeekChangeLabel = isWeekChangeFlat
    ? t("statistics.readinessWeekChangeNone")
    : t("statistics.readinessWeekChange", {
        value: Math.abs(readinessWeekChangePercent ?? 0),
      });

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
  const mistakesFixed = useMemo(
    () => getMistakesFixedStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const openTopicTraining = (topicId: LearningTopicId) =>
    router.navigate({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: "learning",
        topic: topicId,
      }),
    });

  const openMistakes = () => router.navigate("/mistakes");
  const openReview = () =>
    openMode({
      mode: "review_due",
      title: t("statistics.smartReviewTitle"),
    });
  const openExamDate = () => setExamDatePickerVisible(true);

  const handleConfirmExamDate = async (date: Date) => {
    if (isSavingExamDate) {
      return;
    }

    setIsSavingExamDate(true);
    try {
      await applyExamDateChange({
        authMode,
        currentStudyPlan,
        currentStudyPlanRemoteId,
        examDate: toIsoDate(date),
        hydrateRemoteStudyPlan,
        preferredCategory,
        preferredLocale,
        patchExamDate,
        schoolCode: studyPlanSetup.schoolCode,
      });
      setExamDatePickerVisible(false);
    } catch (error) {
      console.warn("Failed to update exam date.", error);
    } finally {
      setIsSavingExamDate(false);
    }
  };

  const startSignsTrainingWithLimit = (limit: QuestionCountSelection) => {
    router.navigate({
      pathname: "/signs/test",
      params: {
        limit: limit === "all" ? "all" : String(limit),
      },
    });
  };

  const openSignsTraining = () => {
    const { shouldShowDialog, defaultCount } = resolveQuestionCountDialog(
      availableSignQuestions.length
    );

    if (!shouldShowDialog) {
      startSignsTrainingWithLimit("all");
      return;
    }

    setSignsSelectedCount(defaultCount);
    setSignsCountDialogVisible(true);
  };

  const startSignsTraining = () => {
    setSignsCountDialogVisible(false);
    startSignsTrainingWithLimit(signsSelectedCount);
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-statistics"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Ionicons
              color={colors.textPrimary}
              name="chevron-back"
              size={backIconSize}
            />
          </Pressable>
          <CText style={styles.headerTitle}>
            {t("statistics.title")}
          </CText>
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
              <CText
                style={[
                  styles.segmentLabel,
                  activeTab === "exam" ? styles.segmentLabelActive : null,
                ]}
              >
                {t("statistics.tabExam")}
              </CText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("signs")}
              style={[
                styles.segmentItem,
                activeTab === "signs" ? styles.segmentItemActive : null,
              ]}
            >
              <CText
                style={[
                  styles.segmentLabel,
                  activeTab === "signs" ? styles.segmentLabelActive : null,
                ]}
              >
                {t("statistics.tabSigns")}
              </CText>
            </Pressable>
          </View>

          {activeTab === "exam" ? (
            <>
              <View style={styles.overviewRow}>
                <ProgressRing
                  progress={readiness}
                  size={ringSize}
                  stroke={ringStroke}
                  color={ringColor}
                >
                  <CText style={styles.ringValue}>
                    <CText style={styles.ringValueNumber}>{readiness}</CText>
                    <CText style={styles.ringValuePercent}>%</CText>
                  </CText>
                </ProgressRing>

                <View style={styles.overviewCopy}>
                  <View style={styles.overviewBlock}>
                    <CText style={styles.levelTitle}>
                      {t(`statistics.level.${readinessLevel}`)}
                    </CText>
                    <CText style={styles.levelSubtitle}>
                      {t("statistics.readinessIndex")}
                    </CText>
                  </View>

                  {showWeekChangeBadge ? (
                    <View
                      style={[
                        styles.weekBadge,
                        isWeekChangeFlat
                          ? styles.weekBadgeFlat
                          : isWeekChangeUp
                            ? styles.weekBadgeUp
                            : styles.weekBadgeDown,
                      ]}
                    >
                      {!isWeekChangeFlat ? (
                        <Icon
                          color={
                            isWeekChangeUp
                              ? accents.green.ink
                              : accents.red.ink
                          }
                          name="arrow"
                          size={weekBadgeIconSize}
                          style={
                            isWeekChangeUp ? styles.weekArrowUp : undefined
                          }
                        />
                      ) : null}
                      <CText
                        style={[
                          styles.weekBadgeLabel,
                          isWeekChangeFlat
                            ? styles.weekBadgeLabelFlat
                            : isWeekChangeUp
                              ? styles.weekBadgeLabelUp
                              : styles.weekBadgeLabelDown,
                        ]}
                      >
                        {readinessWeekChangeLabel}
                      </CText>
                    </View>
                  ) : null}

                  {daysUntilExam != null ? (
                    <View style={styles.overviewBlock}>
                      <CText style={styles.daysValue}>{daysUntilExam}</CText>
                      <CText style={styles.levelSubtitle}>
                        {t("statistics.daysUntilExam")}
                      </CText>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={openExamDate}
                      style={({ pressed }) => [
                        styles.examDateCta,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons
                        color={colors.textPrimary}
                        name="calendar-outline"
                        size={smallIconSize}
                      />
                      <CText style={styles.examDateCtaLabel}>
                        {t("statistics.examDateCta")}
                      </CText>
                    </Pressable>
                  )}
                </View>
              </View>

              <StatisticsActivityCard
                learningDays={learningDays}
                sessions={metrics.sessions}
                streak={metrics.streak}
                weekDays={weekDays}
                labels={{
                  learningDays: t("statistics.learningDays"),
                  sessions: t("statistics.sessions"),
                  streak: t("statistics.streak"),
                }}
              />

              <View style={styles.card} testID="statistics-topics-card">
                <View style={styles.cardHeader}>
                  <CText style={styles.cardTitle}>
                    {t("statistics.topicsTitle")}
                  </CText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("statistics.topicsInfoTitle")}
                    onPress={() => setTopicsInfoVisible(true)}
                    style={({ pressed }) => [
                      styles.infoButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons
                      color={colors.textSecondary}
                      name="information-circle-outline"
                      size={smallIconSize}
                    />
                  </Pressable>
                </View>

                <View style={styles.topicList} testID="statistics-topics-list">
                  {topicRows.map((topic, index) => (
                    <Pressable
                      key={topic.topicId}
                      accessibilityRole="button"
                      onPress={() => openTopicTraining(topic.topicId)}
                      style={({ pressed }) => [
                        styles.topicPressable,
                        pressed ? styles.pressed : null,
                      ]}
                      testID={`statistics-topic-row-index-${index}`}
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
                  title={t("statistics.smartReviewTitle")}
                  subtitle={t("statistics.smartReviewSubtitle")}
                  count={stats.reviewDue}
                  accent="blue"
                  onPress={openReview}
                />
                <View style={styles.divider} />
                <StatisticsQueueRow
                  styles={styles}
                  title={t("statistics.mistakesTitle")}
                  subtitle={t("statistics.mistakesSubtitle")}
                  count={stats.wrongAnswers}
                  accent="red"
                  onPress={openMistakes}
                />
                {weakTopics.length > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.weakSection}>
                      <CText style={styles.weakTitle}>
                        {t("statistics.weakTopicsTitle")}
                      </CText>
                      <CText style={styles.weakSubtitle}>
                        {t("statistics.weakTopicsSubtitle")}
                      </CText>
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
                            <CText style={styles.chipLabel}>{topic.title}</CText>
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
                  label={t("statistics.totalExams")}
                  value={String(examSessions.length)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.bestExam")}
                  value={
                    bestExam
                      ? t("statistics.bestExamValue", {
                          score: bestExam.scorePoints,
                          total: bestExam.totalPointsTarget,
                        })
                      : "—"
                  }
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.totalTrainings")}
                  value={String(metrics.sessions)}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.bestTraining")}
                  value={
                    bestTrainingAccuracy > 0 ? `${bestTrainingAccuracy}%` : "—"
                  }
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.questionsCovered")}
                  value={`${stats.seen} / ${stats.total}`}
                  badge={`${coveragePercent}%`}
                />
                <View style={styles.divider} />
                <StatisticsSummaryRow
                  styles={styles}
                  label={t("statistics.mistakesFixed")}
                  value={
                    mistakesFixed.total > 0
                      ? `${mistakesFixed.fixed}/${mistakesFixed.total}`
                      : "—"
                  }
                  badge={
                    mistakesFixed.percent != null
                      ? `${mistakesFixed.percent}%`
                      : undefined
                  }
                />
              </View>
            </>
          ) : (
            <>
              <SignsSummaryCard
                title={t("statistics.learned")}
                progress={signsLearnedPercent}
                correct={signsCatalogProgress.correct}
                wrong={signsCatalogProgress.wrong}
                seen={signsCatalogProgress.seen}
                total={signsCatalogProgress.total}
                answersLabel={t("statistics.correctAnswers")}
                trainAllLabel={t("signs.trainAll")}
                onTrainAll={openSignsTraining}
                variant="split"
              />

              <View style={styles.card}>
                <View style={styles.signCategoryList}>
                  {signCategoryRows.map(({ category, progress }) => (
                    <SignCategoryProgressCard
                      key={category.id}
                      category={category}
                      embedded
                      progress={progress}
                      title={t(`signs.categories.${category.id}.title`)}
                      variant="split"
                      onPress={() =>
                        router.navigate({
                          pathname: "/signs/category/[categoryId]",
                          params: { categoryId: category.id },
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <TopicsInfoDialog
          visible={topicsInfoVisible}
          title={t("statistics.topicsInfoTitle")}
          body={t("statistics.topicsInfoBody")}
          closeLabel={t("common.close")}
          onClose={() => setTopicsInfoVisible(false)}
        />

        <QuestionCountDialog
          title={t("signs.title")}
          subtitle={t("signs.chooseQuestionCount")}
          startLabel={t("signs.startTrainingCta")}
          allLabel={t("signs.allQuestions")}
          totalCount={availableSignQuestions.length}
          selectedCount={signsSelectedCount}
          visible={signsCountDialogVisible}
          onClose={() => setSignsCountDialogVisible(false)}
          onSelectCount={setSignsSelectedCount}
          onStart={startSignsTraining}
        />

        {questionModeCountDialog}

        <CalendarSheet
          visible={examDatePickerVisible}
          locale={i18n.language}
          initialDate={parseNullableIsoDate(examDate)}
          confirmLabel={t("onboarding.examDateConfirm")}
          clearLabel={t("onboarding.examDateClear")}
          onClose={() => setExamDatePickerVisible(false)}
          onConfirm={(date) => {
            void handleConfirmExamDate(date);
          }}
          onClear={() => setExamDatePickerVisible(false)}
        />
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
  onPress,
}: {
  styles: ReturnType<typeof useStyles>;
  title: string;
  subtitle: string;
  count: number;
  accent: "blue" | "red";
  onPress?: () => void;
}) {
  const { accents } = useTheme();
  const accentColors = accent === "blue" ? accents.blue : accents.red;
  const rowStyles = useQueueRowStyles({
    countBackgroundColor: accentColors.soft,
    countTextColor: accentColors.ink,
  });

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
        <CText style={styles.queueTitle}>{title}</CText>
        <CText style={styles.queueSubtitle}>{subtitle}</CText>
      </View>
      <View style={rowStyles.queueCount}>
        <CText style={rowStyles.queueCountText}>{count}</CText>
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
        fontFamily: getFontFamily("semiBold"),
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
      <CText style={styles.summaryLabel}>{label}</CText>
      <View style={styles.summaryValueGroup}>
        {badge ? (
          <View style={styles.summaryBadge}>
            <CText style={styles.summaryBadgeText}>{badge}</CText>
          </View>
        ) : null}
        <CText style={styles.summaryValue}>{value}</CText>
      </View>
    </View>
  );
}

function TopicsInfoDialog({
  visible,
  title,
  body,
  closeLabel,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const styles = useTopicsInfoStyles();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <CText style={styles.title}>{title}</CText>
          <CText style={styles.body}>{body}</CText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <CText style={styles.closeLabel}>{closeLabel}</CText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useTopicsInfoStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.overlayBackdrop,
    },
    card: {
      width: "100%",
      borderRadius: radius.xxl,
      padding: spacing.exact(24),
      backgroundColor: colors.paper,
      gap: spacing.exact(16),
    },
    title: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.ink,
    },
    body: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.ink2,
    },
    closeButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.track,
    },
    closeLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
    },
    pressed: {
      opacity: 0.88,
    },
  }));
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
        fontFamily: getFontFamily("semiBold"),
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
        fontFamily: getFontFamily("medium"),
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
        textAlign: "center",
        color: ringColor,
      },
      ringValueNumber: {
        fontSize: responsiveFont(52),
        lineHeight: responsiveFont(52),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -1.04,
        color: ringColor,
      },
      ringValuePercent: {
        fontSize: responsiveFont(40),
        lineHeight: responsiveFont(52),
        fontFamily: getFontFamily("bold"),
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
        fontFamily: getFontFamily("semiBold"),
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      levelSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      weekBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(2),
        paddingVertical: spacing.exact(2),
        paddingHorizontal: spacing.exact(4),
        borderRadius: radius.pill,
      },
      weekBadgeFlat: {
        backgroundColor: colors.track,
      },
      weekBadgeUp: {
        backgroundColor: accents.green.soft,
      },
      weekBadgeDown: {
        backgroundColor: accents.red.soft,
      },
      weekBadgeLabel: {
        fontSize: responsiveFont(11),
        lineHeight: responsiveFont(12),
        fontFamily: getFontFamily("medium"),
      },
      weekBadgeLabelFlat: {
        color: colors.textSecondary,
      },
      weekBadgeLabelUp: {
        color: accents.green.ink,
      },
      weekBadgeLabelDown: {
        color: accents.red.ink,
      },
      weekArrowUp: {
        transform: [{ rotate: "180deg" }],
      },
      daysValue: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        letterSpacing: -0.2,
        color: colors.textPrimary,
      },
      examDateCta: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(12),
        paddingVertical: spacing.exact(8),
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surfaceStrong,
      },
      examDateCtaLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
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
        fontFamily: getFontFamily("semiBold"),
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
      signCategoryList: {
        padding: spacing.exact(16),
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
      queueTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("semiBold"),
        letterSpacing: -0.16,
        color: colors.textPrimary,
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
        fontFamily: getFontFamily("semiBold"),
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
        fontFamily: getFontFamily("medium"),
        color: colors.textPrimary,
      },
      pressed: {
        opacity: 0.88,
      },
    })
  );
}
