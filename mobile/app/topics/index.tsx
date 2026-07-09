import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS } from "@prawko/config";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicReadinessCard } from "../../src/components/shell/TopicReadinessCard";
import { TopicsOverviewCard } from "../../src/components/shell/TopicsOverviewCard";
import {
  getOverallLearningStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { greenWave } from "../../src/theme/green-wave";

export default function TopicsScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );

  const overallStats = useMemo(
    () => getOverallLearningStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

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
            {t("learn.topicsTitle", { defaultValue: "Теми" })}
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
          <TopicsOverviewCard
            readiness={overallStats.readiness}
            answered={overallStats.answered}
            total={overallStats.total}
            correct={overallStats.correct}
            wrong={overallStats.wrong}
          />

          {TOPIC_BLOCK_IDS.map((topic) => {
            const progress = getTopicProgress(topic, questionUserState);

            return (
              <TopicReadinessCard
                key={topic}
                title={t(`topics.${topic}`)}
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
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.48,
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
});
