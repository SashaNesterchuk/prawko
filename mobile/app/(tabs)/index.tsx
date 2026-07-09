import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { DailyWarmupCard } from "../../src/components/shell/DailyWarmupCard";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { ReadinessIndexCard } from "../../src/components/shell/ReadinessIndexCard";
import { StatusPromptCard } from "../../src/components/shell/StatusPromptCard";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import { getQuestionDisplayStats } from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { Icon, IconName } from "../../src/components/icons";

function HomeActionIcon({
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

export default function HomeTabScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const authMode = useAppShellStore((state) => state.authMode);
  const isFocused = useIsFocused();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
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
          console.warn("Failed to fetch readiness summary for Home.", error);
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

  const localReadiness =
    stats.total > 0 ? Math.round((stats.seen / stats.total) * 100) : 0;
  const readiness = Math.round(
    readinessSummary?.readinessScore ?? localReadiness
  );
  const wrongAnswers = stats.wrongAnswers;
  const dueReviews = readinessSummary?.dueReviews ?? stats.reviewDue;
  const examPassed =
    readinessSummary != null && readinessSummary.daysUntilExam <= 0;
  const recentExamPassed =
    readinessSummary?.recentExamStatus === "completed";

  const readinessSubtitle =
    readiness >= 85
      ? t("dash.readinessHigh", { defaultValue: "Майже готово, тримай темп" })
      : readiness >= 40
        ? t("dash.readinessMid", {
          defaultValue: "Солідний прогрес, ще трохи повторень",
        })
        : t("dash.readinessLow", {
          defaultValue: "Гарний старт, продовжуй практику",
        });

  const warmupBadgeLabel =
    dueReviews > 0
      ? t("dash.warmupBadge", {
        defaultValue: "Повторень: {{count}}",
        count: dueReviews,
      })
      : undefined;

  const tiles: ActionTileItem[] = [
    {
      key: "trainer",
      accent: "green",
      title: t("dash.tileTrainerTitle", { defaultValue: "Тренер" }),
      subtitle: t("dash.tileTrainerSubtitle", {
        defaultValue: "Вільне тестування",
      }),
      icon: <HomeActionIcon accent="green" name="trainer" />,
      onPress: () =>
        router.push({
          pathname: "/question",
          params: buildQuestionRouteParams({ mode: "learning" }),
        }),
    },
    {
      key: "exam",
      accent: "blue",
      title: t("dash.tileExamTitle", { defaultValue: "Іспит" }),
      subtitle: t("dash.tileExamSubtitle", {
        defaultValue: recentExamPassed ? "Симуляція 1/1" : "Симуляція 0/1",
      }),
      icon: <HomeActionIcon accent="blue" name="exam" />,
      onPress: () =>
        router.push({
          pathname: "/exam",
          params: buildExamRouteParams({ mode: "exam" }),
        }),
    },
    {
      key: "mistakes",
      accent: "red",
      title: t("dash.tileMistakesTitle", { defaultValue: "Помилки" }),
      subtitle: t("dash.tileMistakesSubtitle", {
        defaultValue: "{{count}} для повторення",
        count: wrongAnswers,
      }),
      icon: <HomeActionIcon accent="red" name="problem" />,
      onPress: () => router.push("/mistakes"),
    },
    {
      key: "signs",
      accent: "amber",
      title: t("dash.tileSignsTitle", { defaultValue: "Знаки" }),
      subtitle: t("dash.tileSignsSubtitle", {
        defaultValue: "Швидкий тренажер",
      }),
      icon: <HomeActionIcon accent="amber" name="roadSign" />,
      onPress: () => router.push("/(tabs)/signs"),
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
          <ReadinessIndexCard
            progress={readiness}
            title={t("dash.readinessTitle", {
              defaultValue: "Індекс готовності",
            })}
            ringLabel={t("dash.readinessRingLabel", {
              defaultValue: "готовність",
            })}
            subtitle={readinessSubtitle}
            detailsLabel={t("dash.readinessDetails", { defaultValue: "Деталі" })}
            onPress={() => router.push("/statistics")}
          />

          <View style={styles.stack}>
            <DailyWarmupCard
              title={t("dash.warmupTitle", {
                defaultValue: "Щоденна розминка",
              })}
              description={t("dash.warmupDescription", {
                defaultValue: "Повтори слабкі місця та часті помилки.",
              })}
              badgeLabel={warmupBadgeLabel}
              buttonLabel={t("dash.warmupButton", { defaultValue: "Повторити" })}
              onPress={() =>
                router.push({
                  pathname: "/question",
                  params: buildQuestionRouteParams({ mode: "weak_spots" }),
                })
              }
            />

            <ActionTileGrid items={tiles} />
          </View>

          {examPassed ? (
            <StatusPromptCard
              eyebrow={t("dash.statusEyebrow", {
                defaultValue: "Онови свій статус",
              })}
              title={t("dash.statusTitle", {
                defaultValue: "Як пройшов іспит?",
              })}
              onPress={() => router.push("/practice")}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ spacing }) => ({
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
  }));
}
