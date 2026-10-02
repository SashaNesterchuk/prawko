import { useNavigation } from "expo-router/react-navigation";
import { router, type Href } from "expo-router";
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
import { useOfflineGateAnalytics } from "../src/features/offline/useOfflineGateAnalytics";
import { buildPaywallHref } from "../src/features/monetization/v2/paywall";
import { useQuestionRouteParams } from "../src/features/questions/training/route-params";
import { getQuestionDisplayStats } from "../src/features/questions/question-engine";
import { QuestionSessionResultView } from "../src/features/questions/training/QuestionSessionResultView";
import { InitialDiagnosticResultView } from "../src/features/questions/initial-diagnostic/InitialDiagnosticResultView";
import { isInitialDiagnosticSession } from "../src/features/questions/readiness-assessment";
import { QuestionTrainingFooter } from "../src/features/questions/training/QuestionTrainingFooter";
import { QuestionTrainingView } from "../src/features/questions/training/QuestionTrainingView";
import { useQuestionTrainingSession } from "../src/features/questions/training/useQuestionTrainingSession";
import {
  useAppShellStore,
} from "../src/state/app-shell";
import { useHasPlusAccess } from "../src/state/entitlements";
import { useQuestionCatalogResolved } from "../src/state/question-catalog";
import { useQuestionProgressStore } from "../src/state/question-progress";
import { useResponsiveStyles } from "../src/portable-ui";
import { useAnalyticsViewState } from "../src/analytics/useAnalyticsViewState";

export default function QuestionScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const hasPlusAccess = useHasPlusAccess();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const offlineGate = useOfflineFeatureGate(preferredCategory);
  const route = useQuestionRouteParams();
  useAnalyticsViewState(
    !questionCatalogResolved || (offlineGate.status === "checking" && !offlineGate.offlineReady)
      ? "loading" : offlineGate.status === "blocked" ? "blocked" : null,
    { screen_name: "question_training", mode: route.mode, topic_id: route.topic ?? null }
  );
  const block = useOfflineGateAnalytics({
    gate: offlineGate,
    visible: questionCatalogResolved && offlineGate.status === "blocked",
    properties: {
      feature: "training",
      screen_name: "question_training",
      requested_category: preferredCategory,
      mode: route.mode,
      topic_id: route.topic ?? null,
      roadmap_step_id: route.roadmapStepId ?? null,
    },
  });

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
                block.trackAction("retry");
                void offlineGate.refresh();
              }}
            />
            <AppButton
              variant="secondary"
              label={t("offlineGate.openOfflineMode")}
              testID="question-offline-open-offline-mode"
              onPress={() => {
                block.trackAction("open_offline_mode", hasPlusAccess ? "offline_mode" : "paywall");
                router.push(hasPlusAccess ? "/offline-mode" : buildPaywallHref({
                  source: "offline_mode",
                  surface: "offline_gate",
                  sourceScreen: "question_training",
                  accessBlockId: block.getBlockId(),
                }));
              }}
            />
            <AppButton
              variant="ghost"
              label={t("common.close")}
              onPress={() => {
                block.trackAction("close", "home");
                router.replace("/(tabs)");
              }}
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
    hideExitDialogAndWait: () => Promise<void>;
    showPendingExitAd: () => void;
  }>({
    handleConfirmExit: session.handleConfirmExit,
    handleRequestExit: () => undefined,
    hideExitDialogAndWait: async () => undefined,
    showPendingExitAd: () => undefined,
  });

  const leaveQuestionScreen = (href: Href) => {
    // beforeRemove intercepts every leave from /question. Set this before
    // replace(), or the stack freezes on the loading spinner (session already
    // cleared, new session never starts because the effect does not watch it).
    allowNavigationRef.current = true;
    void (async () => {
      await exitHandlersRef.current.hideExitDialogAndWait();
      exitHandlersRef.current.handleConfirmExit();
      router.replace(href);
      exitHandlersRef.current.showPendingExitAd();
    })();
  };

  const didOpenLimitPaywallRef = useRef(false);

  useEffect(() => {
    if (!session.paywallHref || didOpenLimitPaywallRef.current) {
      return;
    }

    // The question screen blocks every leave. Allow this one without the
    // exit-ad path: the session was never created, so it is not abandoned.
    didOpenLimitPaywallRef.current = true;
    allowNavigationRef.current = true;
    router.replace(session.paywallHref);
  }, [session.paywallHref]);

  const exitToTabs = () => {
    leaveQuestionScreen("/(tabs)");
  };

  const exitToMistakes = () => {
    leaveQuestionScreen("/mistakes");
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
    hideExitDialogAndWait: session.hideExitDialogAndWait,
    showPendingExitAd: session.showPendingExitAd,
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

  if (
    session.isEmptyState &&
    (session.activeSession?.emptyReason === "saved_empty" ||
      session.activeSession?.emptyReason === "wrong_answers_empty" ||
      session.activeSession?.emptyReason === "review_due_empty")
  ) {
    // Read on demand: deriving it for every answered question would scan the
    // whole catalog on each tap.
    const { questionUserState } = useQuestionProgressStore.getState();
    const displayStats = getQuestionDisplayStats(questionUserState);
    const emptyReason = session.activeSession?.emptyReason;
    const isMistakesEmpty = emptyReason === "wrong_answers_empty";
    const isSmartReviewEmpty = emptyReason === "review_due_empty";

    return (
      <PracticeEmptyState
        headerTitle={
          isSmartReviewEmpty
            ? t("learn.tileSrsTitle")
            : isMistakesEmpty
              ? t("mistakes.screenTitle")
              : t("practice.savedTitle")
        }
        title={
          isSmartReviewEmpty
            ? t("learn.srsEmptyTitle")
            : isMistakesEmpty
              ? t("mistakes.emptyTitle")
              : t("practice.savedEmptyTitle")
        }
        description={
          isSmartReviewEmpty
            ? t("learn.srsEmptyDescription")
            : isMistakesEmpty
              ? t("mistakes.emptyDescription")
              : t("practice.savedEmptyDescription")
        }
        iconName="like"
        variant={isSmartReviewEmpty ? "smartReview" : "default"}
        dueReviews={displayStats.reviewDue}
        wrongAnswers={displayStats.wrongAnswers}
        onBack={exitToTabs}
        testID={
          isSmartReviewEmpty
            ? "screen-srs-empty"
            : isMistakesEmpty
              ? "screen-mistakes-empty"
              : "screen-practice-empty"
        }
      />
    );
  }

  if (session.isEmptyState) {
    return (
      <AppScreen
        scroll={false}
        testID="screen-question-empty"
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
    if (isInitialDiagnosticSession(session.activeSession)) {
      return (
        <InitialDiagnosticResultView
          activeSession={session.activeSession}
          resultOrigin={session.resultOrigin}
          onClose={exitToTabs}
          onWorkOnMistakes={exitToMistakes}
          summary={session.summary}
        />
      );
    }

    return (
      <QuestionSessionResultView
        activeSession={session.activeSession}
        resultOrigin={session.resultOrigin}
        onClose={exitToTabs}
        onWorkOnMistakes={exitToMistakes}
        sessionMode={session.sessionMode}
        sessionResultPercent={session.sessionResultPercent}
        summary={session.summary}
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
      handleExitDialogDismissed={session.handleExitDialogDismissed}
      handleRequestExit={requestExit}
      handleToggleBookmark={session.handleToggleBookmark}
      premiumIconSize={session.premiumIconSize}
      questionChoices={session.questionChoices}
      remainingSeconds={session.remainingSeconds}
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
