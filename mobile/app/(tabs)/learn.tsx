import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS, type TopicBlockId } from "@prawko/config";

import { ActionTile } from "../../src/components/shell/ActionTile";
import type { ActionTileItem } from "../../src/components/shell/ActionTileGrid";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { JourneyCard } from "../../src/components/shell/JourneyCard";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import { getTopicProgress } from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  buildLocalTodayPlan,
  fetchRemoteTodayPlan,
  getWarsawIsoDate,
  type RemoteTodayPlan,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import {
  useAppShellStore,
  useCurrentStudyPlan,
} from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

function resolveCurrentTopicId(
  questionUserState: ReturnType<
    typeof useQuestionProgressStore.getState
  >["questionUserState"]
): TopicBlockId {
  for (const topic of TOPIC_BLOCK_IDS) {
    const progress = getTopicProgress(topic, questionUserState);
    if (progress.seen < progress.total) {
      return topic;
    }
  }

  return TOPIC_BLOCK_IDS[0];
}

function LearnActionIcon({
  accent,
  name,
}: {
  accent: keyof typeof greenWaveAccent;
  name: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Ionicons
      color={greenWaveAccent[accent].fill}
      name={name}
      size={24}
    />
  );
}

export default function LearnTabScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const currentStudyPlan = useCurrentStudyPlan();
  const isFocused = useIsFocused();
  const [remoteTodayPlan, setRemoteTodayPlan] = useState<RemoteTodayPlan | null>(
    null
  );

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setRemoteTodayPlan(null);
      return;
    }

    let cancelled = false;

    void fetchRemoteTodayPlan()
      .then((todayPlan) => {
        if (!cancelled) {
          setRemoteTodayPlan(todayPlan);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch remote today plan for Learn.", error);
          setRemoteTodayPlan(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, currentStudyPlanRemoteId, isFocused]);

  const todayPlan = useMemo(
    () => remoteTodayPlan ?? buildLocalTodayPlan(currentStudyPlan, getWarsawIsoDate()),
    [currentStudyPlan, remoteTodayPlan]
  );

  const currentTopicId = useMemo(
    () => resolveCurrentTopicId(questionUserState),
    [questionCatalogVersion, questionUserState]
  );
  const currentTopicProgress = useMemo(
    () => getTopicProgress(currentTopicId, questionUserState),
    [currentTopicId, questionCatalogVersion, questionUserState]
  );
  const currentTopicIndex = TOPIC_BLOCK_IDS.indexOf(currentTopicId);

  const journeyProgress =
    currentTopicProgress.total > 0
      ? Math.round(
          (currentTopicProgress.seen / currentTopicProgress.total) * 100
        )
      : 0;
  const nextTaskTitle =
    todayPlan?.tasks.find(
      (task) => task.status === "pending" || task.status === "in_progress"
    )?.title ??
    t("learn.journeyNextFallback", {
      defaultValue: "Контроль: знаки + першість",
    });

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode }),
    });

  const actionTiles: ActionTileItem[] = [
    {
      key: "trainer",
      accent: "green",
      title: t("learn.tileTrainerTitle", { defaultValue: "Тренер" }),
      subtitle: t("learn.tileTrainerSubtitleShort", {
        defaultValue: "Вільне тестування",
      }),
      icon: <LearnActionIcon accent="green" name="barbell-outline" />,
      onPress: () => openQuestionMode("learning"),
    },
    {
      key: "topics",
      accent: "green",
      title: t("learn.topicsTitle", { defaultValue: "Теми" }),
      subtitle: t("learn.tileTopicsSubtitle", {
        defaultValue: "Тренування по темам",
      }),
      icon: <LearnActionIcon accent="green" name="list-outline" />,
      onPress: () => router.push("/topics"),
    },
    {
      key: "exam",
      accent: "blue",
      title: t("learn.tileExamTitle", { defaultValue: "Симуляція іспиту" }),
      subtitle: t("learn.tileExamSubtitle", {
        defaultValue: "Офіційний формат, на час",
      }),
      icon: <LearnActionIcon accent="blue" name="timer-outline" />,
      onPress: () =>
        router.push({
          pathname: "/exam",
          params: buildExamRouteParams({ mode: "exam" }),
        }),
    },
    {
      key: "mistakes",
      accent: "amber",
      title: t("learn.tileMistakesTitle", {
        defaultValue: "Робота над помилками",
      }),
      subtitle: t("learn.tileMistakesSubtitle", {
        defaultValue: "Виправ свої помилки",
      }),
      icon: <LearnActionIcon accent="amber" name="warning-outline" />,
      onPress: () => router.push("/mistakes"),
    },
    {
      key: "traps",
      accent: "red",
      premium: true,
      title: t("learn.tileTrapsTitle", { defaultValue: "Питання-пастки" }),
      subtitle: t("learn.tileTrapsSubtitle", {
        defaultValue: "Найчастіше плутають",
      }),
      icon: <LearnActionIcon accent="red" name="alert-circle-outline" />,
      onPress: () => openQuestionMode("hard_questions"),
    },
    {
      key: "srs",
      accent: "blue",
      premium: true,
      title: t("learn.tileSrsTitle", { defaultValue: "Розумні повторення" }),
      subtitle: t("learn.tileSrsSubtitle", {
        defaultValue: "Повторюй в оптимальний момент",
      }),
      icon: <LearnActionIcon accent="blue" name="refresh-outline" />,
      onPress: () => openQuestionMode("seen_not_mastered"),
    },
  ];

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 96 + safeBottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <JourneyCard
            eyebrow={t("learn.journeyEyebrow", { defaultValue: "Подорож" })}
            title={t(`topics.${currentTopicId}`)}
            sectionLabel={t("learn.journeySectionIndex", {
              defaultValue: "Секція {{current}} з {{total}}",
              current: currentTopicIndex + 1,
              total: TOPIC_BLOCK_IDS.length,
            })}
            progress={journeyProgress}
            nextLabel={t("learn.journeyNextLabel", { defaultValue: "Далі:" })}
            nextValue={nextTaskTitle}
            buttonLabel={t("learn.journeyButton", {
              defaultValue: "Продовжити",
            })}
            onPress={() =>
              router.push({
                pathname: "/question",
                params: buildQuestionRouteParams({
                  mode: "learning",
                  topic: currentTopicId,
                }),
              })
            }
          />

          <View style={styles.stack}>
            {actionTiles.map((tile) => (
              <ActionTile
                key={tile.key}
                title={tile.title}
                subtitle={tile.subtitle}
                accent={tile.accent}
                premium={tile.premium}
                icon={tile.icon}
                onPress={tile.onPress}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.xl,
  },
  stack: {
    gap: greenWave.spacing.sm,
  },
});
