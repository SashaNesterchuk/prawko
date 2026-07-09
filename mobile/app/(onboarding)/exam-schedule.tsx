import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import { CalendarSheet } from "../../src/components/shell/CalendarSheet";
import {
  formatPlanDate,
  getDaysUntilExamFromDate,
  getExamDateFromDays,
} from "../../src/features/study-plan/generate-local-study-plan";
import { useAppShellStore } from "../../src/state/app-shell";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

function toIsoDate(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export default function ExamScheduleScreen() {
  const { t, i18n } = useTranslation();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setExamSchedule = useAppShellStore((state) => state.setExamSchedule);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    parseIsoDate(studyPlanSetup.examDate)
  );

  const goNext = () => {
    if (selectedDate) {
      const examDate = toIsoDate(selectedDate);
      setExamSchedule({
        daysUntilExam: Math.max(1, getDaysUntilExamFromDate(examDate)),
        examDate,
      });
    } else {
      const daysUntilExam = STUDY_PLAN_LIMITS.recommendedDays;
      setExamSchedule({
        daysUntilExam,
        examDate: getExamDateFromDays(daysUntilExam),
      });
    }

    router.push("/(onboarding)/notifications");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.body}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={28}
              color={greenWaveAccent.amber.fill}
            />
          </View>

          <Text style={styles.title}>{t("onboarding.examDateTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("onboarding.examDateSubtitle")}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerVisible(true)}
            style={({ pressed }) => [
              styles.field,
              pressed ? styles.fieldPressed : null,
            ]}
          >
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={20}
              color={
                selectedDate
                  ? greenWave.color.ink
                  : greenWave.color.inkMuted
              }
            />
            <Text
              style={[
                styles.fieldText,
                selectedDate ? styles.fieldTextFilled : null,
              ]}
            >
              {selectedDate
                ? formatPlanDate(toIsoDate(selectedDate))
                : t("onboarding.examDatePlaceholder")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.paging}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={goNext}
            style={({ pressed }) => [
              styles.cta,
              pressed ? styles.ctaPressed : null,
            ]}
          >
            <Text style={styles.ctaLabel}>{t("common.continue")}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSelectedDate(null);
              goNext();
            }}
            style={({ pressed }) => [
              styles.ghost,
              pressed ? styles.ghostPressed : null,
            ]}
          >
            <Text style={styles.ghostLabel}>{t("onboarding.examDateSkip")}</Text>
          </Pressable>
        </View>
      </View>

      <CalendarSheet
        visible={pickerVisible}
        locale={i18n.language}
        initialDate={selectedDate}
        confirmLabel={t("onboarding.examDateConfirm")}
        clearLabel={t("onboarding.examDateClear")}
        onClose={() => setPickerVisible(false)}
        onConfirm={(date) => {
          setSelectedDate(date);
          setPickerVisible(false);
        }}
        onClear={() => {
          setSelectedDate(null);
          setPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: greenWave.color.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.xl,
  },
  body: {
    flex: 1,
    paddingTop: greenWave.spacing.sm,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: greenWave.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWave.color.surface,
  },
  title: {
    marginTop: 32,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.64,
    color: greenWave.color.ink,
  },
  subtitle: {
    marginTop: greenWave.spacing.md,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "400",
    color: greenWave.color.inkSecondary,
  },
  field: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.lg,
    borderWidth: 1,
    borderColor: greenWave.color.line,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fieldPressed: {
    opacity: 0.85,
  },
  fieldText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  fieldTextFilled: {
    color: greenWave.color.ink,
    fontWeight: "500",
  },
  footer: {
    gap: greenWave.spacing.sm,
  },
  paging: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: greenWave.spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: greenWave.color.line,
  },
  dotActive: {
    width: 22,
    backgroundColor: greenWaveAccent.green.fill,
  },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.lg,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.onAccent,
  },
  ghost: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.md,
  },
  ghostPressed: {
    opacity: 0.6,
  },
  ghostLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: greenWave.color.inkSecondary,
  },
});
