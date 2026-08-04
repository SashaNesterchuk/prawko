import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import { useTheme } from "../../../providers/ThemeProvider";
import { buildQuestionRouteParams } from "../question-routes";

import type { QuestionTrainingSession } from "./useQuestionTrainingSession";

export function QuestionSessionResultView({
  activeSession,
  onClose,
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
> & {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hasNoMistakes = summary.wrong === 0 && summary.total > 0;
  const tipIconName = hasNoMistakes ? "cup" : "alert";
  const tipTitle = hasNoMistakes
    ? t("question.resultNoMistakesTitle")
    : t("question.resultReviewMistakesTitle");
  const tipSubtitle = hasNoMistakes
    ? t("question.resultNoMistakesSubtitle")
    : t("question.resultReviewMistakesSubtitle", { count: summary.wrong });

  return (
    <GreenWaveScreen>
      <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={trainerStyles.resultContainer}>
          <View style={trainerStyles.resultHeader}>
            <NavigationButton
              inset
              type="close"
              accessibilityLabel={t("common.close")}
              onPress={onClose}
            />
          </View>

          <View style={trainerStyles.resultBodyArea}>
            <View
              style={[
                trainerStyles.successBadge,
                { backgroundColor: sessionResultAccent.fill },
              ]}
            >
              <Icon
                name={sessionPassed ? "check" : "warning"}
                color={colors.white}
                size={resultIconSize}
              />
            </View>

            <Text style={trainerStyles.resultTitle}>
              {hasNoMistakes
                ? t("question.resultPerfectTitle")
                : sessionPassed
                  ? t("question.resultGoodTitle")
                  : t("question.resultNeedsWorkTitle")}
            </Text>

            <Text style={trainerStyles.resultPercent}>
              {sessionResultPercent}%
            </Text>

            <Text style={trainerStyles.resultCount}>
              {t("question.correctOfTotal", {
                correct: summary.correct,
                total: summary.total,
              })}
            </Text>

            <Text style={trainerStyles.resultBody}>
              {hasNoMistakes
                ? t("question.resultPerfectBody")
                : sessionPassed
                  ? t("question.resultGoodBody")
                  : t("question.resultNeedsWorkBody")}
            </Text>

            <View style={trainerStyles.nextCard}>
              <View style={trainerStyles.nextIconBox}>
                <Icon name={tipIconName} color={colors.textPrimary} size={24} />
              </View>
              <View style={trainerStyles.nextCardText}>
                <Text style={trainerStyles.nextTitle}>{tipTitle}</Text>
                <Text style={trainerStyles.nextSubtitle}>{tipSubtitle}</Text>
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
            onPress={onClose}
          >
            <Text style={trainerStyles.reportText}>{t("question.later")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}
