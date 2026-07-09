import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS, type TopicBlockId } from "@prawko/config";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicSectionsList } from "../../src/components/shell/TopicSectionsList";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { greenWave } from "../../src/theme/green-wave";

function isTopicBlockId(value: string): value is TopicBlockId {
  return TOPIC_BLOCK_IDS.includes(value as TopicBlockId);
}

export default function TopicDetailScreen() {
  const { t } = useTranslation();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const resolvedTopicId = topicId && isTopicBlockId(topicId) ? topicId : TOPIC_BLOCK_IDS[0];
  const topicTitle = t(`topics.${resolvedTopicId}`);

  const openTopicTraining = () =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: "learning",
        topic: resolvedTopicId,
      }),
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {topicTitle}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TopicSectionsList
            topicId={resolvedTopicId}
            onSectionPress={openTopicTraining}
          />
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
  content: {
    padding: greenWave.spacing.xl,
    paddingBottom: 120,
  },
  pressed: {
    opacity: 0.9,
  },
});
