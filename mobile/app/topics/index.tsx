import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
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
  const topicIds = useMemo(
    () =>
      getQuestionTopicIds().filter(
        (topicId) =>
          getTopicProgress(topicId, questionUserState, topicQuestionProgress)
            .total > 0
      ),
    [questionCatalogVersion, questionUserState, topicQuestionProgress]
  );

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
            {t("learn.topicsTitle", { defaultValue: "Теми" })}
          </Text>
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

          {topicIds.map((topic) => {
            const progress = getTopicProgress(
              topic,
              questionUserState,
              topicQuestionProgress
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
                onPress={() =>
                  router.navigate({
                    pathname: "/topic/[topicId]",
                    params: { topicId: topic },
                  })
                }
              />
            );
          })}
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
