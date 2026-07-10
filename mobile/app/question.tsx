import { useTranslation } from "react-i18next";

import { AppScreen } from "../src/components/shell/AppScreen";
import {
  EmptyStateView,
  LoadingStateView,
} from "../src/components/shell/StateViews";
import { QuestionSessionResultView } from "../src/features/questions/training/QuestionSessionResultView";
import { QuestionTrainingFooter } from "../src/features/questions/training/QuestionTrainingFooter";
import { QuestionTrainingView } from "../src/features/questions/training/QuestionTrainingView";
import { useQuestionTrainingSession } from "../src/features/questions/training/useQuestionTrainingSession";

export default function QuestionScreen() {
  const { t } = useTranslation();
  const session = useQuestionTrainingSession();

  if (!session.isReady) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  if (session.isEmptyState) {
    return (
      <AppScreen
        scroll={false}
        footer={
          <QuestionTrainingFooter
            activeSession={session.activeSession}
            advanceSession={session.advanceSession}
            currentAnswer={session.currentAnswer}
            isCompleted={session.isCompleted}
            isEmptyState={session.isEmptyState}
            sessionMode={session.sessionMode}
            summary={session.summary}
            topic={session.topic}
            trainerStyles={session.trainerStyles}
          />
        }
      >
        <EmptyStateView
          title={t("question.emptyTitle")}
          description={session.screenSubtitle}
        />
      </AppScreen>
    );
  }

  if (session.isCompleted) {
    return (
      <QuestionSessionResultView
        activeSession={session.activeSession}
        resultIconSize={session.resultIconSize}
        sessionMode={session.sessionMode}
        sessionPassed={session.sessionPassed}
        sessionResultAccent={session.sessionResultAccent}
        sessionResultPercent={session.sessionResultPercent}
        summary={session.summary}
        trainerStyles={session.trainerStyles}
      />
    );
  }

  if (
    !session.currentQuestion ||
    !session.currentQuestionId ||
    !session.currentQuestionState ||
    !session.activeSession
  ) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  return (
    <QuestionTrainingView
      activeSession={session.activeSession}
      advanceSession={session.advanceSession}
      aiIconSize={session.aiIconSize}
      currentAnswer={session.currentAnswer}
      currentAnswerCorrect={session.currentAnswerCorrect}
      currentQuestion={session.currentQuestion}
      currentQuestionId={session.currentQuestionId}
      currentQuestionState={session.currentQuestionState}
      displayLocale={session.displayLocale}
      feedbackAccent={session.feedbackAccent}
      handleAnswer={session.handleAnswer}
      handleConfirmExit={session.handleConfirmExit}
      handleDismissExitDialog={session.handleDismissExitDialog}
      handleRequestExit={session.handleRequestExit}
      handleToggleBookmark={session.handleToggleBookmark}
      questionChoices={session.questionChoices}
      showExitDialog={session.showExitDialog}
      summary={session.summary}
      trainerStyles={session.trainerStyles}
      visibleSteps={session.visibleSteps}
    />
  );
}
