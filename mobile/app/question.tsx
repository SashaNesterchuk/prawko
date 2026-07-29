import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { AppScreen } from "../src/components/shell/AppScreen";
import { PracticeEmptyState } from "../src/components/shell/PracticeEmptyState";
import {
  EmptyStateView,
  LoadingStateView,
} from "../src/components/shell/StateViews";
import { getQuestionDisplayStats } from "../src/features/questions/question-engine";
import { QuestionSessionResultView } from "../src/features/questions/training/QuestionSessionResultView";
import { QuestionTrainingFooter } from "../src/features/questions/training/QuestionTrainingFooter";
import { QuestionTrainingView } from "../src/features/questions/training/QuestionTrainingView";
import { useQuestionTrainingSession } from "../src/features/questions/training/useQuestionTrainingSession";
import { useQuestionCatalogVersion } from "../src/state/question-catalog";
import { useQuestionProgressStore } from "../src/state/question-progress";

export default function QuestionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const allowNavigationRef = useRef(false);
  const session = useQuestionTrainingSession();
  const exitHandlersRef = useRef({
    handleConfirmExit: session.handleConfirmExit,
    handleRequestExit: session.handleRequestExit,
    isCompleted: session.isCompleted,
    isEmptyState: session.isEmptyState,
  });
  exitHandlersRef.current = {
    handleConfirmExit: session.handleConfirmExit,
    handleRequestExit: session.handleRequestExit,
    isCompleted: session.isCompleted,
    isEmptyState: session.isEmptyState,
  };

  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const dueReviews = useMemo(
    () => getQuestionDisplayStats(questionUserState).reviewDue,
    [questionCatalogVersion, questionUserState]
  );

  const exitToTabs = () => {
    allowNavigationRef.current = true;
    exitHandlersRef.current.handleConfirmExit();
    router.replace("/(tabs)");
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowNavigationRef.current) {
        return;
      }

      // Swipe / hardware back must match the close control.
      event.preventDefault();

      const {
        handleConfirmExit,
        handleRequestExit,
        isCompleted,
        isEmptyState,
      } = exitHandlersRef.current;

      if (isCompleted || isEmptyState) {
        allowNavigationRef.current = true;
        handleConfirmExit();
        router.replace("/(tabs)");
        return;
      }

      handleRequestExit();
    });

    return unsubscribe;
  }, [navigation]);

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

  if (session.isEmptyState && session.activeSession?.emptyReason === "saved_empty") {
    return (
      <PracticeEmptyState
        headerTitle={t("practice.savedTitle")}
        title={t("practice.savedEmptyTitle")}
        description={t("practice.savedEmptyDescription")}
        iconName="like"
        dueReviews={dueReviews}
        onBack={exitToTabs}
      />
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
            onClose={exitToTabs}
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
        onClose={exitToTabs}
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
      currentAnswer={session.currentAnswer}
      currentAnswerCorrect={session.currentAnswerCorrect}
      currentQuestion={session.currentQuestion}
      currentQuestionId={session.currentQuestionId}
      currentQuestionState={session.currentQuestionState}
      displayLocale={session.displayLocale}
      feedbackAccent={session.feedbackAccent}
      feedbackGradientColors={session.feedbackGradientColors}
      handleAnswer={session.handleAnswer}
      handleConfirmExit={exitToTabs}
      handleDismissExitDialog={session.handleDismissExitDialog}
      handleRequestExit={session.handleRequestExit}
      handleToggleBookmark={session.handleToggleBookmark}
      masteryProgress={session.masteryProgress}
      premiumIconSize={session.premiumIconSize}
      questionChoices={session.questionChoices}
      showExitDialog={session.showExitDialog}
      summary={session.summary}
      trainerStyles={session.trainerStyles}
      visibleSteps={session.visibleSteps}
    />
  );
}
