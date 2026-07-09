import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { LoadingStateView } from "../../src/components/shell/StateViews";
import {
  isMobileSupabaseConfigured,
} from "../../src/config/env";
import { getExamQuestionTarget, isExamSimulatorMode } from "../../src/features/exam/exam-config";
import {
  fetchLatestActiveExamSession,
  startExamSession,
} from "../../src/features/exam/exam-session";
import { isUuidString } from "../../src/features/questions/question-routes";
import {
  useCurrentStudyPlanRemoteId,
  useCurrentUser,
  useAppShellStore,
} from "../../src/state/app-shell";

export default function ExamIntroScreen() {
  const { t } = useTranslation();
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
    isMobileSupabaseConfigured;

  useEffect(() => {
    if (didLaunchRef.current) {
      return;
    }

    didLaunchRef.current = true;

    void launchExam();
  }, []);

  const openExamSession = (sessionId: string) =>
    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId,
      },
    });

  const launchExam = async () => {
    try {
      const activeSnapshot = await fetchLatestActiveExamSession(mode, {
        useRemote: canUseRemoteExam,
      });

      if (activeSnapshot) {
        openExamSession(activeSnapshot.session.id);
        return;
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
          <View style={{ gap: 10 }}>
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
              onPress={() => router.back()}
            />
          </View>
        }
      >
        <Text style={errorText}>{startError}</Text>
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

const errorText = {
  color: "#A44E37",
  fontSize: 14,
  lineHeight: 22,
};
