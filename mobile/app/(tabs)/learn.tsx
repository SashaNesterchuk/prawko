import { router } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../../src/components/icons";
import { ActionTile } from "../../src/components/shell/ActionTile";
import { ActionTileGrid } from "../../src/components/shell/ActionTileGrid";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { ActionTileSection } from "../../src/components/shell/ActionTileSection";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import {
  ReadinessIndexBlock,
  useReadinessCard,
} from "../../src/features/home/ReadinessIndexBlock";
import { QuestionCoverageCard } from "../../src/components/shell/QuestionCoverageCard";
import { ScreenSection } from "../../src/components/shell/ScreenSection";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../../src/features/question-topics/catalog";
import { getQuestionDisplayStats, getTopicProgress } from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useQuestionModeCountDialog } from "../../src/features/questions/useQuestionModeCountDialog";
import { useResponsiveFonts, useResponsiveStyles } from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { getTopicLearnAccess } from "../../src/features/home/roadmap";
import { useShowPremiumMark } from "../../src/features/monetization/v2/store";
import { openTrackedPaywall } from "../../src/features/monetization/v2/analytics";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
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
  const examCountry = useAppShellStore((state) => state.examCountry);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );
  const isFocused = useIsFocused();
  const readiness = useReadinessCard();
  const { openMode, openExam, openBlitz, dialog: countDialog } = useQuestionModeCountDialog();
  const showPremiumMark = useShowPremiumMark();
  const { track } = useAnalytics();

  const stats = useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const topicCardsRef = useRef<
    Array<{
      progress: ReturnType<typeof getTopicProgress>;
      topicId: ReturnType<typeof getQuestionTopicIds>[number];
    }>
  >([]);
  const topicCards = useMemo(() => {
    // Keep Learn cheap while covered by exam/trainer — recomputing every topic
    // on each progress write was freezing the result screen.
    if (!isFocused) {
      return topicCardsRef.current;
    }

    const allTopicIds = getQuestionTopicIds();
    const rows = allTopicIds.map((topicId) => {
      const progress = getTopicProgress(
        topicId,
        questionUserState,
        topicQuestionProgress
      );
      return { topicId, progress };
    });
    const withQuestions = rows.filter((row) => row.progress.total > 0);
    const nextRows = withQuestions.length > 0 ? withQuestions : rows;
    topicCardsRef.current = nextRows;
    return nextRows;
  }, [
    isFocused,
    questionCatalogVersion,
    questionUserState,
    topicQuestionProgress,
  ]);
  const displayTopicCards = topicCards;

  const dueReviews = readiness.dueReviews;

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"]
  ) =>
    router.navigate({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode }),
    });

  const examTitle = t("learn.tileExamTitle", { defaultValue: "Іспит" });
  const trapsTitle = t("learn.tileTrapsTitle", {
    defaultValue: "Питання-пастки",
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
      onPress: () => router.navigate("/trainer-modes"),
    },
    {
      key: "exam",
      accent: "green",
      premium: showPremiumMark,
      title: examTitle,
      subtitle: t("learn.tileExamSubtitle", {
        defaultValue: "Симуляція з таймером",
      }),
      icon: <LearnActionIcon accent="green" name="exam" />,
      onPress: () => openExam(),
    },
  ];

  const mistakesTitle = t("learn.tileMistakesTitle", {
    defaultValue: "Виправити помилки",
  });
  const srsTitle = t("learn.tileSrsTitle", {
    defaultValue: "Розумні повторення",
  });

  const personalizedTiles: ActionTileItem[] = [
    {
      key: "mistakes",
      accent: "red",
      premium: showPremiumMark,
      style: "faded",
      title: mistakesTitle,
      subtitle: t("learn.tileMistakesSubtitle", {
        defaultValue: "Невиправлених помилок: {{count}}",
        count: stats.wrongAnswers,
      }),
      icon: <LearnActionIcon accent="red" name="alert" />,
      onPress: () => {
        if (showPremiumMark) {
          openTrackedPaywall(track, { source: "wrong_answers" });
          return;
        }

        router.navigate("/mistakes");
      },
    },
    {
      key: "srs",
      accent: "amber",
      premium: showPremiumMark,
      style: "faded",
      title: srsTitle,
      subtitle: t("learn.tileSrsSubtitle", {
        defaultValue: "Питання на сьогодні: {{count}}",
        count: dueReviews,
      }),
      icon: <LearnActionIcon accent="amber" name="idea" />,
      onPress: () => {
        if (showPremiumMark) {
          openTrackedPaywall(track, { source: "smart_reviews" });
          return;
        }

        openMode({
          mode: "review_due",
          title: srsTitle,
        });
      },
    },
    {
      key: "traps",
      accent: "amber",
      premium: showPremiumMark,
      style: "faded",
      title: trapsTitle,
      subtitle: t("learn.tileTrapsSubtitle", {
        defaultValue: "Найчастіше плутають",
      }),
      icon: <LearnActionIcon accent="amber" name="warning" />,
      onPress: () => {
        if (showPremiumMark) {
          openTrackedPaywall(track, { source: "trap_questions" });
          return;
        }

        openMode({
          mode: "high_points",
          title: trapsTitle,
        });
      },
    },
  ];

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-learn"
      >
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ReadinessIndexBlock
            readiness={readiness}
            testID="learn-readiness-index"
          />
          {/* {stats.total > 0 ? (
            <QuestionCoverageCard
              correct={stats.seenCorrect}
              seen={stats.seen}
              total={stats.total}
              testID="learn-coverage"
              title={t("question.learnedTitle", {
                defaultValue: "Усі питання",
              })}
              wrong={stats.seenWrong}
            />
          ) : null} */}
          <View style={styles.stack}>
            <ActionTileGrid items={primaryTiles} />

            <ActionTile
              fullWidth
              accent="amber"
              style="faded"
              title={t("learn.tileBlitzTitle", {
                defaultValue: "Швидка сесія",
              })}
              subtitle={t("learn.tileBlitzSubtitle", {
                defaultValue: "Максимум питань за відведений час",
              })}
              icon={<LearnActionIcon accent="amber" name="bolt" />}
              onPress={() =>
                openBlitz({
                  title: t("trainerModes.randomTitle", {
                    defaultValue: "Випадкові питання",
                  }),
                })
              }
              testID="learn-tile-blitz"
            />

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
              testID="learn-tile-saved"
            />
          </View>

          <ActionTileSection
            title={t("learn.personalizedTitle", {
              defaultValue: "Персоналізоване тренування",
            })}
            items={personalizedTiles}
            testIDPrefix="learn-tile"
          />

          <ScreenSection
            title={t("learn.topicsByThemeTitle", {
              defaultValue: "Навчання за темами",
            })}
          >
            {displayTopicCards.map(({ topicId, progress }, index) => {
              const topicAccess = getTopicLearnAccess(examCountry, topicId);
              const topicIsPremium =
                showPremiumMark && topicAccess.kind === "premium";

              return (
                <TopicReadinessCard
                  key={topicId}
                  title={getQuestionTopicTitle(topicId, preferredLocale)}
                  seen={progress.seen}
                  total={progress.total}
                  readiness={progress.progress}
                  correct={progress.correct}
                  wrong={progress.wrong}
                  premium={topicIsPremium}
                  progressTestID={`learn-topic-card-${topicId}`}
                  testID={`learn-topic-card-index-${index}`}
                  onPress={() => {
                    if (topicIsPremium) {
                      openTrackedPaywall(track, {
                        properties: { topic_id: topicId },
                        source: "roadmap",
                        surface: "learn_topic",
                      });
                      return;
                    }

                    router.navigate({
                      pathname: "/topic/[topicId]",
                      params: { topicId },
                    });
                  }}
                />
              );
            })}
          </ScreenSection>
        </ScrollView>
      </SafeAreaView>
      {countDialog}
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
      paddingTop: spacing.exact(12),
      paddingHorizontal: spacing.exact(24),
      paddingBottom: spacing.exact(96) + safeBottom,
      gap: spacing.exact(24),
    },
    stack: {
      gap: spacing.sm,
    },
  }));
}
