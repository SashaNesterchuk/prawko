import type { LearningTopicId, QuestionSessionMode } from "@prawko/config";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../../../components/icons";
import { ActionTile } from "../../../components/shell/ActionTile";
import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import {
  QuestionCountDialog,
  resolveQuestionCountDialog,
  toQuestionLimit,
  type QuestionCountSelection,
} from "../../../components/shell/QuestionCountDialog";
import { getLearningTopicTitle } from "../../question-topics/catalog";
import {
  getQuestionCountForMode,
  getTrainerModeStats,
} from "../question-engine";
import { buildQuestionRouteParams } from "../question-routes";
import {
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";
import { type GreenWaveAccent } from "../../../theme/green-wave";
import { useAppShellStore } from "../../../state/app-shell";
import { useQuestionCatalogVersion } from "../../../state/question-catalog";
import { useQuestionProgressStore } from "../../../state/question-progress";

type TrainerModeTile = {
  key: string;
  mode: QuestionSessionMode;
  title: string;
  subtitle: string;
  accent: GreenWaveAccent;
  icon: IconName;
};

type TrainerModesViewProps = {
  /** Scopes every mode to a single topic and titles the screen after it. */
  topic?: LearningTopicId;
};

export function TrainerModesView({ topic }: TrainerModesViewProps) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );

  const [pendingTile, setPendingTile] = useState<TrainerModeTile | null>(null);
  const [selectedCount, setSelectedCount] =
    useState<QuestionCountSelection>("all");

  const stats = useMemo(
    () => getTrainerModeStats(questionUserState, topic, topicQuestionProgress),
    [questionCatalogVersion, questionUserState, topic, topicQuestionProgress]
  );

  const pendingModeCount = useMemo(() => {
    if (!pendingTile) {
      return 0;
    }

    return getQuestionCountForMode(
      { currentCategory: preferredCategory, mode: pendingTile.mode, topic },
      questionUserState,
      topicQuestionProgress
    );
  }, [
    pendingTile,
    preferredCategory,
    questionUserState,
    topic,
    topicQuestionProgress,
  ]);

  const screenTitle = topic
    ? getLearningTopicTitle(topic, preferredLocale, t)
    : t("trainerModes.screenTitle", { defaultValue: "Режим тренування" });

  const primaryTiles: TrainerModeTile[] = [
    topic
      ? {
          key: "topic",
          mode: "learning",
          accent: "green",
          icon: "target",
          title: t("trainerModes.trainTopicTitle", {
            defaultValue: "Тренувати тему",
          }),
          subtitle: t("trainerModes.trainTopicSubtitle", {
            defaultValue: "Питання цієї теми",
          }),
        }
      : {
          key: "random",
          mode: "learning",
          accent: "green",
          icon: "random",
          title: t("trainerModes.randomTitle", {
            defaultValue: "Випадкові питання",
          }),
          subtitle: t("trainerModes.randomSubtitle", {
            defaultValue: "Швидке тренування з різних тем",
          }),
        },
    {
      key: "new",
      mode: "new_questions",
      accent: "green",
      icon: "new",
      title: t("trainerModes.newTitle", { defaultValue: "Нові питання" }),
      subtitle: topic
        ? t("trainerModes.newSubtitleTopic", {
            defaultValue: "Нові питання з цієї теми",
          })
        : t("trainerModes.newSubtitle", {
            defaultValue: "Питання, які ти ще не проходив",
          }),
    },
    {
      key: "saved",
      mode: "saved",
      accent: "green",
      icon: "stateDefault",
      title: t("trainerModes.savedTitle", {
        defaultValue: "Збережені питання",
      }),
      subtitle: t("trainerModes.savedSubtitle", {
        defaultValue: "Питання, які ти зберіг: {{count}}",
        count: stats.saved,
      }),
    },
  ];

  const personalizedTiles: TrainerModeTile[] = [
    topic
      ? {
          key: "mistakes",
          mode: "wrong_answers",
          accent: "red",
          icon: "alert",
          title: t("trainerModes.mistakesTitle", {
            defaultValue: "Виправити помилки",
          }),
          subtitle: t("trainerModes.mistakesSubtitle", {
            defaultValue: "Невиправлених помилок: {{count}}",
            count: stats.wrongAnswers,
          }),
        }
      : {
          key: "weak-topics",
          mode: "weak_spots",
          accent: "red",
          icon: "alert",
          title: t("trainerModes.weakTopicsTitle", {
            defaultValue: "Слабкі теми",
          }),
          subtitle: t("trainerModes.weakTopicsSubtitle", {
            defaultValue: "Автоматично за найнижчою готовністю",
          }),
        },
    {
      key: "high-points",
      mode: "high_points",
      accent: "amber",
      icon: "warning",
      title: t("trainerModes.highPointsTitle", {
        defaultValue: "Складні питання",
      }),
      subtitle: t("trainerModes.highPointsSubtitle", {
        defaultValue: "Питання з вагою 3 бали",
      }),
    },
  ];

  const startMode = (mode: QuestionSessionMode, questionLimit: number | null) => {
    router.navigate({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode, topic, questionLimit }),
    });
  };

  const openCountDialog = (tile: TrainerModeTile) => {
    const availableCount = getQuestionCountForMode(
      { currentCategory: preferredCategory, mode: tile.mode, topic },
      questionUserState,
      topicQuestionProgress
    );
    const { shouldShowDialog, defaultCount } =
      resolveQuestionCountDialog(availableCount);

    if (!shouldShowDialog) {
      startMode(tile.mode, null);
      return;
    }

    setSelectedCount(defaultCount);
    setPendingTile(tile);
  };

  const startPendingMode = () => {
    if (!pendingTile) {
      return;
    }

    const mode = pendingTile.mode;
    setPendingTile(null);

    startMode(mode, toQuestionLimit(selectedCount));
  };

  const renderSection = (sectionTitle: string, tiles: TrainerModeTile[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      <View style={styles.stack}>
        {tiles.map((tile) => (
          <ActionTile
            key={tile.key}
            accent={tile.accent}
            style="faded"
            title={tile.title}
            subtitle={tile.subtitle}
            icon={<TrainerModeIcon accent={tile.accent} name={tile.icon} />}
            onPress={() => openCountDialog(tile)}
            testID={`trainer-mode-${tile.key}`}
          />
        ))}
      </View>
    </View>
  );

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-trainer-modes"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="back"
            accessibilityLabel={t("common.back", { defaultValue: "Назад" })}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle} numberOfLines={2}>
            {screenTitle}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderSection(
            t("trainerModes.primaryTitle", { defaultValue: "Основні режими" }),
            primaryTiles
          )}
          {renderSection(
            t("trainerModes.personalizedTitle", {
              defaultValue: "Персоналізоване тренування",
            }),
            personalizedTiles
          )}
        </ScrollView>
      </SafeAreaView>

      <QuestionCountDialog
        title={pendingTile?.title ?? ""}
        subtitle={t("trainerModes.chooseQuestionCount", {
          defaultValue: "Обери кількість питань",
        })}
        startLabel={t("trainerModes.startCta", { defaultValue: "Почати" })}
        allLabel={t("trainerModes.allQuestions", {
          defaultValue: "Всі ({{count}})",
        })}
        totalCount={pendingModeCount}
        selectedCount={selectedCount}
        visible={pendingTile !== null}
        onClose={() => setPendingTile(null)}
        onSelectCount={setSelectedCount}
        onStart={startPendingMode}
      />
    </GreenWaveScreen>
  );
}

function TrainerModeIcon({
  accent,
  name,
}: {
  accent: GreenWaveAccent;
  name: IconName;
}) {
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();

  return <Icon color={accents[accent].fill} name={name} size={responsiveFont(24)} />;
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
      fontWeight: "600" as const,
      letterSpacing: -0.2,
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.exact(24),
      paddingBottom: spacing.exact(24) + safeBottom,
      gap: spacing.exact(24),
    },
    section: {
      gap: spacing.exact(8),
    },
    sectionTitle: {
      ...getTypographyStyle("bodyM"),
      color: colors.ink3,
    },
    stack: {
      gap: spacing.exact(8),
    },
  }));
}
