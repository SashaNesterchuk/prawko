import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { getTopicProgress } from "../../src/features/questions/question-engine";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function TopicDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const allTopicIds = useMemo(() => getQuestionTopicIds(), []);
  const availableTopicIds = useMemo(
    () =>
      allTopicIds.filter(
        (candidate) => getTopicProgress(candidate, questionUserState).total > 0
      ),
    [allTopicIds, questionCatalogVersion, questionUserState]
  );
  const resolvedTopicId =
    topicId && allTopicIds.includes(topicId as (typeof allTopicIds)[number])
      ? (topicId as (typeof allTopicIds)[number])
      : availableTopicIds[0] ?? allTopicIds[0];

  if (!resolvedTopicId) {
    return null;
  }

  const topicTitle = getQuestionTopicTitle(resolvedTopicId, preferredLocale);
  const topicProgress = getTopicProgress(resolvedTopicId, questionUserState);
  const backIconSize = responsiveFont(22);
  const openTopicTraining = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode,
        topic: resolvedTopicId,
      }),
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
          <Text style={styles.headerTitle} numberOfLines={2}>
            {topicTitle}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TopicReadinessCard
            title={topicTitle}
            seen={topicProgress.seen}
            total={topicProgress.total}
            readiness={topicProgress.progress}
            correct={topicProgress.correct}
            wrong={topicProgress.wrong}
          />

          <View style={styles.actions}>
            <ActionTile
              accent="green"
              title={t("learn.topicActionLearn", {
                defaultValue: "Нові питання теми",
              })}
              subtitle={t("learn.topicActionLearnSubtitle", {
                defaultValue: "Пройти тему у навчальному режимі",
              })}
              onPress={() => openTopicTraining("learning")}
            />
            <ActionTile
              accent="amber"
              title={t("learn.topicActionMistakes", {
                defaultValue: "Помилки по темі",
              })}
              subtitle={t("learn.topicActionMistakesSubtitle", {
                defaultValue: "Повернутись до неправильних відповідей",
              })}
              onPress={() => openTopicTraining("wrong_answers")}
            />
            <ActionTile
              accent="blue"
              title={t("learn.topicActionReview", {
                defaultValue: "Закріплення теми",
              })}
              subtitle={t("learn.topicActionReviewSubtitle", {
                defaultValue: "Повторити питання без повного mastery",
              })}
              onPress={() => openTopicTraining("seen_not_mastered")}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles() {
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
    content: {
      padding: spacing.exact(24),
      paddingBottom: spacing.exact(120),
      gap: spacing.exact(12),
    },
    actions: {
      gap: spacing.exact(8),
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
