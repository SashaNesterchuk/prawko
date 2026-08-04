import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AppButton } from "../src/components/shell/AppButton";
import { AppScreen } from "../src/components/shell/AppScreen";
import { PracticeEmptyState } from "../src/components/shell/PracticeEmptyState";
import {
  EmptyStateView,
  ErrorStateView,
  LoadingStateView,
} from "../src/components/shell/StateViews";
import { getOfflineGateDescription } from "../src/features/offline/offline-gate-copy";
import { useOfflineFeatureGate } from "../src/features/offline/useOfflineFeatureGate";
import { getQuestionDisplayStats } from "../src/features/questions/question-engine";
import { QuestionSessionResultView } from "../src/features/questions/training/QuestionSessionResultView";
import { QuestionTrainingFooter } from "../src/features/questions/training/QuestionTrainingFooter";
import { QuestionTrainingView } from "../src/features/questions/training/QuestionTrainingView";
import { useQuestionTrainingSession } from "../src/features/questions/training/useQuestionTrainingSession";
import {
  useAppShellStore,
} from "../src/state/app-shell";
import { useQuestionCatalogResolved } from "../src/state/question-catalog";
import { useQuestionProgressStore } from "../src/state/question-progress";
import { useResponsiveStyles } from "../src/portable-ui";

export default function QuestionScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const offlineGate = useOfflineFeatureGate(preferredCategory);

  if (
    !questionCatalogResolved ||
    (offlineGate.status === "checking" && !offlineGate.offlineReady)
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

  if (offlineGate.status === "blocked") {
    return (
      <AppScreen
        testID={`screen-question-offline-blocked-${offlineGate.reason}`}
        scroll={false}
        title={t("offlineGate.title")}
        footer={
          <View style={styles.footerStack}>
            <AppButton
              label={t("common.retry")}
              testID="question-offline-retry"
              onPress={() => {
                void offlineGate.refresh();
              }}
            />
            <AppButton
              variant="secondary"
              label={t("offlineGate.openOfflineMode")}
              testID="question-offline-open-offline-mode"
              onPress={() => router.push("/modals/offline-mode")}
            />
            <AppButton
              variant="ghost"
              label={t("common.close")}
              onPress={() => router.replace("/(tabs)")}
            />
          </View>
        }
      >
        <ErrorStateView
          title={t("offlineGate.title")}
          description={getOfflineGateDescription({
            currentCategory: preferredCategory,
            downloadedCategory: offlineGate.downloadedCategory,
            reason: offlineGate.reason,
            t,
            type: "training",
          })}
        />
      </AppScreen>
    );
  }

  return <QuestionTrainingScreen />;
}

function QuestionTrainingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const allowNavigationRef = useRef(false);
  const session = useQuestionTrainingSession();
  const exitHandlersRef = useRef<{
    handleConfirmExit: () => void;
    handleRequestExit: () => void;
  }>({
    handleConfirmExit: session.handleConfirmExit,
    handleRequestExit: () => undefined,
  });

  const exitToTabs = () => {
    allowNavigationRef.current = true;
    // Ads are scheduled inside handleConfirmExit after a short delay so
    // navigation is never blocked on AdMob load/show.
    exitHandlersRef.current.handleConfirmExit();
    router.replace("/(tabs)");
  };

  // Empty open + close / completed / empty pool = leave without warning.
  const requestExit = () => {
    if (
      session.isCompleted ||
      session.isEmptyState ||
      !session.hasStartedTraining
    ) {
      void exitToTabs();
      return;
    }

    session.handleRequestExit();
  };

  exitHandlersRef.current = {
    handleConfirmExit: session.handleConfirmExit,
    handleRequestExit: requestExit,
  };

  // Hardware / JS back only — swipe is disabled via gestureEnabled: false.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowNavigationRef.current) {
        return;
      }

      event.preventDefault();
      exitHandlersRef.current.handleRequestExit();
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
    // Read on demand: deriving it for every answered question would scan the
    // whole catalog on each tap.
    const { questionUserState } = useQuestionProgressStore.getState();

    return (
      <PracticeEmptyState
        headerTitle={t("practice.savedTitle")}
        title={t("practice.savedEmptyTitle")}
        description={t("practice.savedEmptyDescription")}
        iconName="like"
        dueReviews={getQuestionDisplayStats(questionUserState).reviewDue}
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
      currentAnswer={session.currentAnswer}
      currentAnswerCorrect={session.currentAnswerCorrect}
      currentQuestion={session.currentQuestion}
      currentQuestionId={session.currentQuestionId}
      currentQuestionState={session.currentQuestionState}
      displayLocale={session.displayLocale}
      feedbackAccent={session.feedbackAccent}
      feedbackGradientColors={session.feedbackGradientColors}
      handleAnswer={session.handleAnswer}
      handleContinueAfterFeedback={session.handleContinueAfterFeedback}
      handleConfirmExit={exitToTabs}
      handleDismissExitDialog={session.handleDismissExitDialog}
      handleRequestExit={requestExit}
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

function useStyles() {
  return useResponsiveStyles(({ spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
  }));
}
