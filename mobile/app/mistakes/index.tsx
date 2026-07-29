import { router } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Icon } from "../../src/components/icons";
import { ActionTile } from "../../src/components/shell/ActionTile";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import { PracticeEmptyState } from "../../src/components/shell/PracticeEmptyState";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { TopicsOverviewCard } from "../../src/components/shell/TopicsOverviewCard";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import {
  getOverallConsolidationStats,
  getOverallMistakesStats,
  getQuestionDisplayStats,
  getTopicConsolidationProgress,
  getTopicMistakeProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function MistakesScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom });
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const iconSize = responsiveFont(24);

  const overallStats = useMemo(
    () => getOverallMistakesStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const consolidationStats = useMemo(
    () => getOverallConsolidationStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const dueReviews = useMemo(
    () => getQuestionDisplayStats(questionUserState).reviewDue,
    [questionCatalogVersion, questionUserState]
  );

  const topicsWithMistakes = useMemo(
    () =>
      getQuestionTopicIds().filter(
        (topic) => getTopicMistakeProgress(topic, questionUserState).wrong > 0
      ),
    [questionCatalogVersion, questionUserState]
  );

  const topicsWithConsolidation = useMemo(
    () =>
      getQuestionTopicIds().filter(
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

  const screenTitle = t("mistakes.screenTitle", {
    defaultValue: "Робота над помилками",
  });

  if (!hasWork) {
    return (
      <PracticeEmptyState
        headerTitle={screenTitle}
        title={t("mistakes.emptyTitle", { defaultValue: "Помилок немає" })}
        description={t("mistakes.emptyDescription", {
          defaultValue: "Так тримати! Продовжуй тренування.",
        })}
        iconName="like"
        dueReviews={dueReviews}
      />
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="back"
            accessibilityLabel={t("common.back", { defaultValue: "Назад" })}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>{screenTitle}</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
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
                    title={getQuestionTopicTitle(topic, preferredLocale)}
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
                style="faded"
                title={t("mistakes.consolidationCta", {
                  defaultValue: "Повторити для закріплення",
                })}
                subtitle={t("mistakes.consolidationCtaSubtitle", {
                  count: consolidationStats.consolidating,
                  defaultValue: "{{count}} питань чекають на 3 правильні підряд",
                })}
                icon={
                  <Icon
                    color={accents.blue.fill}
                    name="repeat"
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
                    title={getQuestionTopicTitle(topic, preferredLocale)}
                    seen={progress.consolidating}
                    total={progress.total}
                    readiness={progress.progress}
                    wrong={progress.consolidating}
                    onPress={() =>
                      openQuestionMode("seen_not_mastered", topic)
                    }
                  />
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.exact(16),
      paddingHorizontal: spacing.exact(24),
      paddingBottom: spacing.exact(8),
    },
    headerTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600" as const,
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
      fontWeight: "600" as const,
      letterSpacing: -0.18,
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.textSecondary,
      marginBottom: spacing.exact(4),
    },
  }));
}
