import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { GreenWaveScreen } from "../../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../../components/shell/NavigationButton";
import { TrainingExitDialog } from "../../../components/shell/TrainingExitDialog";
import {
  formatSessionCountdown,
  getLocalizedText,
} from "../question-engine";
import { QuestionMediaCard } from "../QuestionMediaCard";
import { QuestionMediaEmptyPlaceholder } from "../QuestionMediaEmptyPlaceholder";
import { QuestionChoiceOption } from "./QuestionChoiceOption";
import { QuestionFeedbackActions } from "./QuestionFeedbackActions";
import { QuestionFeedbackBottomSheet } from "./QuestionFeedbackBottomSheet";
import { QuestionFeedbackPushStage } from "./QuestionFeedbackPushStage";
import { QuestionStepPill } from "./QuestionStepPill";
import type { QuestionTrainingSession } from "./useQuestionTrainingSession";
import { getQuestionStepState } from "./visible-steps";
import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { openSupportEmail } from "../../support/support-email";

import { CText } from "../../../portable-ui";

type QuestionTrainingViewProps = Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "currentAnswer"
  | "currentAnswerCorrect"
  | "currentQuestion"
  | "currentQuestionId"
  | "currentQuestionState"
  | "displayLocale"
  | "feedbackAccent"
  | "feedbackGradientColors"
  | "handleAnswer"
  | "handleContinueAfterFeedback"
  | "handleConfirmExit"
  | "handleDismissExitDialog"
  | "handleExitDialogDismissed"
  | "handleRequestExit"
  | "handleToggleBookmark"
  | "premiumIconSize"
  | "questionChoices"
  | "remainingSeconds"
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
  currentAnswer,
  currentAnswerCorrect,
  currentQuestion,
  currentQuestionId,
  currentQuestionState,
  displayLocale,
  feedbackAccent,
  feedbackGradientColors,
  handleAnswer,
  handleContinueAfterFeedback,
  handleConfirmExit,
  handleDismissExitDialog,
  handleExitDialogDismissed,
  handleRequestExit,
  handleToggleBookmark,
  premiumIconSize,
  questionChoices,
  remainingSeconds,
  showExitDialog,
  summary,
  trainerStyles,
  visibleSteps,
}: QuestionTrainingViewProps) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const insets = useSafeAreaInsets();
  const stepperRef = useRef<ScrollView>(null);
  const stepperWidthRef = useRef(0);
  const stepLayoutsRef = useRef<Record<number, { width: number; x: number }>>(
    {}
  );
  const hasCenteredStepRef = useRef(false);
  const currentIndex = activeSession.currentIndex;

  // Resuming can land far into the session, so the answered steps behind the
  // current one have to be scrolled into view instead of staying off-screen.
  const centerCurrentStep = useCallback(() => {
    const layout = stepLayoutsRef.current[currentIndex];

    if (!layout || stepperWidthRef.current === 0) {
      return;
    }

    const offset = layout.x - (stepperWidthRef.current - layout.width) / 2;
    stepperRef.current?.scrollTo({
      x: Math.max(0, offset),
      animated: hasCenteredStepRef.current,
    });
    hasCenteredStepRef.current = true;
  }, [currentIndex]);

  useEffect(() => {
    centerCurrentStep();
  }, [centerCurrentStep]);

  const hasAnswered = Boolean(currentAnswer);
  const isCorrectAnswer = currentAnswerCorrect;
  const isBooleanQuestion = currentQuestion.answerType === "boolean";
  const totalQuestions = summary.total || activeSession!.questionIds.length;
  const currentStep = activeSession!.currentIndex + 1;
  const isTimedSession = remainingSeconds !== null;
  const isTimerUrgent =
    isTimedSession && remainingSeconds <= 30;
  const headerCounter = isTimedSession
    ? formatSessionCountdown(remainingSeconds)
    : `${currentStep} / ${totalQuestions}`;
  const explanationText = getLocalizedText(
    currentQuestion.explanation,
    displayLocale
  );
  const scopeLabel = t(`question.scopes.${currentQuestion.scope}`);
  const handleReportProblem = () => {
    track(ANALYTICS_EVENTS.questionProblemReportRequested.key, {
      question_id: currentQuestionId,
      source: "training",
    });
    void openSupportEmail({
      subject: t("question.reportProblemSubject", {
        questionId: currentQuestionId,
      }),
    });
  };

  const questionBlock = (
    <>
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

      <CText style={trainerStyles.prompt} testID="question-prompt">
        {getLocalizedText(currentQuestion.prompt, displayLocale)}
      </CText>

      <View
        style={
          isBooleanQuestion
            ? trainerStyles.booleanOptions
            : trainerStyles.options
        }
      >
        {questionChoices.map((choice, index) => (
          <QuestionChoiceOption
            key={choice.id}
            choice={choice}
            choiceIndex={index}
            hasAnswered={hasAnswered}
            isBooleanQuestion={isBooleanQuestion}
            isCorrectChoice={currentQuestion.correctAnswer === choice.id}
            isSelected={currentAnswer?.selectedAnswer === choice.id}
            onPress={() => handleAnswer(choice.id)}
          />
        ))}
      </View>
    </>
  );

  return (
    <GreenWaveScreen>
      {/* The panel has to reach the physical bottom edge, so it owns the
          bottom inset instead of the safe area wrapper. */}
      <SafeAreaView
        style={trainerStyles.safeArea}
        edges={["top"]}
        testID="screen-question"
      >
        <StatusBar style="dark" />
        <View style={trainerStyles.container}>
          <View style={trainerStyles.contentPad}>
            <View style={trainerStyles.header}>
              <NavigationButton
                inset
                type="close"
                accessibilityLabel={t("common.close")}
                onPress={handleRequestExit}
                testID="question-close"
              />
              <View style={trainerStyles.headerCenter}>
                <CText style={trainerStyles.headerTitle}>
                  {t("question.trainerTitle")}
                </CText>
                <CText
                  style={[
                    trainerStyles.headerCounter,
                    isTimerUrgent ? trainerStyles.headerCounterUrgent : null,
                  ]}
                  testID={
                    isTimedSession ? "question-blitz-timer" : "question-counter"
                  }
                >
                  {headerCounter}
                </CText>
              </View>
            </View>
          </View>

          <ScrollView
            ref={stepperRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={trainerStyles.stepperScroll}
            contentContainerStyle={trainerStyles.stepper}
            onLayout={(event) => {
              stepperWidthRef.current = event.nativeEvent.layout.width;
              centerCurrentStep();
            }}
          >
            {visibleSteps.map(({ questionId, index }) => (
              <QuestionStepPill
                key={questionId}
                index={index}
                stepState={getQuestionStepState(
                  activeSession!.answers[questionId],
                  index,
                  currentIndex
                )}
                onLayout={(event) => {
                  const { width, x } = event.nativeEvent.layout;
                  stepLayoutsRef.current[index] = { width, x };

                  if (index === currentIndex) {
                    centerCurrentStep();
                  }
                }}
              />
            ))}
          </ScrollView>

          <View style={trainerStyles.metaRow}>
            <CText style={trainerStyles.metaText}>{scopeLabel}</CText>
            <CText style={trainerStyles.metaText}>
              {t("question.pointsLabel", { points: currentQuestion.points })}
            </CText>
          </View>

          <QuestionFeedbackPushStage
            visible={hasAnswered}
            contentBottomInset={insets.bottom + 24}
            resetKey={currentQuestionId}
            feedback={
              <QuestionFeedbackBottomSheet
                visible
                isCorrectAnswer={isCorrectAnswer}
                explanationText={explanationText || null}
                isBookmarked={currentQuestionState.isBookmarked}
                feedbackAccentFill={feedbackAccent.fill}
                feedbackAccentInk={feedbackAccent.ink}
                feedbackGradientColors={feedbackGradientColors}
                premiumIconSize={premiumIconSize}
                onReportProblem={handleReportProblem}
                onToggleBookmark={() =>
                  handleToggleBookmark(currentQuestionId)
                }
              />
            }
            feedbackActions={
              <QuestionFeedbackActions
                isCorrectAnswer={isCorrectAnswer}
                nextLabel={
                  summary.answered >= summary.total
                    ? t("question.finish")
                    : isCorrectAnswer
                      ? t("question.nextQuestion")
                      : t("question.gotIt")
                }
                onNext={handleContinueAfterFeedback}
              />
            }
          >
            {questionBlock}
          </QuestionFeedbackPushStage>
        </View>

        <TrainingExitDialog
          body={t("question.exitConfirmBody")}
          continueLabel={t("question.exitConfirmContinue")}
          finishLabel={t("question.exitConfirmFinish")}
          onContinue={handleDismissExitDialog}
          onDismiss={handleExitDialogDismissed}
          onFinish={handleConfirmExit}
          title={t("question.exitConfirmTitle")}
          visible={showExitDialog}
        />
      </SafeAreaView>
    </GreenWaveScreen>
  );
}
