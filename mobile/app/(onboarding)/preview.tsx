import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  formatPlanDate,
  generateLocalStudyPlan,
} from "../../src/features/study-plan/generate-local-study-plan";
import { saveGeneratedStudyPlanRemotely } from "../../src/features/study-plan/supabase-study-plan";
import { getQuestionTopicTitleSafe } from "../../src/features/question-topics/catalog";
import {
  useCurrentStudyPlan,
  useCurrentUser,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../../src/state/app-shell";
import { ANALYTICS_EVENTS, getAnalyticsErrorCode } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";

export default function PreviewScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
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
    let remoteSyncSucceeded = false;

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
        remoteSyncSucceeded = true;
      } catch (error) {
        setCurrentStudyPlanRemoteId(null);
        console.warn("Failed to sync study plan to Supabase.", error);
        track(ANALYTICS_EVENTS.studyPlanCreateFailed.key, {
          error_code: getAnalyticsErrorCode(error),
          source: "onboarding",
        });
      }
    } else {
      setCurrentStudyPlanRemoteId(null);
    }

    completeOnboarding();
    track(ANALYTICS_EVENTS.studyPlanCreated.key, {
      days_until_exam: studyPlanSetup.daysUntilExam,
      has_exam_date: Boolean(studyPlanSetup.examDate),
      level: generatedPlan.level,
      minutes_per_day: generatedPlan.minutesPerDay,
      remote_sync_succeeded: remoteSyncSucceeded,
    });
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
          <CText style={styles.summaryTitle}>
            {generatedPlan.title}
          </CText>
          {studyPlanSetup.examDate ? (
            <CText style={styles.summaryLine}>
              {t("onboarding.previewDate", {
                date: formatPlanDate(studyPlanSetup.examDate),
              })}
            </CText>
          ) : (
            <CText style={styles.summaryLine}>
              {t("onboarding.examDateSkip")}
            </CText>
          )}
          <CText style={styles.summaryLine}>
            {t("onboarding.previewMinutes", {
              minutes: generatedPlan.minutesPerDay,
            })}
          </CText>
          <CText style={styles.summaryLine}>
            {t("onboarding.previewLevel", {
              level: t(`levels.${generatedPlan.level}.label`),
            })}
          </CText>
          {generatedPlan.schoolCode ? (
            <CText style={styles.summaryLine}>
              {t("onboarding.previewSchoolCode", {
                code: generatedPlan.schoolCode,
              })}
            </CText>
          ) : null}
        </AppCard>

        <View style={styles.metricsRow}>
          <AppCard accent>
            <CText style={styles.metricLabel}>
              {t("onboarding.previewMiniTests")}
            </CText>
            <CText style={styles.metricValue}>
              {generatedPlan.summary.miniTestDays}
            </CText>
          </AppCard>
          <AppCard accent>
            <CText style={styles.metricLabel}>
              {t("onboarding.previewFullExams")}
            </CText>
            <CText style={styles.metricValue}>
              {generatedPlan.summary.fullExamDays}
            </CText>
          </AppCard>
        </View>

        <AppCard>
          <CText style={styles.sectionTitle}>
            {t("onboarding.previewMinimumMode", {
              days: generatedPlan.summary.minimumModeDays,
            })}
          </CText>
          <CText style={styles.sectionBody}>
            {t("onboarding.previewWeakSpots", {
              days: generatedPlan.summary.weakSpotDays,
            })}
          </CText>
        </AppCard>

        {generatedPlan.days.slice(0, 5).map((day) => (
          <AppCard key={day.id}>
            <CText style={styles.dayTitle}>
              {t("onboarding.previewDayTitle", {
                dayNumber: day.dayNumber,
                date: formatPlanDate(day.planDate),
                })}
            </CText>
            {day.focusTopic ? (
              <CText style={styles.dayFocus}>
                {t("onboarding.previewFocus", {
                  topic:
                    getQuestionTopicTitleSafe(day.focusTopic, preferredLocale) ??
                    day.focusTopic,
                })}
              </CText>
            ) : null}
            <View style={styles.taskList}>
              {day.tasks.map((task) => (
                <CText key={task.id} style={styles.taskText}>
                  - {task.title} - {task.estimatedMinutes}m
                </CText>
              ))}
            </View>
          </AppCard>
        ))}

        {generatedPlan.days.length > 5 ? (
          <AppCard>
            <CText style={styles.summaryLine}>
              {t("onboarding.previewMoreDays", {
                days: generatedPlan.days.length - 5,
              })}
            </CText>
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
      fontFamily: getFontFamily("bold"),
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
      fontFamily: getFontFamily("bold"),
      marginBottom: spacing.exact(8),
    },
    metricValue: {
      fontSize: responsiveFont(28),
      fontFamily: getFontFamily("bold"),
    },
    sectionTitle: {
      fontSize: responsiveFont(16),
      fontFamily: getFontFamily("bold"),
      marginBottom: spacing.exact(8),
    },
    sectionBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    dayTitle: {
      fontSize: responsiveFont(17),
      fontFamily: getFontFamily("bold"),
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
