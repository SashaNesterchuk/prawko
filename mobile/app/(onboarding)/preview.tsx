import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  formatPlanDate,
  generateLocalStudyPlan,
} from "../../src/features/study-plan/generate-local-study-plan";
import { saveGeneratedStudyPlanRemotely } from "../../src/features/study-plan/supabase-study-plan";
import {
  useCurrentStudyPlan,
  useCurrentUser,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../../src/state/app-shell";

export default function PreviewScreen() {
  const { t } = useTranslation();
  const currentUser = useCurrentUser();
  const currentStudyPlan = useCurrentStudyPlan();
  const nextOnboardingRoute = useNextOnboardingRoute();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const saveCurrentStudyPlan = useAppShellStore(
    (state) => state.saveCurrentStudyPlan
  );
  const setCurrentStudyPlanRemoteId = useAppShellStore(
    (state) => state.setCurrentStudyPlanRemoteId
  );
  const completeOnboarding = useAppShellStore(
    (state) => state.completeOnboarding
  );
  const [isStartingPlan, setIsStartingPlan] = useState(false);

  const isSetupReady =
    studyPlanSetup.daysUntilExam !== null &&
    studyPlanSetup.examDate !== null &&
    studyPlanSetup.minutesPerDay !== null &&
    studyPlanSetup.level !== null;
  const generatedPlan =
    currentStudyPlan ??
    (isSetupReady
      ? generateLocalStudyPlan({
          category: preferredCategory,
          locale: preferredLocale,
          daysUntilExam: studyPlanSetup.daysUntilExam!,
          minutesPerDay: studyPlanSetup.minutesPerDay!,
          level: studyPlanSetup.level!,
          schoolCode: studyPlanSetup.schoolCode || undefined,
        })
      : null);

  useEffect(() => {
    if (!currentStudyPlan && generatedPlan) {
      saveCurrentStudyPlan(generatedPlan);
    }
  }, [currentStudyPlan, generatedPlan, saveCurrentStudyPlan]);

  if (!currentUser) {
    return <Redirect href="/(onboarding)/access" />;
  }

  if (!isSetupReady && nextOnboardingRoute !== "/(onboarding)/preview") {
    return <Redirect href={nextOnboardingRoute} />;
  }

  if (!generatedPlan) {
    return <Redirect href={nextOnboardingRoute} />;
  }

  const handleStartPlan = async () => {
    if (isStartingPlan) {
      return;
    }

    setIsStartingPlan(true);

    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      try {
        const remotePlanId = await saveGeneratedStudyPlanRemotely({
          plan: generatedPlan,
          generationContext: {
            client_exam_date: studyPlanSetup.examDate,
            generated_at: new Date().toISOString(),
          },
        });

        setCurrentStudyPlanRemoteId(remotePlanId);
      } catch (error) {
        setCurrentStudyPlanRemoteId(null);
        console.warn("Failed to sync study plan to Supabase.", error);
        Toast.show({
          type: "error",
          text1: t("toasts.planSyncFailedTitle"),
          text2: t("toasts.planSyncFailedSubtitle"),
        });
      }
    } else {
      setCurrentStudyPlanRemoteId(null);
    }

    completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <AppScreen
      title={t("onboarding.previewTitle")}
      subtitle={t("onboarding.previewSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("onboarding.startPlan")}
            disabled={isStartingPlan}
            onPress={() => void handleStartPlan()}
          />
          <AppButton
            variant="ghost"
            disabled={isStartingPlan}
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 8 }}>
            {generatedPlan.title}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("onboarding.previewDate", {
              date: formatPlanDate(generatedPlan.examDate),
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("onboarding.previewMinutes", {
              minutes: generatedPlan.minutesPerDay,
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("onboarding.previewLevel", {
              level: t(`levels.${generatedPlan.level}.label`),
            })}
          </Text>
          {generatedPlan.schoolCode ? (
            <Text style={{ fontSize: 15, lineHeight: 24 }}>
              {t("onboarding.previewSchoolCode", {
                code: generatedPlan.schoolCode,
              })}
            </Text>
          ) : null}
        </AppCard>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <AppCard accent>
            <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
              {t("onboarding.previewMiniTests")}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800" }}>
              {generatedPlan.summary.miniTestDays}
            </Text>
          </AppCard>
          <AppCard accent>
            <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
              {t("onboarding.previewFullExams")}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800" }}>
              {generatedPlan.summary.fullExamDays}
            </Text>
          </AppCard>
        </View>

        <AppCard>
          <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
            {t("onboarding.previewMinimumMode", {
              days: generatedPlan.summary.minimumModeDays,
            })}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>
            {t("onboarding.previewWeakSpots", {
              days: generatedPlan.summary.weakSpotDays,
            })}
          </Text>
        </AppCard>

        {generatedPlan.days.slice(0, 5).map((day) => (
          <AppCard key={day.id}>
            <Text style={{ fontSize: 17, fontWeight: "700", marginBottom: 4 }}>
              {t("onboarding.previewDayTitle", {
                dayNumber: day.dayNumber,
                date: formatPlanDate(day.planDate),
                })}
            </Text>
            {day.focusTopic ? (
              <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
                {t("onboarding.previewFocus", {
                  topic: t(`topics.${day.focusTopic}`),
                })}
              </Text>
            ) : null}
            <View style={{ gap: 6 }}>
              {day.tasks.map((task) => (
                <Text key={task.id} style={{ fontSize: 14, lineHeight: 22 }}>
                  - {task.title} - {task.estimatedMinutes}m
                </Text>
              ))}
            </View>
          </AppCard>
        ))}

        {generatedPlan.days.length > 5 ? (
          <AppCard>
            <Text style={{ fontSize: 15, lineHeight: 24 }}>
              {t("onboarding.previewMoreDays", {
                days: generatedPlan.days.length - 5,
              })}
            </Text>
          </AppCard>
        ) : null}
      </View>
    </AppScreen>
  );
}
