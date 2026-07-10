import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { IconPlaceholder } from "../../../components/shell/IconPlaceholder";
import { useTheme } from "../../../providers/ThemeProvider";
import { buildQuestionRouteParams } from "../question-routes";

import type { QuestionTrainingSession } from "./useQuestionTrainingSession";

export function QuestionSessionResultView({
  activeSession,
  resultIconSize,
  sessionMode,
  sessionPassed,
  sessionResultAccent,
  sessionResultPercent,
  summary,
  trainerStyles,
}: Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "resultIconSize"
  | "sessionMode"
  | "sessionPassed"
  | "sessionResultAccent"
  | "sessionResultPercent"
  | "summary"
  | "trainerStyles"
>) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={trainerStyles.resultContainer}>
        <View style={trainerStyles.resultHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}
            onPress={() => router.back()}
            style={trainerStyles.headerButton}
          >
            <Icon name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={trainerStyles.resultBodyArea}>
          <View style={trainerStyles.successBadge}>
            <IconPlaceholder
              color={sessionResultAccent.ink}
              size={resultIconSize}
            />
          </View>

          <Text style={trainerStyles.resultTitle}>
            {sessionPassed
              ? t("question.resultGoodTitle")
              : t("question.resultNeedsWorkTitle")}
          </Text>

          <Text style={trainerStyles.resultPercent}>{sessionResultPercent}%</Text>

          <Text style={trainerStyles.resultCount}>
            {t("question.correctOfTotal", {
              correct: summary.correct,
              total: summary.total,
            })}
          </Text>

          <Text style={trainerStyles.resultBody}>
            {sessionPassed
              ? t("question.resultGoodBody")
              : t("question.resultNeedsWorkBody")}
          </Text>

          <View style={trainerStyles.nextCard}>
            <View style={trainerStyles.nextIconBox}>
              <IconPlaceholder color={colors.textPrimary} />
            </View>
            <View style={trainerStyles.nextCardText}>
              <Text style={trainerStyles.nextTitle}>
                {t("question.nextCategoryTitle")}
              </Text>
              <Text style={trainerStyles.nextSubtitle}>
                {t("question.nextCategorySubtitle")}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: "/question",
              params: buildQuestionRouteParams({
                mode: activeSession?.request.mode ?? sessionMode,
                questionLimit: activeSession?.request.questionLimit,
                studyPlanTaskId: activeSession?.request.studyPlanTaskId,
                topic: activeSession?.request.topic,
              }),
            })
          }
          style={({ pressed }) => [
            trainerStyles.primaryButton,
            pressed ? trainerStyles.pressed : null,
          ]}
        >
          <Text style={trainerStyles.primaryButtonText}>
            {t("question.continueTraining")}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={trainerStyles.reportButton}
          onPress={() => router.back()}
        >
          <Text style={trainerStyles.reportText}>{t("question.later")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
