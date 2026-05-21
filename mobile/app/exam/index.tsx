import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { EXAM_RULES } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  formatExamCountdown,
  getExamDurationMinutes,
  getExamPointTargets,
  getExamQuestionTarget,
  getExamScopeTargets,
  isExamSimulatorMode,
} from "../../src/features/exam/exam-config";
import { fetchLatestActiveExamSession, startRemoteExamSession } from "../../src/features/exam/supabase-exam";
import { buildQuestionRouteParams, isUuidString } from "../../src/features/questions/question-routes";
import {
  useCurrentStudyPlanRemoteId,
  useAppShellStore,
} from "../../src/state/app-shell";
import { useHasFeatureAccess } from "../../src/state/entitlements";

export default function ExamIntroScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    studyPlanTaskId?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const currentStudyPlanRemoteId = useCurrentStudyPlanRemoteId();
  const hasExamAccess = useHasFeatureAccess("exam_simulator");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionSummary, setActiveSessionSummary] = useState<{
    answered: number;
    remainingSeconds: number | null;
    total: number;
  } | null>(null);
  const [isLoadingActiveSession, setIsLoadingActiveSession] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const mode = isExamSimulatorMode(rawMode) ? rawMode : "exam";
  const requestedQuestionLimit = parsePositiveInteger(rawQuestionLimit);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const totalQuestionsTarget = getExamQuestionTarget(mode, requestedQuestionLimit);
  const durationMinutes = getExamDurationMinutes(totalQuestionsTarget);
  const scopeTargets = getExamScopeTargets(totalQuestionsTarget);
  const basePointTargets = getExamPointTargets("base", scopeTargets.base);
  const specialistPointTargets = getExamPointTargets(
    "specialist",
    scopeTargets.specialist
  );
  const fallbackQuestionParams = useMemo(
    () =>
      buildQuestionRouteParams({
        mode,
        questionLimit: totalQuestionsTarget,
        studyPlanTaskId,
      }),
    [mode, studyPlanTaskId, totalQuestionsTarget]
  );

  useEffect(() => {
    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setActiveSessionId(null);
      setActiveSessionSummary(null);
      setIsLoadingActiveSession(false);
      return;
    }

    let cancelled = false;
    setIsLoadingActiveSession(true);
    setActiveSessionId(null);
    setActiveSessionSummary(null);

    void fetchLatestActiveExamSession(mode)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        if (!snapshot) {
          setActiveSessionId(null);
          setActiveSessionSummary(null);
          return;
        }

        setActiveSessionId(snapshot.session.id);
        setActiveSessionSummary({
          answered: snapshot.session.totalQuestionsAnswered,
          remainingSeconds: snapshot.session.remainingSeconds,
          total: snapshot.session.totalQuestionsTarget,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch latest active exam session.", error);
          setActiveSessionId(null);
          setActiveSessionSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingActiveSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, mode]);

  const openPaywall = () =>
    router.push({
      pathname: "/modals/paywall",
      params: {
        feature: "exam_simulator",
      },
    });

  const openPreviewFallback = () =>
    router.push({
      pathname: "/question",
      params: fallbackQuestionParams,
    });

  const openExamSession = (sessionId: string) =>
    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId,
      },
    });

  const handleStartSession = async (replaceExisting: boolean) => {
    if (!hasExamAccess) {
      openPaywall();
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      openPreviewFallback();
      return;
    }

    setIsStarting(true);
    setStartError(null);

    try {
      const snapshot = await startRemoteExamSession({
        category: preferredCategory,
        locale: preferredLocale,
        mode,
        replaceExisting,
        requestedTotalQuestions: totalQuestionsTarget,
        studyPlanId: currentStudyPlanRemoteId,
        studyPlanTaskId,
      });

      openExamSession(snapshot.session.id);
    } catch (error: unknown) {
      console.warn("Failed to start exam session.", error);
      setStartError(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <AppScreen
      title={t(`exam.modes.${mode}.title`)}
      subtitle={t(`exam.modes.${mode}.subtitle`, {
        count: totalQuestionsTarget,
      })}
      footer={
        <View style={{ gap: 10 }}>
          {activeSessionId && activeSessionSummary ? (
            <AppButton
              label={t("exam.resumeCta")}
              onPress={() => openExamSession(activeSessionId)}
            />
          ) : (
            <AppButton
              label={t("exam.startCta")}
              onPress={() => void handleStartSession(false)}
              disabled={isStarting}
            />
          )}
          {activeSessionId && activeSessionSummary ? (
            <AppButton
              variant="secondary"
              label={t("exam.restartCta")}
              onPress={() => void handleStartSession(true)}
              disabled={isStarting}
            />
          ) : null}
          {!hasExamAccess ? (
            <AppButton
              variant="secondary"
              label={t("exam.unlockCta")}
              onPress={openPaywall}
            />
          ) : null}
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        {!hasExamAccess ? (
          <AppCard>
            <Text style={sectionTitle}>{t("exam.lockedTitle")}</Text>
            <Text style={bodyText}>{t("exam.lockedBody")}</Text>
          </AppCard>
        ) : null}

        {authMode !== "supabase" || !isMobileSupabaseConfigured ? (
          <AppCard accent>
            <Text style={sectionTitle}>{t("exam.fallbackTitle")}</Text>
            <Text style={bodyText}>{t("exam.fallbackBody")}</Text>
            <View style={{ marginTop: 12 }}>
              <AppButton
                variant="secondary"
                label={t("exam.openPreviewCta")}
                onPress={openPreviewFallback}
              />
            </View>
          </AppCard>
        ) : null}

        {activeSessionId && activeSessionSummary ? (
          <AppCard accent>
            <Text style={sectionTitle}>{t("exam.resumeTitle")}</Text>
            <Text style={bodyText}>
              {t("exam.resumeBody", {
                answered: activeSessionSummary.answered,
                total: activeSessionSummary.total,
                time: formatExamCountdown(activeSessionSummary.remainingSeconds),
              })}
            </Text>
          </AppCard>
        ) : isLoadingActiveSession ? (
          <AppCard>
            <Text style={bodyText}>{t("exam.loadingActiveSession")}</Text>
          </AppCard>
        ) : null}

        <AppCard accent>
          <Text style={sectionLabel}>{t("exam.structureTitle")}</Text>
          <Text style={metricText}>
            {totalQuestionsTarget} · {formatExamCountdown(durationMinutes * 60)}
          </Text>
          <Text style={bodyText}>
            {t("exam.structureBody", {
              base: scopeTargets.base,
              specialist: scopeTargets.specialist,
              count: totalQuestionsTarget,
              minutes: durationMinutes,
            })}
          </Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Text style={metaText}>
              {t("exam.baseMix", {
                three: getTargetCount(basePointTargets, 3),
                two: getTargetCount(basePointTargets, 2),
                one: getTargetCount(basePointTargets, 1),
              })}
            </Text>
            <Text style={metaText}>
              {t("exam.specialistMix", {
                three: getTargetCount(specialistPointTargets, 3),
                two: getTargetCount(specialistPointTargets, 2),
                one: getTargetCount(specialistPointTargets, 1),
              })}
            </Text>
          </View>
        </AppCard>

        <AppCard>
          <Text style={sectionTitle}>{t("exam.rulesTitle")}</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            <Text style={metaText}>{t("exam.rules.noBack")}</Text>
            <Text style={metaText}>{t("exam.rules.timer")}</Text>
            <Text style={metaText}>{t("exam.rules.noExplanation")}</Text>
            <Text style={metaText}>
              {mode === "exam" && totalQuestionsTarget === EXAM_RULES.totalQuestions
                ? t("exam.rules.passOfficial")
                : t("exam.rules.passScaled")}
            </Text>
          </View>
        </AppCard>

        {startError ? (
          <AppCard>
            <Text style={errorText}>{startError}</Text>
          </AppCard>
        ) : null}
      </View>
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

function getTargetCount(
  targets: Array<{ count: number; points: number }>,
  points: number
) {
  return targets.find((target) => target.points === points)?.count ?? 0;
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

const sectionLabel = {
  color: "#4E5A52",
  fontSize: 12,
  fontWeight: "800" as const,
  letterSpacing: 0.6,
  lineHeight: 18,
  marginBottom: 8,
  textTransform: "uppercase" as const,
};

const sectionTitle = {
  color: "#182018",
  fontSize: 18,
  fontWeight: "700" as const,
  lineHeight: 25,
};

const metricText = {
  color: "#1E5B4F",
  fontSize: 28,
  fontWeight: "800" as const,
  lineHeight: 34,
  marginTop: 4,
  marginBottom: 8,
};

const bodyText = {
  color: "#4E5A52",
  fontSize: 14,
  lineHeight: 22,
};

const metaText = {
  color: "#4E5A52",
  fontSize: 13,
  lineHeight: 20,
};

const errorText = {
  color: "#A44E37",
  fontSize: 13,
  lineHeight: 20,
};
