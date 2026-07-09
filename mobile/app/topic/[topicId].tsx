import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TOPIC_BLOCK_IDS, type TopicBlockId } from "@prawko/config";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TopicSectionsList } from "../../src/components/shell/TopicSectionsList";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";

function isTopicBlockId(value: string): value is TopicBlockId {
  return TOPIC_BLOCK_IDS.includes(value as TopicBlockId);
}

export default function TopicDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const resolvedTopicId = topicId && isTopicBlockId(topicId) ? topicId : TOPIC_BLOCK_IDS[0];
  const topicTitle = t(`topics.${resolvedTopicId}`);
  const backIconSize = responsiveFont(22);

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
              color={colors.textPrimary}
              name="chevron-back"
              size={backIconSize}
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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
      paddingHorizontal: spacing.exact(16),
      paddingTop: spacing.exact(8),
      paddingBottom: spacing.exact(12),
    },
    backButton: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      flex: 1,
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.48,
      color: colors.textPrimary,
    },
    content: {
      padding: spacing.exact(24),
      paddingBottom: spacing.exact(120),
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
