import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import {
  ReadinessIndexCard,
  resolveReadinessLevel,
} from "../../src/components/shell/ReadinessIndexCard";
import { StatusPromptCard } from "../../src/components/shell/StatusPromptCard";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  CText,
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
import {
  READINESS_ASSESSMENT_QUESTION_COUNT,
  resolveLocalReadinessPercent,
} from "../../src/features/questions/readiness-assessment";
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
  const readinessAssessment = useQuestionProgressStore(
    (state) => state.readinessAssessment
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

  const statsRef = useRef(getQuestionDisplayStats(questionUserState));
  const stats = useMemo(() => {
    if (!isFocused) {
      return statsRef.current;
    }

    const next = getQuestionDisplayStats(questionUserState);
    statsRef.current = next;
    return next;
  }, [isFocused, questionCatalogVersion, questionUserState]);

  const localReadiness = resolveLocalReadinessPercent({
    assessmentScorePercent: readinessAssessment?.scorePercent,
    seen: stats.seen,
    total: stats.total,
  });
  const readiness = Math.round(
    readinessSummary?.readinessScore ?? localReadiness
  );
  const isReadinessEmpty =
    stats.seen <= 0 && readinessAssessment == null;
  const readinessLevel = resolveReadinessLevel(readiness);
  const readinessWeekChangePercent = useMemo(() => {
    if (!isFocused || isReadinessEmpty) {
      return null;
    }

    return getCoverageReadinessWeekChangePercent({
      attempts,
      seenQuestionIds: getSeenQuestionIds(questionUserState),
      totalQuestions: stats.total,
    });
  }, [
    attempts,
    isFocused,
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

  const tiles: ActionTileItem[] = [
    {
      key: "trainer",
      accent: "green",
      title: t("dash.tileTrainerTitle", { defaultValue: "Тренування" }),
      subtitle: t("dash.tileTrainerSubtitle", {
        defaultValue: "Вільне тестування",
      }),
      icon: <HomeActionIcon accent="green" name="target" />,
      onPress: () => router.navigate("/trainer-modes"),
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
        router.navigate({
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
      icon: <HomeActionIcon accent="red" name="alert" />,
      onPress: () => router.navigate("/mistakes"),
    },
    {
      key: "traps",
      accent: "amber",
      title: t("dash.tileTrapsTitle", { defaultValue: "Пастки" }),
      subtitle: t("dash.tileTrapsSubtitle", {
        defaultValue: "Часто плутають",
      }),
      icon: <HomeActionIcon accent="amber" name="warning" />,
      onPress: () =>
        router.navigate({
          pathname: "/question",
          params: buildQuestionRouteParams({ mode: "high_points" }),
        }),
    },
  ];

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-home"
      >
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ReadinessIndexCard
            empty={isReadinessEmpty}
            progress={readiness}
            testID="home-readiness-index"
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
                // Untimed training assessment (not exam simulator) — larger than Quick Session.
                router.navigate({
                  pathname: "/question",
                  params: buildQuestionRouteParams({
                    mode: "mini_test",
                    questionLimit: READINESS_ASSESSMENT_QUESTION_COUNT,
                  }),
                });
                return;
              }

              router.navigate("/statistics");
            }}
          />

          <View style={styles.stack}>
            <ActionTile
              fullWidth
              accent="amber"
              title={t("dash.warmupTitle", {
                defaultValue: "Швидка сесія",
              })}
              subtitle={t("dash.warmupDescription", {
                defaultValue: "10 випадкових питань",
              })}
              icon={<HomeActionIcon accent="amber" name="bolt" />}
              onPress={() =>
                router.navigate({
                  pathname: "/question",
                  params: buildQuestionRouteParams({
                    mode: "learning",
                    questionLimit: 10,
                  }),
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
                <CText style={styles.debugPremiumLabel}>
                  {hasPlusAccess ? "DEV Plus: ON" : "DEV Plus: OFF"}
                </CText>
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
              onPress={() => router.navigate("/modals/plan-adjust")}
            />
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
      fontSize: responsiveFont(13),
      letterSpacing: 0.2,
    },
  }));
}
