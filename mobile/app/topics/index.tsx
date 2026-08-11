import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { TopicsOverviewCard } from "../../src/components/shell/TopicsOverviewCard";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import {
  getOverallLearningStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function TopicsScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom });
  const questionCatalogVersion = useQuestionCatalogVersion();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );
  const backIconSize = responsiveFont(22);

  const overallStats = useMemo(
    () => getOverallLearningStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );
  const topicCards = useMemo(() => {
    const allTopicIds = getQuestionTopicIds();
    const rows = allTopicIds.map((topicId) => ({
      topicId,
      progress: getTopicProgress(
        topicId,
        questionUserState,
        topicQuestionProgress
      ),
    }));
    const withQuestions = rows.filter((row) => row.progress.total > 0);
    return withQuestions.length > 0 ? withQuestions : rows;
  }, [questionCatalogVersion, questionUserState, topicQuestionProgress]);

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-topics"
      >
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
          <CText style={styles.headerTitle}>
            {t("learn.topicsTitle", { defaultValue: "Теми" })}
          </CText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TopicsOverviewCard
            readiness={overallStats.readiness}
            answered={overallStats.answered}
            total={overallStats.total}
            correct={overallStats.correct}
            wrong={overallStats.wrong}
          />

          {topicCards.map(({ topicId, progress }, index) => (
              <TopicReadinessCard
                key={topicId}
                title={getQuestionTopicTitle(topicId, preferredLocale)}
                seen={progress.seen}
                total={progress.total}
                readiness={progress.progress}
                correct={progress.correct}
                wrong={progress.wrong}
                testID={`topics-topic-card-index-${index}`}
                onPress={() =>
                  router.navigate({
                    pathname: "/topic/[topicId]",
                    params: { topicId },
                  })
                }
              />
          ))}
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
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.48,
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
    pressed: {
      opacity: 0.9,
    },
  }));
}
