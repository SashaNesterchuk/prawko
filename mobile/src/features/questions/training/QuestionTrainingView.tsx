import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import { TrainingExitDialog } from "../../../components/shell/TrainingExitDialog";
import {
  getLocalizedText,
  isQuestionMastered,
} from "../question-engine";
import { QuestionMediaCard } from "../QuestionMediaCard";
import { QuestionMediaEmptyPlaceholder } from "../QuestionMediaEmptyPlaceholder";
import { QuestionChoiceOption } from "./QuestionChoiceOption";
import { QuestionFeedbackBottomSheet } from "./QuestionFeedbackBottomSheet";
import { QuestionStepPill } from "./QuestionStepPill";
import type { QuestionTrainingSession } from "./useQuestionTrainingSession";
import { getQuestionStepState } from "./visible-steps";
import { useHasAiChatAccess } from "../../../state/entitlements";

const SUPPORT_EMAIL = "support@prawko.app";

type QuestionTrainingViewProps = Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "advanceSession"
  | "currentAnswer"
  | "currentAnswerCorrect"
  | "currentQuestion"
  | "currentQuestionId"
  | "currentQuestionState"
  | "displayLocale"
  | "feedbackAccent"
  | "feedbackGradientColors"
  | "handleAnswer"
  | "handleConfirmExit"
  | "handleDismissExitDialog"
  | "handleRequestExit"
  | "handleToggleBookmark"
  | "masteryProgress"
  | "premiumIconSize"
  | "questionChoices"
  | "showExitDialog"
  | "summary"
  | "trainerStyles"
  | "visibleSteps"
> & {
  activeSession: NonNullable<QuestionTrainingSession["activeSession"]>;
  currentQuestion: NonNullable<QuestionTrainingSession["currentQuestion"]>;
  currentQuestionId: NonNullable<QuestionTrainingSession["currentQuestionId"]>;
  currentQuestionState: NonNullable<
    QuestionTrainingSession["currentQuestionState"]
  >;
};

export function QuestionTrainingView({
  activeSession,
  advanceSession,
  currentAnswer,
  currentAnswerCorrect,
  currentQuestion,
  currentQuestionId,
  currentQuestionState,
  displayLocale,
  feedbackAccent,
  feedbackGradientColors,
  handleAnswer,
  handleConfirmExit,
  handleDismissExitDialog,
  handleRequestExit,
  handleToggleBookmark,
  masteryProgress,
  premiumIconSize,
  questionChoices,
  showExitDialog,
  summary,
  trainerStyles,
  visibleSteps,
}: QuestionTrainingViewProps) {
  const { t } = useTranslation();
  const hasAiChatAccess = useHasAiChatAccess();

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
  const correctChoiceBullets =
    hasAnswered && !isCorrectAnswer
      ? questionChoices
          .filter((choice) => choice.id === currentQuestion.correctAnswer)
          .map((choice) =>
            isBooleanQuestion
              ? choice.label
              : `${choice.id}. ${choice.label}`
          )
      : [];

  const handleReportProblem = () => {
    const subject = t("question.reportProblemSubject", {
      questionId: currentQuestionId,
    });
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    );
  };

  const handleExplainPress = () => {
    const aiChatParams = {
      questionId: currentQuestionId,
      locale: displayLocale,
      selectedAnswer: currentAnswer?.selectedAnswer,
    };

    if (hasAiChatAccess) {
      router.push({
        pathname: "/modals/ai-chat",
        params: aiChatParams,
      });
      return;
    }

    router.push({
      pathname: "/paywall",
      params: {
        feature: "ai_question_chat",
        returnTo: "ai-chat",
        ...aiChatParams,
      },
    });
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={trainerStyles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={trainerStyles.container}>
          <View style={trainerStyles.contentPad}>
            <View style={trainerStyles.header}>
              <NavigationButton
                inset
                type="close"
                accessibilityLabel={t("common.close")}
                onPress={handleRequestExit}
              />
              <View style={trainerStyles.headerCenter}>
                <Text style={trainerStyles.headerTitle}>
                  {t("question.trainerTitle")}
                </Text>
                <Text style={trainerStyles.headerCounter}>
                  {currentStep} / {totalQuestions}
                </Text>
              </View>
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
            <View style={trainerStyles.mediaBleed}>
              {currentQuestion.media ? (
                <QuestionMediaCard
                  key={currentQuestion.id}
                  locale={displayLocale}
                  media={currentQuestion.media}
                />
              ) : (
                <QuestionMediaEmptyPlaceholder />
              )}
            </View>

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
        </View>

        <TrainingExitDialog
          body={t("question.exitConfirmBody")}
          continueLabel={t("question.exitConfirmContinue")}
          finishLabel={t("question.exitConfirmFinish")}
          onContinue={handleDismissExitDialog}
          onFinish={handleConfirmExit}
          title={t("question.exitConfirmTitle")}
          visible={showExitDialog}
        />
      </SafeAreaView>

      <QuestionFeedbackBottomSheet
        visible={hasAnswered}
        isCorrectAnswer={isCorrectAnswer}
        explanationText={explanationText || null}
        correctChoiceBullets={correctChoiceBullets}
        showMasteryProgress={showMasteryProgress}
        masteryCurrent={masteryProgress.current}
        masteryTarget={masteryProgress.target}
        isBookmarked={currentQuestionState.isBookmarked}
        nextLabel={
          summary.answered >= summary.total
            ? t("question.finish")
            : t("question.nextQuestion")
        }
        feedbackAccentFill={feedbackAccent.fill}
        feedbackAccentInk={feedbackAccent.ink}
        feedbackGradientColors={feedbackGradientColors}
        premiumIconSize={premiumIconSize}
        onReportProblem={handleReportProblem}
        onToggleBookmark={() => handleToggleBookmark(currentQuestionId)}
        onExplain={handleExplainPress}
        onNext={() => advanceSession()}
      />
    </GreenWaveScreen>
  );
}
