import { router } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { MistakesOverviewCard } from "../../src/components/shell/MistakesOverviewCard";
import { MistakesTopicRow } from "../../src/components/shell/MistakesTopicRow";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import { PracticeEmptyState } from "../../src/components/shell/PracticeEmptyState";
import {
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import {
  getOverallMistakesStats,
  getQuestionDisplayStats,
} from "../../src/features/questions/question-engine";
import { listCatalogTopicsWithMistakes } from "../../src/features/questions/mistakes-topics";
import { useQuestionModeCountDialog } from "../../src/features/questions/useQuestionModeCountDialog";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function MistakesScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );
  const { openMode, dialog: countDialog } = useQuestionModeCountDialog();

  const overallStats = useMemo(
    () => getOverallMistakesStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const dueReviews = useMemo(
    () => getQuestionDisplayStats(questionUserState).reviewDue,
    [questionCatalogVersion, questionUserState]
  );

  // Same catalog topics as Learn (question_topic_catalog / primary_topic_id).
  const topicsWithMistakes = useMemo(
    () =>
      listCatalogTopicsWithMistakes(questionUserState, topicQuestionProgress),
    [questionCatalogVersion, questionUserState, topicQuestionProgress]
  );

  const hasMistakes = overallStats.wrong > 0;
  const screenTitle = t("mistakes.screenTitle", {
    defaultValue: "Робота над помилками",
  });
  const trainAllTitle = t("mistakes.trainAllCta", {
    defaultValue: "Тренувати всі",
  });

  const openMistakesSession = (
    topic?: (typeof topicsWithMistakes)[number]["topicId"]
  ) =>
    openMode({
      mode: "wrong_answers",
      title: topic
        ? getQuestionTopicTitle(topic, preferredLocale)
        : trainAllTitle,
      topic,
    });

  if (!hasMistakes) {
    return (
      <PracticeEmptyState
        headerTitle={screenTitle}
        title={t("mistakes.emptyTitle", { defaultValue: "Помилок немає" })}
        description={t("mistakes.emptyDescription", {
          defaultValue: "Так тримати! Продовжуй тренування.",
        })}
        iconName="like"
        dueReviews={dueReviews}
        testID="screen-mistakes-empty"
      />
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-mistakes"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="back"
            accessibilityLabel={t("common.back", { defaultValue: "Назад" })}
            onPress={() => router.back()}
          />
          <CText style={styles.headerTitle}>{screenTitle}</CText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <MistakesOverviewCard
            title={t("mistakes.overviewTitle", { defaultValue: "Помилки" })}
            wrongLabel={t("mistakes.overviewWrongLabel", {
              defaultValue: "Неправильні відповіді",
            })}
            trainAllLabel={trainAllTitle}
            wrong={overallStats.wrong}
            total={overallStats.total}
            onTrainAll={() => openMistakesSession()}
          />

          <View style={styles.modules}>
            {topicsWithMistakes.map(({ topicId, progress }, index) => (
              <MistakesTopicRow
                key={topicId}
                title={getQuestionTopicTitle(topicId, preferredLocale)}
                wrong={progress.wrong}
                total={progress.total}
                testID={`mistakes-topic-row-index-${index}`}
                onPress={() => openMistakesSession(topicId)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
      {countDialog}
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
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(12),
      paddingBottom: spacing.exact(24) + safeBottom,
      gap: spacing.exact(24),
    },
    modules: {
      gap: spacing.exact(8),
    },
  }));
}
