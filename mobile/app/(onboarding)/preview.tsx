import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useResponsiveStyles } from "../../src/portable-ui";
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
  const styles = useStyles();
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
        <View style={styles.footerStack}>
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
      <View style={styles.cardStack}>
        <AppCard accent>
          <Text style={styles.summaryTitle}>
            {generatedPlan.title}
          </Text>
          <Text style={styles.summaryLine}>
            {t("onboarding.previewDate", {
              date: formatPlanDate(generatedPlan.examDate),
            })}
          </Text>
          <Text style={styles.summaryLine}>
            {t("onboarding.previewMinutes", {
              minutes: generatedPlan.minutesPerDay,
            })}
          </Text>
          <Text style={styles.summaryLine}>
            {t("onboarding.previewLevel", {
              level: t(`levels.${generatedPlan.level}.label`),
            })}
          </Text>
          {generatedPlan.schoolCode ? (
            <Text style={styles.summaryLine}>
              {t("onboarding.previewSchoolCode", {
                code: generatedPlan.schoolCode,
              })}
            </Text>
          ) : null}
        </AppCard>

        <View style={styles.metricsRow}>
          <AppCard accent>
            <Text style={styles.metricLabel}>
              {t("onboarding.previewMiniTests")}
            </Text>
            <Text style={styles.metricValue}>
              {generatedPlan.summary.miniTestDays}
            </Text>
          </AppCard>
          <AppCard accent>
            <Text style={styles.metricLabel}>
              {t("onboarding.previewFullExams")}
            </Text>
            <Text style={styles.metricValue}>
              {generatedPlan.summary.fullExamDays}
            </Text>
          </AppCard>
        </View>

        <AppCard>
          <Text style={styles.sectionTitle}>
            {t("onboarding.previewMinimumMode", {
              days: generatedPlan.summary.minimumModeDays,
            })}
          </Text>
          <Text style={styles.sectionBody}>
            {t("onboarding.previewWeakSpots", {
              days: generatedPlan.summary.weakSpotDays,
            })}
          </Text>
        </AppCard>

        {generatedPlan.days.slice(0, 5).map((day) => (
          <AppCard key={day.id}>
            <Text style={styles.dayTitle}>
              {t("onboarding.previewDayTitle", {
                dayNumber: day.dayNumber,
                date: formatPlanDate(day.planDate),
                })}
            </Text>
            {day.focusTopic ? (
              <Text style={styles.dayFocus}>
                {t("onboarding.previewFocus", {
                  topic: t(`topics.${day.focusTopic}`),
                })}
              </Text>
            ) : null}
            <View style={styles.taskList}>
              {day.tasks.map((task) => (
                <Text key={task.id} style={styles.taskText}>
                  - {task.title} - {task.estimatedMinutes}m
                </Text>
              ))}
            </View>
          </AppCard>
        ))}

        {generatedPlan.days.length > 5 ? (
          <AppCard>
            <Text style={styles.summaryLine}>
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

function useStyles() {
  return useResponsiveStyles(({ responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    cardStack: {
      gap: spacing.exact(12),
    },
    summaryTitle: {
      fontSize: responsiveFont(24),
      fontWeight: "800",
      marginBottom: spacing.exact(8),
    },
    summaryLine: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(24),
    },
    metricsRow: {
      flexDirection: "row",
      gap: spacing.exact(12),
    },
    metricLabel: {
      fontSize: responsiveFont(13),
      fontWeight: "700",
      marginBottom: spacing.exact(8),
    },
    metricValue: {
      fontSize: responsiveFont(28),
      fontWeight: "800",
    },
    sectionTitle: {
      fontSize: responsiveFont(16),
      fontWeight: "700",
      marginBottom: spacing.exact(8),
    },
    sectionBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    dayTitle: {
      fontSize: responsiveFont(17),
      fontWeight: "700",
      marginBottom: spacing.exact(4),
    },
    dayFocus: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      marginBottom: spacing.exact(8),
    },
    taskList: {
      gap: spacing.exact(6),
    },
    taskText: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
  }));
}
