import { router } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { HomeStartSpotlightLayer } from "../../src/components/shell/HomeStartSpotlightHost";
import { HomeTodayStartCard } from "../../src/components/shell/HomeTodayStartCard";
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
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import {
  FIRST_START_QUESTION_COUNT,
  shouldShowHomeStartSpotlight,
  type FirstStartCtaSource,
} from "../../src/features/home/first-start";
import {
  createHomeDailySessionKey,
  getHomeDailyPracticeStatus,
  getHomeDailyRemainingCount,
  HOME_DAILY_QUESTION_COUNT,
  isHomeTodayStartCardVisible,
} from "../../src/features/home/home-daily-practice";
import {
  getReadinessPeriodChange,
  resolveReadinessPeriodChangeLabelKey,
} from "../../src/features/profile/profile-stats";
import { getQuestionDisplayStats } from "../../src/features/questions/question-engine";
import { resolveReadinessScore } from "../../src/features/questions/readiness-score";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useQuestionModeCountDialog } from "../../src/features/questions/useQuestionModeCountDialog";
import { getDaysUntilExamFromDate } from "../../src/features/study-plan/generate-local-study-plan";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { useAppShellStore, useCurrentUser } from "../../src/state/app-shell";
import {
  useEntitlementStore,
  useHasPlusAccess,
} from "../../src/state/entitlements";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogVersion,
} from "../../src/state/question-catalog";
import {
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../../src/state/question-progress";
import {
  resolveReadinessView,
  useReadinessSnapshot,
  useReadinessSnapshotHydrated,
  useReadinessSnapshotStore,
  type ReadinessSnapshot,
} from "../../src/state/readiness-snapshot";
import { isE2EHomeChromeUnlocked } from "../../src/testing/e2e/state";
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
  const { track } = useAnalytics();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const authMode = useAppShellStore((state) => state.authMode);
  const examDate = useAppShellStore((state) => state.studyPlanSetup.examDate);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const homeStartSpotlightDismissed = useAppShellStore(
    (state) => state.homeStartSpotlightDismissed
  );
  const dismissHomeStartSpotlight = useAppShellStore(
    (state) => state.dismissHomeStartSpotlight
  );
  const hasPlusAccess = useHasPlusAccess();
  const setDebugPlusOverride = useEntitlementStore(
    (state) => state.setDebugPlusOverride
  );
  const isFocused = useIsFocused();
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  const questionCatalogVersion = useQuestionCatalogVersion();
  const catalogResolved = useQuestionCatalogResolved();
  const progressHydrated = useQuestionProgressHydrated();
  const readinessSnapshot = useReadinessSnapshot();
  const readinessSnapshotHydrated = useReadinessSnapshotHydrated();
  const saveReadinessSnapshot = useReadinessSnapshotStore(
    (state) => state.saveSnapshot
  );
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const homeDailySession = useQuestionProgressStore(
    (state) => state.homeDailySession
  );
  const readinessAssessment = useQuestionProgressStore(
    (state) => state.readinessAssessment
  );
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);
  const { openMode, openExam, openBlitz, dialog: countDialog } =
    useQuestionModeCountDialog();
  const readinessCardRef = useRef<View>(null);
  const readinessCardLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const [readinessCardLayoutNonce, setReadinessCardLayoutNonce] = useState(0);
  const didTrackSpotlightRef = useRef(false);
  const unlockHomeChrome = isE2EHomeChromeUnlocked();

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

  const readiness = resolveReadinessScore(readinessSummary?.readinessScore, {
    attempts,
    userStates: questionUserState,
    planCompletionPercent: readinessSummary?.planCompletionPercent,
    totalQuestions: stats.total,
  });
  const isLiveReadinessEmpty = stats.seen <= 0 && readinessAssessment == null;
  const readinessPeriodChange = useMemo(() => {
    if (!isFocused || isLiveReadinessEmpty) {
      return null;
    }

    return getReadinessPeriodChange({
      attempts,
      userStates: questionUserState,
      planCompletionPercent: readinessSummary?.planCompletionPercent,
      totalQuestions: stats.total,
      currentReadiness: readiness,
    });
  }, [
    attempts,
    isFocused,
    isLiveReadinessEmpty,
    questionUserState,
    readiness,
    readinessSummary?.planCompletionPercent,
    stats.total,
  ]);
  const liveReadiness = useMemo<ReadinessSnapshot>(
    () => ({
      isEmpty: isLiveReadinessEmpty,
      percent: readiness,
      seen: stats.seen,
      total: stats.total,
      weekChangePercent: readinessPeriodChange?.deltaPercent ?? null,
      weekChangePeriodDays: readinessPeriodChange?.periodDays ?? null,
      userId: currentUserId,
    }),
    [
      currentUserId,
      isLiveReadinessEmpty,
      readiness,
      readinessPeriodChange,
      stats.seen,
      stats.total,
    ]
  );
  // The progress blob and the remote catalog both settle late, so the card
  // paints the last resolved snapshot instead of flashing the empty CTA.
  const isLiveReadinessResolved = progressHydrated && catalogResolved;
  const readinessView = resolveReadinessView({
    live: liveReadiness,
    snapshot: readinessSnapshot,
    currentUserId,
    isLiveResolved: isLiveReadinessResolved,
    isProgressHydrated: progressHydrated,
    isSnapshotHydrated: readinessSnapshotHydrated,
  });

  useEffect(() => {
    if (!isFocused || !isLiveReadinessResolved || !readinessSnapshotHydrated) {
      return;
    }

    saveReadinessSnapshot(liveReadiness);
  }, [
    isFocused,
    isLiveReadinessResolved,
    liveReadiness,
    readinessSnapshotHydrated,
    saveReadinessSnapshot,
  ]);

  const isReadinessLoading = readinessView == null;
  const isReadinessEmpty = readinessView?.isEmpty ?? false;
  const showStartSpotlight = shouldShowHomeStartSpotlight({
    isReadinessEmpty,
    isReadinessLoading,
    spotlightDismissed: homeStartSpotlightDismissed,
    unlockHomeChrome,
  });
  const readinessPercent = readinessView?.percent ?? 0;
  const readinessLevel = resolveReadinessLevel(readinessPercent);
  const readinessWeekChangePercent = readinessView?.weekChangePercent ?? null;
  const readinessWeekChangePeriodDays =
    readinessView?.weekChangePeriodDays ?? null;
  const readinessWeekChangeLabel =
    readinessWeekChangePeriodDays == null
      ? undefined
      : t(
        `dash.${resolveReadinessPeriodChangeLabelKey(
          readinessWeekChangePeriodDays
        )}`,
        {
          days: readinessWeekChangePeriodDays,
          value: Math.abs(readinessWeekChangePercent ?? 0),
        }
      );
  const wrongAnswers = stats.wrongAnswers;
  const examPassed =
    readinessSummary != null && readinessSummary.daysUntilExam <= 0;

  const readinessLevelLabel = t(`dash.readinessLevel.${readinessLevel}`, {
    defaultValue:
      readinessLevel === "high"
        ? "Високий"
        : readinessLevel === "mid"
          ? "Середній"
          : "Низький",
  });

  const examTitle = t("dash.tileExamTitle", { defaultValue: "Іспит" });
  const trapsTitle = t("dash.tileTrapsTitle", { defaultValue: "Пастки" });
  const examDaysRemaining = examDate
    ? getDaysUntilExamFromDate(examDate)
    : null;
  const todayIso = getWarsawIsoDate();
  const homeDailyStatus = getHomeDailyPracticeStatus({
    session: homeDailySession,
    today: todayIso,
    category: preferredCategory,
  });
  const homeDailyRemaining =
    homeDailyStatus === "in_progress" && homeDailySession
      ? getHomeDailyRemainingCount(homeDailySession)
      : HOME_DAILY_QUESTION_COUNT;
  const openHomeDailySession = useCallback(
    (source: FirstStartCtaSource) => {
      if (homeDailyStatus === "done") {
        return;
      }

      if (source !== "today") {
        dismissHomeStartSpotlight();
        track(ANALYTICS_EVENTS.firstStartStarted.key, {
          question_limit: FIRST_START_QUESTION_COUNT,
          source,
        });
      }

      const sessionMode =
        source === "today" ? "mini_test" : "initial_diagnostic";

      track(ANALYTICS_EVENTS.trainingModeSelected.key, {
        mode: sessionMode,
        question_limit: FIRST_START_QUESTION_COUNT,
        source,
        topic_id: null,
      });
      router.navigate({
        pathname: "/question",
        params: buildQuestionRouteParams({
          mode: sessionMode,
          questionLimit: HOME_DAILY_QUESTION_COUNT,
          sessionKey: createHomeDailySessionKey(todayIso, preferredCategory),
        }),
      });
    },
    [
      dismissHomeStartSpotlight,
      homeDailyStatus,
      preferredCategory,
      todayIso,
      track,
    ]
  );

  const startFirstSession = useCallback(
    (source: FirstStartCtaSource) => {
      openHomeDailySession(source);
    },
    [openHomeDailySession]
  );

  const startTodaySession = useCallback(() => {
    openHomeDailySession("today");
  }, [openHomeDailySession]);

  useEffect(() => {
    if (!showStartSpotlight || didTrackSpotlightRef.current) {
      return;
    }

    didTrackSpotlightRef.current = true;
    track(ANALYTICS_EVENTS.firstStartShown.key, {
      question_limit: FIRST_START_QUESTION_COUNT,
    });
  }, [showStartSpotlight, track]);

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
      accent: "green",
      title: examTitle,
      subtitle: t("dash.tileExamSubtitle", {
        defaultValue: "Симуляція з таймером",
      }),
      icon: <HomeActionIcon accent="green" name="exam" />,
      onPress: () => openExam(),
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
      title: trapsTitle,
      subtitle: t("dash.tileTrapsSubtitle", {
        defaultValue: "Часто плутають",
      }),
      icon: <HomeActionIcon accent="amber" name="warning" />,
      onPress: () =>
        openMode({
          mode: "high_points",
          title: trapsTitle,
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
          <View
            ref={readinessCardRef}
            collapsable={false}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              const previous = readinessCardLayoutRef.current;
              if (
                previous.x === x &&
                previous.y === y &&
                previous.width === width &&
                previous.height === height
              ) {
                return;
              }

              readinessCardLayoutRef.current = { x, y, width, height };
              if (showStartSpotlight) {
                setReadinessCardLayoutNonce((current) => current + 1);
              }
            }}
          >
            <ReadinessIndexCard
            empty={isReadinessEmpty}
            loading={isReadinessLoading}
            progress={readinessPercent}
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
              isReadinessEmpty || !readinessView
                ? undefined
                : `${readinessView.seen} / ${readinessView.total}`
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
                  defaultValue: "Пройти тест",
                })
                : undefined
            }
            weekChangePercent={readinessWeekChangePercent}
            weekChangeLabel={readinessWeekChangeLabel}
            onPress={() => {
              if (isReadinessEmpty) {
                startFirstSession(showStartSpotlight ? "spotlight" : "card");
                return;
              }

              router.navigate("/statistics");
            }}
            />
          </View>

          {!isReadinessEmpty && isHomeTodayStartCardVisible(homeDailyStatus) ? (
            <HomeTodayStartCard
              completed={homeDailyStatus === "done"}
              examCountdownLabel={
                examDaysRemaining != null && examDaysRemaining > 0
                  ? t("dash.examCountdown", {
                      count: examDaysRemaining,
                      days: examDaysRemaining,
                      defaultValue: "Do egzaminu: {{days}} dni",
                    })
                  : null
              }
              title={
                homeDailyStatus === "done"
                  ? t("dash.todayStartDoneTitle", {
                      defaultValue: "Na dziś gotowe",
                    })
                  : t("dash.todayStartTitle", {
                      count: FIRST_START_QUESTION_COUNT,
                      defaultValue: "Dzis: {{count}} pytan",
                    })
              }
              subtitle={
                homeDailyStatus === "done"
                  ? t("dash.todayStartDoneSubtitle", {
                      defaultValue: "Nowe pytania jutro",
                    })
                  : homeDailyStatus === "in_progress" &&
                      homeDailyRemaining < HOME_DAILY_QUESTION_COUNT
                    ? t("dash.todayStartContinueSubtitle", {
                        remaining: homeDailyRemaining,
                        defaultValue: "Zostalo {{remaining}} · bez limitu czasu",
                      })
                    : t("dash.todayStartSubtitle", {
                        defaultValue: "Krotka sesja bez limitu czasu",
                      })
              }
              onPress={
                homeDailyStatus === "done" ? undefined : startTodaySession
              }
            />
          ) : null}

          <View style={styles.stack}>
            <ActionTile
              fullWidth
              accent="amber"
              title={t("dash.warmupTitle", {
                defaultValue: "Швидка сесія",
              })}
              subtitle={t("dash.warmupDescription", {
                defaultValue: "Максимум питань за відведений час",
              })}
              icon={<HomeActionIcon accent="amber" name="bolt" />}
              onPress={() =>
                openBlitz({
                  title: t("trainerModes.randomTitle", {
                    defaultValue: "Випадкові питання",
                  }),
                })
              }
              testID="home-tile-blitz"
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
      {countDialog}
      <HomeStartSpotlightLayer
        visible={showStartSpotlight}
        anchorRef={readinessCardRef}
        layoutNonce={readinessCardLayoutNonce}
        title={t("dash.firstStartSpotlightTitle", {
          defaultValue: "Zrób szybki test wiedzy",
        })}
        body={t("dash.firstStartSpotlightBody", {
          count: FIRST_START_QUESTION_COUNT,
          defaultValue:
            "{{count}} pytań, bez limitu czasu. Zaraz zobaczysz, na czym stoisz.",
        })}
        skipLabel={t("dash.firstStartSpotlightSkip", {
          defaultValue: "Pozniej",
        })}
        onStart={() => startFirstSession("spotlight")}
        onSkip={() => {
          dismissHomeStartSpotlight();
          track(ANALYTICS_EVENTS.firstStartSkipped.key, {
            question_limit: FIRST_START_QUESTION_COUNT,
          });
        }}
      />
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
      paddingTop: spacing.exact(24),
      paddingHorizontal: spacing.exact(24),
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
    },
  }));
}
