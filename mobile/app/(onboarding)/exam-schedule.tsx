import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import { Icon } from "../../src/components/icons";
import { CalendarSheet } from "../../src/components/shell/CalendarSheet";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { useResponsiveFonts, useResponsiveStyles } from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  parseNullableIsoDate,
  toIsoDate,
} from "../../src/features/study-plan/exam-date";
import {
  formatPlanDate,
  getDaysUntilExamFromDate,
  getExamDateFromDays,
} from "../../src/features/study-plan/generate-local-study-plan";
import { useAppShellStore } from "../../src/state/app-shell";

export default function ExamScheduleScreen() {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setExamSchedule = useAppShellStore((state) => state.setExamSchedule);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    parseNullableIsoDate(studyPlanSetup.examDate)
  );
  const badgeIconSize = responsiveFont(28);
  const fieldIconSize = responsiveFont(20);

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

    router.navigate("/(onboarding)/notifications");
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.body}>
            <View style={styles.iconBadge}>
              <Icon name="calendar" size={badgeIconSize} color={colors.icon} />
            </View>

            <Text
              style={styles.title}
              testID="screen-onboarding-exam-schedule"
            >
              {t("onboarding.examDateTitle")}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerVisible(true)}
              style={({ pressed }) => [
                styles.field,
                pressed ? styles.fieldPressed : null,
              ]}
              testID="onboarding-exam-date-field"
            >
              <Icon
                name="calendar"
                size={fieldIconSize}
                color={
                  selectedDate ? colors.textPrimary : colors.textMuted
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
              testID="onboarding-exam-schedule-continue"
            >
              <Text style={styles.ctaLabel}>{t("common.continue")}</Text>
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
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      content: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      body: {
        flex: 1,
      },
      iconBadge: {
        width: spacing.exact(56),
        height: spacing.exact(56),
        borderRadius: spacing.exact(18),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
      },
      title: {
        marginTop: spacing.exact(32),
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(32),
        fontWeight: "700",
        letterSpacing: -0.64,
        color: colors.textPrimary,
      },
      field: {
        marginTop: spacing.exact(16),
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: spacing.exact(12),
        shadowOffset: { width: 0, height: spacing.exact(2) },
        elevation: 1,
      },
      fieldPressed: {
        opacity: 0.85,
      },
      fieldText: {
        flex: 1,
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontWeight: "400",
        color: colors.textMuted,
      },
      fieldTextFilled: {
        color: colors.textPrimary,
        fontWeight: "500",
      },
      footer: {
        gap: spacing.exact(20),
      },
      paging: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(7),
        paddingVertical: spacing.exact(12),
      },
      dot: {
        width: spacing.exact(7),
        height: spacing.exact(7),
        borderRadius: spacing.exact(4),
        backgroundColor: colors.line,
      },
      dotActive: {
        width: spacing.exact(22),
        backgroundColor: accents.green.fill,
      },
      cta: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(24),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(36),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 6,
      },
      ctaPressed: {
        opacity: 0.9,
      },
      ctaLabel: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
    })
  );
}
