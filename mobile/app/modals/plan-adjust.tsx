import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  formatPlanDate,
  generateAdjustedStudyPlan,
  getDaysUntilExamFromDate,
  getExamDateFromDays,
} from "../../src/features/study-plan/generate-local-study-plan";
import { saveGeneratedStudyPlanRemotely } from "../../src/features/study-plan/supabase-study-plan";
import {
  useCurrentStudyPlan,
  useAppShellStore,
} from "../../src/state/app-shell";

const DAY_PRESETS = [1, 3, 5, 7, 10, 14, 21, 30] as const;

export default function PlanAdjustModalScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const params = useLocalSearchParams<{
    missedDays?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlan = useCurrentStudyPlan();
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const hydrateRemoteStudyPlan = useAppShellStore(
    (state) => state.hydrateRemoteStudyPlan
  );
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const storedSchoolCode = useAppShellStore(
    (state) => state.studyPlanSetup.schoolCode
  );
  const currentLevel = currentStudyPlan?.level ?? null;
  const missedDays = parsePositiveInteger(getSingleParam(params.missedDays)) ?? 0;
  const [examDateInput, setExamDateInput] = useState(
    currentStudyPlan?.examDate ?? getExamDateFromDays(STUDY_PLAN_LIMITS.recommendedDays)
  );
  const [minutesInput, setMinutesInput] = useState(
    String(
      currentStudyPlan?.minutesPerDay ?? STUDY_PLAN_LIMITS.minMinutesPerDay
    )
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedExamDate = parseStrictIsoDate(examDateInput);
  const normalizedMinutes = parseInteger(minutesInput);
  const daysUntilExam = normalizedExamDate
    ? getDaysUntilExamFromDate(normalizedExamDate)
    : null;
  const dateError = getDateError({
    daysUntilExam,
    normalizedExamDate,
    t,
  });
  const minutesError = getMinutesError({
    minutesPerDay: normalizedMinutes,
    t,
  });
  const previewPlan =
    currentStudyPlan &&
    currentLevel &&
    normalizedExamDate &&
    normalizedMinutes !== null &&
    !dateError &&
    !minutesError
      ? generateAdjustedStudyPlan({
          category: currentStudyPlan.category ?? preferredCategory,
          examDate: normalizedExamDate,
          level: currentLevel,
          locale: currentStudyPlan.locale ?? preferredLocale,
          minutesPerDay: normalizedMinutes,
          schoolCode: storedSchoolCode || currentStudyPlan.schoolCode,
        })
      : null;

  async function handleSubmit() {
    if (
      !currentStudyPlan ||
      !currentLevel ||
      !normalizedExamDate ||
      normalizedMinutes === null ||
      dateError ||
      minutesError ||
      !previewPlan ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      let nextRemoteId: string | null = null;

      if (authMode === "supabase" && isMobileSupabaseConfigured) {
        nextRemoteId = await saveGeneratedStudyPlanRemotely({
          plan: previewPlan,
          generationContext: {
            days_until_exam: daysUntilExam,
            from_exam_date: currentStudyPlan.examDate,
            from_minutes_per_day: currentStudyPlan.minutesPerDay,
            generated_at: new Date().toISOString(),
            missed_days: missedDays,
            previous_plan_id: currentStudyPlanRemoteId,
            reason: getAdjustmentReason({
              currentExamDate: currentStudyPlan.examDate,
              currentMinutesPerDay: currentStudyPlan.minutesPerDay,
              missedDays,
              nextExamDate: normalizedExamDate,
              nextMinutesPerDay: normalizedMinutes,
            }),
            source: "mobile_plan_adjust_modal",
            to_exam_date: normalizedExamDate,
            to_minutes_per_day: normalizedMinutes,
          },
        });
      }

      hydrateRemoteStudyPlan({
        plan: previewPlan,
        remoteId: nextRemoteId,
      });

      router.back();
    } catch (error) {
      console.warn("Failed to adjust study plan.", error);
      setFormError(t("modals.planAdjust.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen
      title={t("modals.planAdjust.title")}
      subtitle={t("modals.planAdjust.subtitle")}
      footer={
        <View style={styles.footerStack}>
          {currentStudyPlan && currentLevel ? (
            <AppButton
              disabled={!previewPlan || isSubmitting}
              label={t(
                isSubmitting
                  ? "modals.planAdjust.submitLoading"
                  : "modals.planAdjust.submit"
              )}
              onPress={() => void handleSubmit()}
            />
          ) : (
            <AppButton
              label={t("home.openPlanPreview")}
              onPress={() => router.replace("/(onboarding)/preview")}
            />
          )}
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={styles.contentStack}>
        {!currentStudyPlan || !currentLevel ? (
          <AppCard>
            <CText style={styles.sectionTitle}>
              {t("modals.planAdjust.missingPlanTitle")}
            </CText>
            <CText style={styles.bodyText}>
              {t("modals.planAdjust.missingPlanBody")}
            </CText>
          </AppCard>
        ) : (
          <>
            {missedDays > 0 ? (
              <AppCard accent>
                <CText style={styles.sectionTitle}>
                  {t("modals.planAdjust.missedDaysTitle")}
                </CText>
                <CText style={styles.bodyText}>
                  {t("modals.planAdjust.missedDaysBody", {
                    days: missedDays,
                  })}
                </CText>
              </AppCard>
            ) : null}

            <AppCard>
              <CText style={styles.sectionTitle}>
                {t("modals.planAdjust.currentPlanTitle")}
              </CText>
              <CText style={styles.bodyText}>
                {t("modals.planAdjust.currentPlanDate", {
                  date: formatPlanDate(currentStudyPlan.examDate),
                })}
              </CText>
              <CText style={styles.bodyText}>
                {t("modals.planAdjust.currentPlanMinutes", {
                  minutes: currentStudyPlan.minutesPerDay,
                })}
              </CText>
            </AppCard>

            <AppCard>
              <CText style={styles.sectionTitle}>
                {t("modals.planAdjust.presetsTitle")}
              </CText>
              <CText style={styles.bodyText}>
                {t("modals.planAdjust.presetsSubtitle")}
              </CText>
              <View style={styles.presetGrid}>
                {DAY_PRESETS.map((days) => {
                  const presetDate = getExamDateFromDays(days);
                  const isActive = normalizedExamDate === presetDate;

                  return (
                    <Pressable
                      key={days}
                      accessibilityRole="button"
                      onPress={() => {
                        setExamDateInput(presetDate);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.presetButton,
                        isActive ? styles.presetButtonActive : null,
                        pressed ? styles.presetButtonPressed : null,
                      ]}
                    >
                      <CText
                        style={[
                          styles.presetLabel,
                          isActive ? styles.presetLabelActive : null,
                        ]}
                      >
                        {t("modals.planAdjust.presetDays", { days })}
                      </CText>
                      <CText style={styles.presetMeta}>
                        {formatPlanDate(presetDate)}
                      </CText>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard>
              <CText style={styles.sectionTitle}>
                {t("modals.planAdjust.inputsTitle")}
              </CText>
              <AppTextInput
                autoCapitalize="none"
                editable={!isSubmitting}
                label={t("modals.planAdjust.examDateLabel")}
                onChangeText={(value) => {
                  setExamDateInput(value);
                  setFormError(null);
                }}
                placeholder="2026-06-15"
                value={examDateInput}
              />
              {dateError ? <CText style={styles.errorText}>{dateError}</CText> : null}
              <AppTextInput
                editable={!isSubmitting}
                keyboardType="number-pad"
                label={t("modals.planAdjust.minutesLabel")}
                onChangeText={(value) => {
                  setMinutesInput(value.replace(/[^0-9]/g, "").slice(0, 3));
                  setFormError(null);
                }}
                placeholder="25"
                value={minutesInput}
              />
              {minutesError ? (
                <CText style={styles.errorText}>{minutesError}</CText>
              ) : null}
            </AppCard>

            {previewPlan ? (
              <AppCard accent>
                <CText style={styles.sectionTitle}>
                  {t("modals.planAdjust.previewTitle")}
                </CText>
                <CText style={styles.bodyText}>
                  {t("modals.planAdjust.previewDate", {
                    date: formatPlanDate(previewPlan.examDate),
                  })}
                </CText>
                <CText style={styles.bodyText}>
                  {t("modals.planAdjust.previewPace", {
                    days: previewPlan.daysPlanned,
                    minutes: previewPlan.minutesPerDay,
                  })}
                </CText>
                <CText style={styles.bodyText}>
                  {t("modals.planAdjust.previewMix", {
                    full: previewPlan.summary.fullExamDays,
                    mini: previewPlan.summary.miniTestDays,
                    weak: previewPlan.summary.weakSpotDays,
                  })}
                </CText>
                {previewPlan.summary.minimumModeDays > 0 ? (
                  <CText style={styles.bodyText}>
                    {t("modals.planAdjust.previewMinimum", {
                      days: previewPlan.summary.minimumModeDays,
                    })}
                  </CText>
                ) : null}
              </AppCard>
            ) : null}

            {formError ? <CText style={styles.errorText}>{formError}</CText> : null}
          </>
        )}
      </View>
    </AppScreen>
  );
}

function getAdjustmentReason({
  currentExamDate,
  currentMinutesPerDay,
  missedDays,
  nextExamDate,
  nextMinutesPerDay,
}: {
  currentExamDate: string;
  currentMinutesPerDay: number;
  missedDays: number;
  nextExamDate: string;
  nextMinutesPerDay: number;
}) {
  const examDateChanged = currentExamDate !== nextExamDate;
  const minutesChanged = currentMinutesPerDay !== nextMinutesPerDay;

  if (examDateChanged && minutesChanged) {
    return "exam_date_and_pace_change";
  }

  if (examDateChanged) {
    return "exam_date_change";
  }

  if (minutesChanged) {
    return "pace_change";
  }

  if (missedDays > 0) {
    return "missed_days";
  }

  return "manual_adjust";
}

function getDateError({
  daysUntilExam,
  normalizedExamDate,
  t,
}: {
  daysUntilExam: number | null;
  normalizedExamDate: string | null;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (!normalizedExamDate) {
    return t("modals.planAdjust.errors.invalidDate");
  }

  if (daysUntilExam === null || daysUntilExam < 1) {
    return t("modals.planAdjust.errors.minDays");
  }

  if (daysUntilExam > STUDY_PLAN_LIMITS.maxDays) {
    return t("modals.planAdjust.errors.maxDays", {
      days: STUDY_PLAN_LIMITS.maxDays,
    });
  }

  return null;
}

function getMinutesError({
  minutesPerDay,
  t,
}: {
  minutesPerDay: number | null;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (minutesPerDay === null) {
    return t("modals.planAdjust.errors.invalidMinutes");
  }

  if (minutesPerDay < STUDY_PLAN_LIMITS.minMinutesPerDay) {
    return t("modals.planAdjust.errors.minMinutes", {
      minutes: STUDY_PLAN_LIMITS.minMinutesPerDay,
    });
  }

  if (minutesPerDay > STUDY_PLAN_LIMITS.maxMinutesPerDay) {
    return t("modals.planAdjust.errors.maxMinutes", {
      minutes: STUDY_PLAN_LIMITS.maxMinutesPerDay,
    });
  }

  return null;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseInteger(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStrictIsoDate(value: string) {
  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [year, month, day] = trimmed
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

function useStyles() {
  return useResponsiveStyles(({ accents, colors, radius, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    contentStack: {
      gap: spacing.exact(12),
    },
    bodyText: {
      color: colors.textPrimary,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    errorText: {
      color: accents.red.ink,
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
    },
    presetButton: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSoft,
      borderRadius: radius.large,
      borderWidth: 1,
      gap: spacing.exact(4),
      minWidth: "47%",
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(12),
    },
    presetButtonActive: {
      backgroundColor: colors.cardAccent,
      borderColor: colors.accentMuted,
    },
    presetButtonPressed: {
      opacity: 0.84,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.exact(8),
      marginTop: spacing.exact(12),
    },
    presetLabel: {
      color: colors.textPrimary,
      fontSize: responsiveFont(14),
      fontFamily: getFontFamily("bold"),
    },
    presetLabelActive: {
      color: colors.textPrimary,
    },
    presetMeta: {
      color: colors.textSecondary,
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(18),
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: responsiveFont(13),
      fontFamily: getFontFamily("bold"),
      marginBottom: spacing.exact(8),
      textTransform: "uppercase",
    },
  }));
}
