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
import {
  isMobileSupabaseConfigured,
} from "../../src/config/env";
import { getOfflineGateDescription } from "../../src/features/offline/offline-gate-copy";
import { useOfflineFeatureGate } from "../../src/features/offline/useOfflineFeatureGate";
import { getExamQuestionTarget, isExamSimulatorMode } from "../../src/features/exam/exam-config";
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
  useCurrentUser,
  useAppShellStore,
} from "../../src/state/app-shell";
import { useHasPlusAccess } from "../../src/state/entitlements";
import { useQuestionCatalogResolved } from "../../src/state/question-catalog";
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";

export default function ExamIntroScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const hasPlusAccess = useHasPlusAccess();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    studyPlanTaskId?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentUser = useCurrentUser();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const currentStudyPlanRemoteId = useCurrentStudyPlanRemoteId();
  const [startError, setStartError] = useState<string | null>(null);
  const didLaunchRef = useRef(false);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const offlineGate = useOfflineFeatureGate(preferredCategory);

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const mode = isExamSimulatorMode(rawMode) ? rawMode : "exam";
  const requestedQuestionLimit = parsePositiveInteger(rawQuestionLimit);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const totalQuestionsTarget = getExamQuestionTarget(mode, requestedQuestionLimit);
  const canUseRemoteExam =
    authMode === "supabase" &&
    Boolean(currentUser) &&
    isMobileSupabaseConfigured &&
    offlineGate.isOnline === true;

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
      },
    });

  const launchExam = async () => {
    track(ANALYTICS_EVENTS.examStartRequested.key, {
      mode,
      question_total: totalQuestionsTarget,
      source: studyPlanTaskId ? "study_plan" : "manual",
    });

    try {
      const activeSnapshot = await fetchLatestActiveExamSession(mode, {
        useRemote: canUseRemoteExam,
      });

      const launchDecision = resolveExamLaunchDecision({
        activeSnapshot,
        preferredCategory,
        totalQuestionsTarget,
      });

      if (launchDecision.action === "resume" && activeSnapshot) {
        cacheExamSnapshot(activeSnapshot);
        track(ANALYTICS_EVENTS.examSessionResumed.key, {
          mode: activeSnapshot.session.mode,
          question_total: activeSnapshot.session.totalQuestionsTarget,
          resumed_at_question: launchDecision.currentQuestionIndex,
        });
        openExamSession(launchDecision.sessionId);
        return;
      }

      if (launchDecision.action === "abandon" && activeSnapshot) {
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

      const snapshot = await startExamSession(
        {
          category: preferredCategory,
          locale: preferredLocale,
          mode,
          replaceExisting: false,
          requestedTotalQuestions: totalQuestionsTarget,
          studyPlanId: currentStudyPlanRemoteId,
          studyPlanTaskId,
        },
        { useRemote: canUseRemoteExam }
      );

      cacheExamSnapshot(snapshot);
      track(ANALYTICS_EVENTS.examSessionStarted.key, {
        mode: snapshot.session.mode,
        question_total: snapshot.session.totalQuestionsTarget,
        source: studyPlanTaskId ? "study_plan" : "manual",
      });
      openExamSession(snapshot.session.id);
    } catch (error: unknown) {
      console.warn("Failed to launch exam session.", error);
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
                didLaunchRef.current = false;
                void offlineGate.refresh();
              }}
            />
            <AppButton
              variant="secondary"
              label={t("offlineGate.openOfflineMode")}
              testID="exam-offline-open-offline-mode"
              onPress={() =>
                router.push(hasPlusAccess ? "/offline-mode" : "/paywall")
              }
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
