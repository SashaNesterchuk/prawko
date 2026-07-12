import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { IconPlaceholder } from "../../../components/shell/IconPlaceholder";
import { TrainingExitDialog } from "../../../components/shell/TrainingExitDialog";
import { useTheme } from "../../../providers/ThemeProvider";
import {
  getLocalizedText,
  isQuestionMastered,
} from "../question-engine";
import { QuestionMediaCard } from "../QuestionMediaCard";
import { QuestionChoiceOption } from "./QuestionChoiceOption";
import { QuestionStepPill } from "./QuestionStepPill";
import type { QuestionTrainingSession } from "./useQuestionTrainingSession";
import { getQuestionStepState } from "./visible-steps";
import { Icon } from "../../../components/icons";

type QuestionTrainingViewProps = Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "advanceSession"
  | "aiIconSize"
  | "currentAnswer"
  | "currentAnswerCorrect"
  | "currentQuestion"
  | "currentQuestionId"
  | "currentQuestionState"
  | "displayLocale"
  | "feedbackAccent"
  | "handleAnswer"
  | "handleConfirmExit"
  | "handleDismissExitDialog"
  | "handleRequestExit"
  | "handleToggleBookmark"
  | "masteryProgress"
  | "questionChoices"
  | "showExitDialog"
  | "summary"
  | "trainerStyles"
  | "visibleSteps"
>;

export function QuestionTrainingView({
  activeSession,
  advanceSession,
  aiIconSize,
  currentAnswer,
  currentAnswerCorrect,
  currentQuestion,
  currentQuestionId,
  currentQuestionState,
  displayLocale,
  feedbackAccent,
  handleAnswer,
  handleConfirmExit,
  handleDismissExitDialog,
  handleRequestExit,
  handleToggleBookmark,
  masteryProgress,
  questionChoices,
  showExitDialog,
  summary,
  trainerStyles,
  visibleSteps,
}: QuestionTrainingViewProps) {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();

  const hasAnswered = Boolean(currentAnswer);
  const isCorrectAnswer = currentAnswerCorrect;
  const isBooleanQuestion = currentQuestion.answerType === "boolean";
  const totalQuestions = summary.total || activeSession!.questionIds.length;
  const currentStep = activeSession!.currentIndex + 1;
  const explanationText = getLocalizedText(
    currentQuestion.explanation,
    displayLocale
  );
  const scopeLabel = t(`question.scopes.${currentQuestion.scope}`);
  const showMasteryProgress =
    isCorrectAnswer &&
    !isQuestionMastered(currentQuestionState) &&
    currentQuestionState.timesWrong > 0;

  return (
    <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={trainerStyles.container}>
        <View style={trainerStyles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={handleRequestExit}
            style={trainerStyles.headerButton}
          >
            <Icon name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={trainerStyles.headerCenter}>
            <Text style={trainerStyles.headerTitle}>
              {t("question.trainerTitle")}
            </Text>
            <Text style={trainerStyles.headerCounter}>
              {currentStep} / {totalQuestions}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={trainerStyles.stepperScroll}
          contentContainerStyle={trainerStyles.stepper}
        >
          {visibleSteps.map(({ questionId, index }) => (
            <QuestionStepPill
              key={questionId}
              index={index}
              stepState={getQuestionStepState(
                activeSession!.answers[questionId],
                index,
                activeSession!.currentIndex
              )}
            />
          ))}
        </ScrollView>

        <View style={trainerStyles.metaRow}>
          <Text style={trainerStyles.metaText}>{scopeLabel}</Text>
          <Text style={trainerStyles.metaText}>
            {t("question.pointsLabel", { points: currentQuestion.points })}
          </Text>
        </View>

        <ScrollView
          style={trainerStyles.body}
          contentContainerStyle={trainerStyles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {currentQuestion.media ? (
            <View style={trainerStyles.mediaBleed}>
              <QuestionMediaCard
                locale={displayLocale}
                media={currentQuestion.media}
              />
            </View>
          ) : null}

          <Text style={trainerStyles.prompt}>
            {getLocalizedText(currentQuestion.prompt, displayLocale)}
          </Text>

          <View
            style={
              isBooleanQuestion
                ? trainerStyles.booleanOptions
                : trainerStyles.options
            }
          >
            {questionChoices.map((choice) => (
              <QuestionChoiceOption
                key={choice.id}
                choice={choice}
                hasAnswered={hasAnswered}
                isBooleanQuestion={isBooleanQuestion}
                isCorrectChoice={currentQuestion.correctAnswer === choice.id}
                isSelected={currentAnswer?.selectedAnswer === choice.id}
                onPress={() => handleAnswer(choice.id)}
              />
            ))}
          </View>
        </ScrollView>

        {hasAnswered ? (
          <View style={trainerStyles.feedbackCard}>
            <View style={trainerStyles.feedbackHeader}>
              <IconPlaceholder color={feedbackAccent.ink} />
              <Text style={trainerStyles.feedbackTitle}>
                {isCorrectAnswer
                  ? t("question.resultCorrect")
                  : t("question.resultWrong")}
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => handleToggleBookmark(currentQuestionId)}
              >
                <IconPlaceholder
                  color={
                    currentQuestionState.isBookmarked
                      ? accents.amber.fill
                      : colors.textMuted
                  }
                />
              </Pressable>
            </View>

            {explanationText ? (
              <Text style={trainerStyles.feedbackBody}>{explanationText}</Text>
            ) : null}

            {showMasteryProgress ? (
              <Text style={trainerStyles.masteryProgress}>
                {t("question.masteryProgress", {
                  current: masteryProgress.current,
                  target: masteryProgress.target,
                  defaultValue: "Закріплення: {{current}}/{{target}}",
                })}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              style={trainerStyles.explainRow}
              onPress={() =>
                router.push({
                  pathname: "/modals/ai-chat",
                  params: {
                    questionId: currentQuestionId,
                    locale: displayLocale,
                    selectedAnswer: currentAnswer?.selectedAnswer,
                  },
                })
              }
            >
              <Text style={trainerStyles.explainText}>
                {isCorrectAnswer
                  ? t("question.explainOthers")
                  : t("question.explainMistake")}
              </Text>
              <View style={trainerStyles.aiBadge}>
                <IconPlaceholder color={colors.onAccent} size={aiIconSize} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => advanceSession()}
              style={({ pressed }) => [
                trainerStyles.primaryButton,
                pressed ? trainerStyles.pressed : null,
              ]}
            >
              <Text style={trainerStyles.primaryButtonText}>
                {summary.answered >= summary.total
                  ? t("question.finish")
                  : isCorrectAnswer
                    ? t("question.nextQuestion")
                    : t("question.gotIt")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={trainerStyles.reportButton}
              onPress={() => router.back()}
            >
              <Text style={trainerStyles.reportText}>
                {t("question.reportProblem")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={trainerStyles.reportButton}
            onPress={() => router.back()}
          >
            <Text style={trainerStyles.reportText}>
              {t("question.reportProblem")}
            </Text>
          </Pressable>
        )}
      </View>

      <TrainingExitDialog
        body={t("question.exitConfirmBody")}
        continueLabel={t("question.exitConfirmContinue")}
        finishLabel={t("question.exitConfirmFinish")}
        onContinue={handleDismissExitDialog}
        onFinish={() => {
          handleConfirmExit();
          router.back();
        }}
        title={t("question.exitConfirmTitle")}
        visible={showExitDialog}
      />
    </SafeAreaView>
  );
}
