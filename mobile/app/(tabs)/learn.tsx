import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../../src/components/icons";
import { ActionTile } from "../../src/components/shell/ActionTile";
import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import {
  getQuestionDisplayStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import {
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

function LearnActionIcon({
  accent,
  name,
}: {
  accent: keyof ReturnType<typeof useTheme>["accents"];
  name: IconName;
}) {
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();

  return (
    <Icon
      color={accents[accent].fill}
      name={name}
      size={responsiveFont(24)}
    />
  );
}

export default function LearnTabScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const isFocused = useIsFocused();
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setReadinessSummary(null);
      return;
    }

    let cancelled = false;

    void fetchRemoteHomeProgress(getWarsawIsoDate())
      .then(({ readinessSummary: summary }) => {
        if (!cancelled) {
          setReadinessSummary(summary);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch readiness summary for Learn.", error);
          setReadinessSummary(null);
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

  const topicIds = useMemo(
    () =>
      getQuestionTopicIds().filter(
        (topicId) => getTopicProgress(topicId, questionUserState).total > 0
      ),
    [questionCatalogVersion, questionUserState]
  );
  const displayTopicIds =
    topicIds.length > 0 ? topicIds : getQuestionTopicIds();

  const recentExamPassed = readinessSummary?.recentExamStatus === "completed";
  const dueReviews = readinessSummary?.dueReviews ?? stats.reviewDue;

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode }),
    });

  const primaryTiles: ActionTileItem[] = [
    {
      key: "trainer",
      accent: "green",
      title: t("learn.tileTrainerTitle", { defaultValue: "Тренування" }),
      subtitle: t("learn.tileTrainerSubtitleShort", {
        defaultValue: "Вільне тестування",
      }),
      icon: <LearnActionIcon accent="green" name="target" />,
      onPress: () => router.push("/trainer-modes"),
    },
    {
      key: "exam",
      accent: "green",
      title: t("learn.tileExamTitle", { defaultValue: "Іспит" }),
      subtitle: recentExamPassed
        ? t("learn.tileExamSubtitlePassed", {
            defaultValue: "Симуляція: 1/1",
          })
        : t("learn.tileExamSubtitlePending", {
            defaultValue: "Симуляція: 0/1",
          }),
      icon: <LearnActionIcon accent="green" name="exam" />,
      onPress: () =>
        router.push({
          pathname: "/exam",
          params: buildExamRouteParams({ mode: "exam" }),
        }),
    },
  ];

  const personalizedTiles: ActionTileItem[] = [
    {
      key: "mistakes",
      accent: "red",
      style: "faded",
      title: t("learn.tileMistakesTitle", {
        defaultValue: "Виправити помилки",
      }),
      subtitle: t("learn.tileMistakesSubtitle", {
        defaultValue: "Невиправлених помилок: {{count}}",
        count: stats.wrongAnswers,
      }),
      icon: <LearnActionIcon accent="red" name="alert" />,
      onPress: () => router.push("/mistakes"),
    },
    {
      key: "srs",
      accent: "amber",
      style: "faded",
      title: t("learn.tileSrsTitle", { defaultValue: "Розумні повторення" }),
      subtitle: t("learn.tileSrsSubtitle", {
        defaultValue: "Питання на сьогодні: {{count}}",
        count: dueReviews,
      }),
      icon: <LearnActionIcon accent="amber" name="idea" />,
      onPress: () => openQuestionMode("seen_not_mastered"),
    },
    {
      key: "traps",
      accent: "amber",
      style: "faded",
      title: t("learn.tileTrapsTitle", { defaultValue: "Питання-пастки" }),
      subtitle: t("learn.tileTrapsSubtitle", {
        defaultValue: "Найчастіше плутають",
      }),
      icon: <LearnActionIcon accent="amber" name="warning" />,
      onPress: () => openQuestionMode("hard_questions"),
    },
  ];

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stack}>
            <ActionTileGrid items={primaryTiles} />

            <ActionTile
              title={t("learn.tileSavedTitle", {
                defaultValue: "Збережені питання",
              })}
              subtitle={t("learn.tileSavedSubtitle", {
                defaultValue: "Переглядай питання з відповідями: {{count}}",
                count: stats.saved,
              })}
              accent="green"
              style="faded"
              icon={<LearnActionIcon accent="green" name="stateDefault" />}
              onPress={() => openQuestionMode("saved")}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("learn.personalizedTitle", {
                defaultValue: "Персоналізоване тренування",
              })}
            </Text>
            <View style={styles.stack}>
              {personalizedTiles.map((tile) => (
                <ActionTile
                  key={tile.key}
                  title={tile.title}
                  subtitle={tile.subtitle}
                  accent={tile.accent}
                  style={tile.style}
                  icon={tile.icon}
                  onPress={tile.onPress}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("learn.topicsByThemeTitle", {
                defaultValue: "Навчання за темами",
              })}
            </Text>
            <View style={styles.stack}>
              {displayTopicIds.map((topic) => {
                const progress = getTopicProgress(topic, questionUserState);

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
                      router.push({
                        pathname: "/topic/[topicId]",
                        params: { topicId: topic },
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.exact(24),
      paddingBottom: spacing.exact(96) + safeBottom,
      gap: spacing.exact(24),
    },
    stack: {
      gap: spacing.exact(8),
    },
    section: {
      gap: spacing.exact(8),
    },
    sectionTitle: {
      ...getTypographyStyle("bodyM"),
      color: colors.ink3,
    },
  }));
}
