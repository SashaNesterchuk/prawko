import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS } from "@prawko/config";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { TopicsOverviewCard } from "../../src/components/shell/TopicsOverviewCard";
import {
  getOverallConsolidationStats,
  getOverallMistakesStats,
  getTopicConsolidationProgress,
  getTopicMistakeProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function MistakesScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom });
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const iconSize = responsiveFont(24);
  const headerIconSize = responsiveFont(22);
  const emptyIconSize = responsiveFont(40);

  const overallStats = useMemo(
    () => getOverallMistakesStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const consolidationStats = useMemo(
    () => getOverallConsolidationStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const topicsWithMistakes = useMemo(
    () =>
      TOPIC_BLOCK_IDS.filter(
        (topic) => getTopicMistakeProgress(topic, questionUserState).wrong > 0
      ),
    [questionCatalogVersion, questionUserState]
  );

  const topicsWithConsolidation = useMemo(
    () =>
      TOPIC_BLOCK_IDS.filter(
        (topic) =>
          getTopicConsolidationProgress(topic, questionUserState).consolidating >
          0
      ),
    [questionCatalogVersion, questionUserState]
  );

  const hasMistakes = overallStats.wrong > 0;
  const hasConsolidation = consolidationStats.consolidating > 0;
  const hasWork = hasMistakes || hasConsolidation;

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"],
    topic?: Parameters<typeof buildQuestionRouteParams>[0]["topic"]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode, topic }),
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
              size={headerIconSize}
            />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t("learn.tileMistakesTitle", {
              defaultValue: "Робота над помилками",
            })}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {hasWork ? (
            <>
              {hasMistakes ? (
                <>
                  <TopicsOverviewCard
                    title={t("mistakes.overviewTitle", { defaultValue: "Помилки" })}
                    answeredLabel={t("mistakes.overviewAnsweredLabel", {
                      defaultValue: "Питань з помилками",
                    })}
                    readiness={overallStats.readiness}
                    answered={overallStats.wrong}
                    total={overallStats.total}
                    correct={overallStats.correct}
                    wrong={overallStats.wrong}
                  />

                  {topicsWithMistakes.map((topic) => {
                    const progress = getTopicMistakeProgress(
                      topic,
                      questionUserState
                    );

                    return (
                      <TopicReadinessCard
                        key={topic}
                        title={t(`topics.${topic}`)}
                        seen={progress.seen}
                        total={progress.total}
                        readiness={progress.progress}
                        correct={progress.correct}
                        wrong={progress.wrong}
                        onPress={() => openQuestionMode("wrong_answers", topic)}
                      />
                    );
                  })}
                </>
              ) : null}

              {hasConsolidation ? (
                <View style={hasMistakes ? styles.sectionGap : null}>
                  <Text style={styles.sectionTitle}>
                    {t("mistakes.consolidationTitle", {
                      defaultValue: "Закріплення",
                    })}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {t("mistakes.consolidationSubtitle", {
                      count: consolidationStats.consolidating,
                      defaultValue:
                        "{{count}} питань виправлено, але ще не закріплено",
                    })}
                  </Text>

                  <ActionTile
                    accent="blue"
                    title={t("mistakes.consolidationCta", {
                      defaultValue: "Повторити для закріплення",
                    })}
                    subtitle={t("mistakes.consolidationCtaSubtitle", {
                      count: consolidationStats.consolidating,
                      defaultValue: "{{count}} питань чекають на 3 правильні підряд",
                    })}
                    icon={
                      <Ionicons
                        color={accents.blue.fill}
                        name="refresh-outline"
                        size={iconSize}
                      />
                    }
                    onPress={() => openQuestionMode("seen_not_mastered")}
                  />

                  {topicsWithConsolidation.map((topic) => {
                    const progress = getTopicConsolidationProgress(
                      topic,
                      questionUserState
                    );

                    return (
                      <TopicReadinessCard
                        key={`consolidation-${topic}`}
                        title={t(`topics.${topic}`)}
                        seen={progress.consolidating}
                        total={progress.total}
                        readiness={progress.progress}
                        wrong={progress.consolidating}
                        onPress={() => openQuestionMode("seen_not_mastered", topic)}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  color={accents.green.fill}
                  name="thumbs-up-outline"
                  size={emptyIconSize}
                />
              </View>

              <Text style={styles.emptyTitle}>
                {t("mistakes.emptyTitle", { defaultValue: "Помилок немає" })}
              </Text>
              <Text style={styles.emptyDescription}>
                {t("mistakes.emptyDescription", {
                  defaultValue: "Так тримати! Продовжуй тренування.",
                })}
              </Text>

              <View style={styles.emptyActions}>
                <ActionTile
                  accent="red"
                  premium
                  title={t("learn.tileTrapsTitle", {
                    defaultValue: "Питання-пастки",
                  })}
                  subtitle={t("learn.tileTrapsSubtitle", {
                    defaultValue: "Найчастіше плутають",
                  })}
                  icon={
                    <Ionicons
                      color={accents.red.fill}
                      name="alert-circle-outline"
                      size={iconSize}
                    />
                  }
                  onPress={() => openQuestionMode("hard_questions")}
                />
                <ActionTile
                  accent="blue"
                  premium
                  title={t("learn.tileSrsTitle", {
                    defaultValue: "Розумні повторення",
                  })}
                  subtitle={t("learn.tileSrsSubtitle", {
                    defaultValue: "Повторюй в оптимальний момент",
                  })}
                  icon={
                    <Ionicons
                      color={accents.blue.fill}
                      name="refresh-outline"
                      size={iconSize}
                    />
                  }
                  onPress={() => openQuestionMode("seen_not_mastered")}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
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
      borderRadius: radius.md,
      backgroundColor: colors.surface,
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
      gap: spacing.exact(8),
    },
    sectionGap: {
      marginTop: spacing.exact(16),
      gap: spacing.exact(8),
    },
    sectionTitle: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(26),
      fontWeight: "600",
      letterSpacing: -0.18,
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.textSecondary,
      marginBottom: spacing.exact(4),
    },
    pressed: {
      opacity: 0.9,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: spacing.exact(24),
    },
    emptyIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.exact(24),
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
    },
    emptyTitle: {
      marginTop: spacing.exact(24),
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.64,
      color: colors.textPrimary,
      textAlign: "center",
    },
    emptyDescription: {
      marginTop: spacing.exact(16),
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      color: colors.textSecondary,
      textAlign: "center",
    },
    emptyActions: {
      width: "100%",
      marginTop: spacing.exact(24),
      gap: spacing.exact(8),
    },
  }));
}
