import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import {
  formatPlanDate,
  getExamDateFromDays,
} from "../../src/features/study-plan/generate-local-study-plan";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

const DAY_OPTIONS = [7, 10, 14, 21, 30] as const;

export default function ExamScheduleScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setExamSchedule = useAppShellStore((state) => state.setExamSchedule);
  const selectedDays =
    studyPlanSetup.daysUntilExam ?? STUDY_PLAN_LIMITS.recommendedDays;
  const examDate = getExamDateFromDays(selectedDays);

  return (
    <AppScreen
      title={t("onboarding.examScheduleTitle")}
      subtitle={t("onboarding.examScheduleSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              setExamSchedule({
                daysUntilExam: selectedDays,
                examDate,
              });
              router.push("/(onboarding)/minutes");
            }}
          />
          <AppButton
            variant="ghost"
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        {DAY_OPTIONS.map((days) => {
          const isActive = selectedDays === days;

          return (
            <AppCard
              key={days}
              accent={isActive}
              onPress={() =>
                setExamSchedule({
                  daysUntilExam: days,
                  examDate: getExamDateFromDays(days),
                })
              }
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                {t("onboarding.examScheduleOption", { days })}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: theme.colors.textSecondary,
                }}
              >
                {t("onboarding.examScheduleDate", {
                  date: formatPlanDate(getExamDateFromDays(days)),
                })}
              </Text>
            </AppCard>
          );
        })}

        <AppCard>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: theme.colors.textSecondary,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {t("onboarding.examSchedulePreviewLabel")}
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: theme.colors.textPrimary,
            }}
          >
            {formatPlanDate(examDate)}
          </Text>
        </AppCard>
      </View>
    </AppScreen>
  );
}
