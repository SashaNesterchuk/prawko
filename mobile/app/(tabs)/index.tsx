import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { DailyWarmupCard } from "../../src/components/shell/DailyWarmupCard";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import {
  ReadinessIndexCard,
  resolveReadinessLevel,
} from "../../src/components/shell/ReadinessIndexCard";
import { StatusPromptCard } from "../../src/components/shell/StatusPromptCard";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import { getCoverageReadinessWeekChangePercent } from "../../src/features/profile/profile-stats";
import {
  getQuestionDisplayStats,
  getSeenQuestionIds,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { useAppShellStore } from "../../src/state/app-shell";
import {
  useEntitlementStore,
  useHasPlusAccess,
} from "../../src/state/entitlements";
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
  const hasPlusAccess = useHasPlusAccess();
  const setDebugPlusOverride = useEntitlementStore(
    (state) => state.setDebugPlusOverride
  );
  const isFocused = useIsFocused();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const attempts = useQuestionProgressStore((state) => state.attempts);
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
  const isReadinessEmpty = stats.seen <= 0;
  const readinessLevel = resolveReadinessLevel(readiness);
  const readinessWeekChangePercent = useMemo(() => {
    // Coverage week-change is local (attempts + seen). Show it even when the
    // ring uses remote readinessScore — Figma always pairs the badge with the
    // covered-questions block.
    if (isReadinessEmpty) {
      return null;
    }

    return getCoverageReadinessWeekChangePercent({
      attempts,
      seenQuestionIds: getSeenQuestionIds(questionUserState),
      totalQuestions: stats.total,
    });
  }, [
    attempts,
    isReadinessEmpty,
    questionCatalogVersion,
    questionUserState,
    stats.total,
  ]);
  const readinessWeekChangeLabel =
    readinessWeekChangePercent == null
      ? undefined
      : readinessWeekChangePercent === 0
        ? t("dash.readinessWeekChangeNone", {
            defaultValue: "Без змін за 7 днів",
          })
        : t("dash.readinessWeekChange", {
            defaultValue: "{{value}}% за 7 днів",
            value: Math.abs(readinessWeekChangePercent),
          });
  const wrongAnswers = stats.wrongAnswers;
  const dueReviews = readinessSummary?.dueReviews ?? stats.reviewDue;
  const examPassed =
    readinessSummary != null && readinessSummary.daysUntilExam <= 0;
  const recentExamPassed =
    readinessSummary?.recentExamStatus === "completed";

  const readinessLevelLabel = t(`dash.readinessLevel.${readinessLevel}`, {
    defaultValue:
      readinessLevel === "high"
        ? "Високий"
        : readinessLevel === "mid"
          ? "Середній"
          : "Низький",
  });

  const warmupBadgeLabel =
    dueReviews > 0
      ? t("dash.warmupBadge", {
        defaultValue: "Повторень: {{count}}",
        count: dueReviews,
      })
      : undefined;

  const openPlusOrPaywall = (open: () => void) => {
    if (hasPlusAccess) {
      open();
      return;
    }

    router.push({
      pathname: "/paywall",
      params: { feature: "premium_access" },
    });
  };

  const tiles: ActionTileItem[] = [
    {
      key: "trainer",
      accent: "green",
      title: t("dash.tileTrainerTitle", { defaultValue: "Тренування" }),
      subtitle: t("dash.tileTrainerSubtitle", {
        defaultValue: "Вільне тестування",
      }),
      icon: <HomeActionIcon accent="green" name="target" />,
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
      subtitle: recentExamPassed
        ? t("dash.tileExamSubtitlePassed", {
          defaultValue: "Симуляція 1/1",
        })
        : t("dash.tileExamSubtitlePending", {
          defaultValue: "Симуляція 0/1",
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
      premium: true,
      title: t("dash.tileMistakesTitle", { defaultValue: "Помилки" }),
      subtitle: t("dash.tileMistakesSubtitle", {
        defaultValue: "{{count}} для повторення",
        count: wrongAnswers,
      }),
      icon: <HomeActionIcon accent="red" name="alert" />,
      onPress: () => openPlusOrPaywall(() => router.push("/mistakes")),
    },
    {
      key: "traps",
      accent: "amber",
      premium: true,
      title: t("dash.tileTrapsTitle", { defaultValue: "Пастки" }),
      subtitle: t("dash.tileTrapsSubtitle", {
        defaultValue: "Часто плутають",
      }),
      icon: <HomeActionIcon accent="amber" name="warning" />,
      onPress: () =>
        openPlusOrPaywall(() =>
          router.push({
            pathname: "/question",
            params: buildQuestionRouteParams({ mode: "hard_questions" }),
          })
        ),
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
            empty={isReadinessEmpty}
            progress={readiness}
            title={t("dash.readinessTitle", {
              defaultValue: "Індекс готовності",
            })}
            subtitle={
              isReadinessEmpty
                ? t("dash.readinessEmptyDescription", {
                    defaultValue:
                      "Пройди швидкий тест, щоб оцінити свій рівень знань.",
                  })
                : undefined
            }
            levelLabel={isReadinessEmpty ? undefined : readinessLevelLabel}
            coveredCountLabel={
              isReadinessEmpty
                ? undefined
                : `${stats.seen} / ${stats.total}`
            }
            coveredCaption={
              isReadinessEmpty
                ? undefined
                : t("dash.readinessCovered", {
                    defaultValue: "Охоплено питань",
                  })
            }
            detailsLabel={
              isReadinessEmpty
                ? t("dash.readinessDetails", {
                    defaultValue: "Оціни знання",
                  })
                : undefined
            }
            weekChangePercent={readinessWeekChangePercent}
            weekChangeLabel={readinessWeekChangeLabel}
            onPress={() => {
              if (isReadinessEmpty) {
                // Figma empty CTA is «Оціни знання» (assess), not «Почати навчання».
                router.push({
                  pathname: "/exam",
                  params: buildExamRouteParams({ mode: "mini_test" }),
                });
                return;
              }

              router.push("/statistics");
            }}
          />

          <View style={styles.stack}>
            <DailyWarmupCard
              title={t("dash.warmupTitle", {
                defaultValue: "Швидка сесія",
              })}
              description={t("dash.warmupDescription", {
                defaultValue: "10 випадкових питань",
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

            {__DEV__ ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDebugPlusOverride(!hasPlusAccess)}
                style={({ pressed }) => [
                  styles.debugPremiumButton,
                  hasPlusAccess
                    ? styles.debugPremiumOn
                    : styles.debugPremiumOff,
                  pressed ? styles.debugPremiumPressed : null,
                ]}
              >
                <Text style={styles.debugPremiumLabel}>
                  {hasPlusAccess ? "DEV Plus: ON" : "DEV Plus: OFF"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {examPassed ? (
            <StatusPromptCard
              eyebrow={t("dash.statusEyebrow", {
                defaultValue: "Онови свій статус",
              })}
              title={t("dash.statusTitle", {
                defaultValue: "Як пройшов іспит?",
              })}
              onPress={() => router.push("/modals/plan-adjust")}
            />
          ) : null}
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
    debugPremiumButton: {
      alignItems: "center",
      borderRadius: spacing.exact(12),
      borderWidth: 1,
      marginTop: spacing.exact(8),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(12),
    },
    debugPremiumOn: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    debugPremiumOff: {
      backgroundColor: colors.paper,
      borderColor: colors.line,
    },
    debugPremiumPressed: {
      opacity: 0.85,
    },
    debugPremiumLabel: {
      color: colors.ink,
      fontFamily: getFontFamily("medium"),
      fontSize: 13,
      letterSpacing: 0.2,
    },
  }));
}
