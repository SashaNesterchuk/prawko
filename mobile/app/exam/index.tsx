import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppScreen } from "../../src/components/shell/AppScreen";
import {
  ErrorStateView,
  LoadingStateView,
} from "../../src/components/shell/StateViews";
import { CText, useResponsiveStyles } from "../../src/portable-ui";
import { getOfflineGateDescription } from "../../src/features/offline/offline-gate-copy";
import { useOfflineFeatureGate } from "../../src/features/offline/useOfflineFeatureGate";
import { useOfflineGateAnalytics } from "../../src/features/offline/useOfflineGateAnalytics";
import { getExamQuestionTarget, isExamSimulatorMode } from "../../src/features/exam/exam-config";
import { examAnalyticsFromRoute } from "../../src/features/exam/exam-entry";
import { resolveExamLaunchDecision } from "../../src/features/exam/exam-launch";
import { cacheExamSnapshot } from "../../src/features/exam/exam-snapshot-cache";
import {
  fetchLatestActiveExamSession,
  setExamSessionStatus,
  startExamSession,
} from "../../src/features/exam/exam-session";
import { isUuidString } from "../../src/features/questions/question-routes";
import {
  useCurrentStudyPlanRemoteId,
  useAppShellStore,
} from "../../src/state/app-shell";
import { useHasPlusAccess } from "../../src/state/entitlements";
import { useQuestionCatalogResolved } from "../../src/state/question-catalog";
import { ANALYTICS_EVENTS, getAnalyticsErrorCode } from "../../src/analytics/catalog";
import { createAnalyticsId } from "../../src/analytics/runtime-context";
import { readLearningIntentId } from "../../src/analytics/operations";
import type { LearningInteractionPayloads } from "../../src/analytics/learning-interaction-payloads";
import { useAnalyticsViewState } from "../../src/analytics/useAnalyticsViewState";
import { trackPremiumGateOpen } from "../../src/features/monetization/v2/analytics";
import { buildPaywallHref, openPaywall } from "../../src/features/monetization/v2/paywall";
import {
  isMonetizationV2Active,
  useMonetizationV2Store,
} from "../../src/features/monetization/v2/store";
import {
  resolveExamStart,
  type ExamAccessMethod,
} from "../../src/features/monetization/v2/usage";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";

export default function ExamIntroScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const hasPlusAccess = useHasPlusAccess();
  const params = useLocalSearchParams<{
    analyticsIntentId?: string | string[];
    entry?: string | string[];
    mode?: string | string[];
    questionLimit?: string | string[];
    roadmapStepId?: string | string[];
    studyPlanTaskId?: string | string[];
  }>();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const currentStudyPlanRemoteId = useCurrentStudyPlanRemoteId();
  const [startError, setStartError] = useState<string | null>(null);
  const didLaunchRef = useRef(false);
  const examAccessMethodRef = useRef<ExamAccessMethod | null>(null);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const offlineGate = useOfflineFeatureGate(preferredCategory);

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const examLaunch = examAnalyticsFromRoute({
    entry: getSingleParam(params.entry),
    roadmapStepId: getSingleParam(params.roadmapStepId),
  });
  const learningIntentId = readLearningIntentId(getSingleParam(params.analyticsIntentId));
  const examAnalyticsContext = { ...examLaunch, learning_intent_id: learningIntentId };
  const mode = isExamSimulatorMode(rawMode) ? rawMode : "exam";
  const requestedQuestionLimit = parsePositiveInteger(rawQuestionLimit);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const totalQuestionsTarget = getExamQuestionTarget(mode, requestedQuestionLimit);
  const block = useOfflineGateAnalytics({
    gate: offlineGate,
    visible: !startError && questionCatalogResolved && offlineGate.status === "blocked",
    properties: {
      ...examAnalyticsContext,
      feature: "exam",
      screen_name: "exam_loading",
      requested_category: preferredCategory,
      mode,
    },
  });
  useAnalyticsViewState(startError ? "error" : !questionCatalogResolved || offlineGate.status === "checking"
    ? "loading" : offlineGate.status === "blocked" ? "offline_blocked" : "launching", {
    ...examAnalyticsContext, screen_name: "exam_loading", mode,
  });

  useEffect(() => {
    if (
      didLaunchRef.current ||
      offlineGate.status !== "allowed" ||
      !questionCatalogResolved
    ) {
      return;
    }

    didLaunchRef.current = true;

    void launchExam();
  }, [offlineGate.status, questionCatalogResolved]);

  const openExamSession = (sessionId: string) =>
    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId,
        ...(learningIntentId ? { analyticsIntentId: learningIntentId } : {}),
      },
    });

  const launchExam = async () => {
    const launchAttemptId = createAnalyticsId("launch");
    let launchStep: LearningInteractionPayloads["exam_start_failed"]["launch_step"] = "fetch_active_session";
    track(ANALYTICS_EVENTS.examStartRequested.key, {
      ...examAnalyticsContext,
      launch_attempt_id: launchAttemptId,
      is_online: offlineGate.isOnline,
      offline_ready: offlineGate.offlineReady,
      mode,
      question_total: totalQuestionsTarget,
      source: studyPlanTaskId ? "study_plan" : "manual",
    });

    try {
      const activeSnapshot = await fetchLatestActiveExamSession(mode);

      const launchDecision = resolveExamLaunchDecision({
        activeSnapshot,
        preferredCategory,
        totalQuestionsTarget,
      });

      if (
        isMonetizationV2Active() &&
        launchDecision.action !== "resume"
      ) {
        const examDecision = resolveExamStart({
          isPlus: hasPlusAccess,
          isResume: false,
          usage: useMonetizationV2Store.getState().usage,
        });

        if (examDecision.action === "sheet") {
          const usage = useMonetizationV2Store.getState().usage;
          const gateId = trackPremiumGateOpen(track, {
            ...examAnalyticsContext,
            launch_attempt_id: launchAttemptId,
            exams_completed: usage.freeExamUsed ? 1 : 0,
            source: "exam_limit",
          });
          openPaywall({
            premiumGateId: gateId,
            postPurchaseAction: {
              type: "START_EXAM",
              entry: examLaunch.exam_entry,
              roadmapStepId: examLaunch.roadmap_step_id,
            },
            replace: true,
            source: "exam_limit",
          });
          return;
        }

        examAccessMethodRef.current = examDecision.method;
      }

      if (launchDecision.action === "resume" && activeSnapshot) {
        cacheExamSnapshot(activeSnapshot);
        track(ANALYTICS_EVENTS.examSessionResumed.key, {
          ...examAnalyticsContext,
          launch_attempt_id: launchAttemptId,
          exam_session_id: activeSnapshot.session.id,
          mode: activeSnapshot.session.mode,
          question_total: activeSnapshot.session.totalQuestionsTarget,
          resumed_at_question: launchDecision.currentQuestionIndex,
        });
        openExamSession(launchDecision.sessionId);
        return;
      }

      if (launchDecision.action === "abandon" && activeSnapshot) {
        launchStep = "abandon_previous_session";
        await setExamSessionStatus({
          sessionId: launchDecision.sessionId,
          status: "abandoned",
          metadata: {
            reason: launchDecision.reason,
            expected_total_questions: totalQuestionsTarget,
            previous_total_questions:
              activeSnapshot.session.totalQuestionsTarget,
            expected_category: preferredCategory,
            previous_category: activeSnapshot.session.currentCategory,
          },
        });
      }

      launchStep = "start_session";
      const snapshot = await startExamSession(
        {
          category: preferredCategory,
          examEntry: examLaunch.exam_entry,
          locale: preferredLocale,
          mode,
          replaceExisting: false,
          requestedTotalQuestions: totalQuestionsTarget,
          roadmapStepId: examLaunch.roadmap_step_id,
          studyPlanId: currentStudyPlanRemoteId,
          studyPlanTaskId,
        }
      );

      cacheExamSnapshot(snapshot);
      const accessMethod = examAccessMethodRef.current;
      if (isMonetizationV2Active() && accessMethod) {
        useMonetizationV2Store.getState().commitExamStarted(accessMethod);
      }
      track(ANALYTICS_EVENTS.examSessionStarted.key, {
        ...examAnalyticsContext,
        launch_attempt_id: launchAttemptId,
        exam_session_id: snapshot.session.id,
        mode: snapshot.session.mode,
        question_total: snapshot.session.totalQuestionsTarget,
        source: studyPlanTaskId ? "study_plan" : "manual",
        ...(isMonetizationV2Active() && accessMethod
          ? {
              access_method: accessMethod,
              access_tier: hasPlusAccess ? "premium" : "free",
            }
          : {}),
      });
      openExamSession(snapshot.session.id);
    } catch (error: unknown) {
      console.warn("Failed to launch exam session.", error);
      track(ANALYTICS_EVENTS.examStartFailed.key, {
        ...examAnalyticsContext,
        launch_attempt_id: launchAttemptId,
        mode,
        launch_step: launchStep,
        error_code: getAnalyticsErrorCode(error),
      });
      setStartError(getErrorMessage(error));
    }
  };

  if (startError) {
    return (
      <AppScreen
        title={t(`exam.modes.${mode}.title`)}
        subtitle={t(`exam.modes.${mode}.subtitle`, {
          count: totalQuestionsTarget,
        })}
        footer={
          <View style={styles.footerStack}>
            <AppButton
              label={t("exam.startCta")}
              onPress={() => {
                setStartError(null);
                void launchExam();
              }}
            />
            <AppButton
              variant="ghost"
              label={t("common.close")}
              onPress={() => router.replace("/(tabs)")}
            />
          </View>
        }
      >
        <CText style={styles.errorText}>{startError}</CText>
      </AppScreen>
    );
  }

  if (offlineGate.status === "checking" || !questionCatalogResolved) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t(`exam.modes.${mode}.subtitle`, {
            count: totalQuestionsTarget,
          })}
        />
      </AppScreen>
    );
  }

  if (offlineGate.status === "blocked") {
    return (
      <AppScreen
        testID={`screen-exam-offline-blocked-${offlineGate.reason}`}
        title={t("offlineGate.title")}
        scroll={false}
        footer={
          <View style={styles.footerStack}>
            <AppButton
              label={t("common.retry")}
              testID="exam-offline-retry"
              onPress={() => {
                block.trackAction("retry");
                didLaunchRef.current = false;
                void offlineGate.refresh();
              }}
            />
            <AppButton
              variant="secondary"
              label={t("offlineGate.openOfflineMode")}
              testID="exam-offline-open-offline-mode"
              onPress={() => {
                block.trackAction("open_offline_mode", hasPlusAccess ? "offline_mode" : "paywall");
                router.push(hasPlusAccess ? "/offline-mode" : buildPaywallHref({
                  source: "offline_mode",
                  surface: "offline_gate",
                  sourceScreen: "exam_loading",
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
            type: "exam",
          })}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <LoadingStateView
        title={t("states.loadingTitle")}
        description={t(`exam.modes.${mode}.subtitle`, {
          count: totalQuestionsTarget,
        })}
      />
    </AppScreen>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = Number.parseInt(value, 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to start exam session.";
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    errorText: {
      color: colors.warningInk,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
  }));
}
