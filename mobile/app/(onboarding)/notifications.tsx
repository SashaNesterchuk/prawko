import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STUDY_PLAN_LIMITS } from "@prawko/config";

import {
  disableStudyNotificationsAsync,
  enableStudyNotificationsAsync,
} from "../../src/features/notifications/runtime";
import { generateLocalStudyPlan } from "../../src/features/study-plan/generate-local-study-plan";
import {
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

const DEFAULT_MINUTES_PER_DAY = 20;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const [isFinishing, setIsFinishing] = useState(false);
  const badgeIconSize = responsiveFont(28);
  const pointCheckSize = responsiveFont(18);

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
        await enableStudyNotificationsAsync();
      } catch (error) {
        console.warn("Failed to enable study notifications.", error);
      }
    } else {
      try {
        await disableStudyNotificationsAsync();
      } catch (error) {
        console.warn("Failed to disable study notifications.", error);
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
              size={badgeIconSize}
              color={accents.amber.fill}
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
                    size={pointCheckSize}
                    color={accents.green.fill}
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

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
        backgroundColor: colors.background,
      },
      content: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      body: {
        flex: 1,
        paddingTop: spacing.exact(8),
      },
      iconBadge: {
        width: spacing.exact(56),
        height: spacing.exact(56),
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
      },
      title: {
        marginTop: spacing.exact(32),
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(38),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -0.64,
        color: colors.textPrimary,
      },
      subtitle: {
        marginTop: spacing.exact(12),
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("regular"),
        color: colors.textSecondary,
      },
      points: {
        marginTop: spacing.exact(32),
        gap: spacing.exact(12),
      },
      pointRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      pointIcon: {
        width: spacing.exact(34),
        height: spacing.exact(34),
        borderRadius: spacing.exact(10),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.soft,
      },
      pointText: {
        flex: 1,
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.textPrimary,
      },
      footer: {
        gap: spacing.exact(8),
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
        paddingVertical: spacing.exact(16),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(18),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 6,
      },
      ctaDisabled: {
        opacity: 0.6,
      },
      ctaPressed: {
        opacity: 0.9,
      },
      ctaLabel: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      ghost: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.exact(12),
      },
      ghostPressed: {
        opacity: 0.6,
      },
      ghostLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.textSecondary,
      },
    })
  );
}
