import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import { generateLocalStudyPlan } from "../../src/features/study-plan/generate-local-study-plan";
import { useAppShellStore } from "../../src/state/app-shell";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

const DEFAULT_MINUTES_PER_DAY = 20;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [isFinishing, setIsFinishing] = useState(false);

  const points = [
    t("onboarding.notifyPoint1"),
    t("onboarding.notifyPoint2"),
    t("onboarding.notifyPoint3"),
  ];

  const finishOnboarding = async (requestPermission: boolean) => {
    if (isFinishing) {
      return;
    }
    setIsFinishing(true);

    if (requestPermission) {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (error) {
        console.warn("Failed to request notification permissions.", error);
      }
    }

    const store = useAppShellStore.getState();
    const setup = store.studyPlanSetup;
    const level = setup.level ?? "first_time";
    const minutesPerDay = setup.minutesPerDay ?? DEFAULT_MINUTES_PER_DAY;
    const daysUntilExam =
      setup.daysUntilExam ?? STUDY_PLAN_LIMITS.recommendedDays;

    if (setup.level == null) {
      store.setLevel(level);
    }
    if (setup.minutesPerDay == null) {
      store.setMinutesPerDay(minutesPerDay);
    }

    const plan = generateLocalStudyPlan({
      category: store.preferredCategory,
      locale: store.preferredLocale,
      daysUntilExam,
      minutesPerDay,
      level,
      schoolCode: setup.schoolCode || undefined,
    });

    store.saveCurrentStudyPlan(plan);
    store.completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.body}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={28}
              color={greenWaveAccent.amber.fill}
            />
          </View>

          <Text style={styles.title}>{t("onboarding.notifyTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.notifySubtitle")}</Text>

          <View style={styles.points}>
            {points.map((point) => (
              <View key={point} style={styles.pointRow}>
                <View style={styles.pointIcon}>
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color={greenWaveAccent.green.fill}
                  />
                </View>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.paging}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isFinishing}
            onPress={() => void finishOnboarding(true)}
            style={({ pressed }) => [
              styles.cta,
              isFinishing ? styles.ctaDisabled : null,
              pressed ? styles.ctaPressed : null,
            ]}
          >
            <Text style={styles.ctaLabel}>{t("onboarding.notifyAllow")}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isFinishing}
            onPress={() => void finishOnboarding(false)}
            style={({ pressed }) => [
              styles.ghost,
              pressed ? styles.ghostPressed : null,
            ]}
          >
            <Text style={styles.ghostLabel}>{t("onboarding.notifyLater")}</Text>
          </Pressable>
        </View>
      </View>
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
  points: {
    marginTop: 32,
    gap: greenWave.spacing.md,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWaveAccent.green.soft,
  },
  pointText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: greenWave.color.ink,
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
  ctaDisabled: {
    opacity: 0.6,
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
