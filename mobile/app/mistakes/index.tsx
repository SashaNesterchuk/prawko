import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS } from "@prawko/config";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { TopicsOverviewCard } from "../../src/components/shell/TopicsOverviewCard";
import {
  getOverallMistakesStats,
  getTopicMistakeProgress,
} from "../../src/features/questions/question-engine";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

export default function MistakesScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );

  const overallStats = useMemo(
    () => getOverallMistakesStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const topicsWithMistakes = useMemo(
    () =>
      TOPIC_BLOCK_IDS.filter(
        (topic) => getTopicMistakeProgress(topic, questionUserState).wrong > 0
      ),
    [questionCatalogVersion, questionUserState]
  );

  const hasMistakes = overallStats.wrong > 0;

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"],
    topic?: Parameters<typeof buildQuestionRouteParams>[0]["topic"]
  ) =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode, topic }),
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
              color={greenWave.color.ink}
              name="chevron-back"
              size={22}
            />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t("learn.tileMistakesTitle", {
              defaultValue: "Робота над помилками",
            })}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 24 + safeBottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {hasMistakes ? (
            <>
              <TopicsOverviewCard
                title={t("mistakes.overviewTitle", { defaultValue: "Помилки" })}
                answeredLabel={t("mistakes.overviewAnsweredLabel", {
                  defaultValue: "Питань з помилками",
                })}
                readiness={overallStats.readiness}
                answered={overallStats.wrong}
                total={overallStats.total}
                correct={overallStats.correct}
                wrong={overallStats.wrong}
              />

              {topicsWithMistakes.map((topic) => {
                const progress = getTopicMistakeProgress(topic, questionUserState);

                return (
                  <TopicReadinessCard
                    key={topic}
                    title={t(`topics.${topic}`)}
                    seen={progress.seen}
                    total={progress.total}
                    readiness={progress.progress}
                    correct={progress.correct}
                    wrong={progress.wrong}
                    onPress={() => openQuestionMode("wrong_answers", topic)}
                  />
                );
              })}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  color={greenWaveAccent.green.fill}
                  name="thumbs-up-outline"
                  size={40}
                />
              </View>

              <Text style={styles.emptyTitle}>
                {t("mistakes.emptyTitle", { defaultValue: "Помилок немає" })}
              </Text>
              <Text style={styles.emptyDescription}>
                {t("mistakes.emptyDescription", {
                  defaultValue: "Так тримати! Продовжуй тренування.",
                })}
              </Text>

              <View style={styles.emptyActions}>
                <ActionTile
                  accent="red"
                  premium
                  title={t("learn.tileTrapsTitle", {
                    defaultValue: "Питання-пастки",
                  })}
                  subtitle={t("learn.tileTrapsSubtitle", {
                    defaultValue: "Найчастіше плутають",
                  })}
                  icon={
                    <Ionicons
                      color={greenWaveAccent.red.fill}
                      name="alert-circle-outline"
                      size={24}
                    />
                  }
                  onPress={() => openQuestionMode("hard_questions")}
                />
                <ActionTile
                  accent="blue"
                  premium
                  title={t("learn.tileSrsTitle", {
                    defaultValue: "Розумні повторення",
                  })}
                  subtitle={t("learn.tileSrsSubtitle", {
                    defaultValue: "Повторюй в оптимальний момент",
                  })}
                  icon={
                    <Ionicons
                      color={greenWaveAccent.blue.fill}
                      name="refresh-outline"
                      size={24}
                    />
                  }
                  onPress={() => openQuestionMode("seen_not_mastered")}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.surface,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: greenWave.spacing.xl,
  },
  emptyIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xl,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.paper,
  },
  emptyTitle: {
    marginTop: greenWave.spacing.xl,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.64,
    color: greenWave.color.ink,
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: greenWave.spacing.lg,
    fontSize: 18,
    lineHeight: 28,
    color: greenWave.color.inkSecondary,
    textAlign: "center",
  },
  emptyActions: {
    width: "100%",
    marginTop: greenWave.spacing.xl,
    gap: greenWave.spacing.sm,
  },
});
