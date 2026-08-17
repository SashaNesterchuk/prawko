import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../../src/components/icons";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { finalizeLocalOnboarding } from "../../src/features/onboarding/finalize-local-onboarding";
import {
  disableStudyNotificationsAsync,
  enableStudyNotificationsAsync,
} from "../../src/features/notifications/runtime";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { ANALYTICS_EVENTS, getAnalyticsErrorCode } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const [isFinishing, setIsFinishing] = useState(false);
  const badgeIconSize = responsiveFont(28);
  const pointCheckSize = responsiveFont(24);

  const points = [t("onboarding.notifyPoint1"), t("onboarding.notifyPoint2")];

  const finishOnboarding = async (requestPermission: boolean) => {
    if (isFinishing) {
      return;
    }
    setIsFinishing(true);

    if (requestPermission) {
      track(ANALYTICS_EVENTS.notificationPermissionRequested.key, {
        source: "onboarding",
      });
      try {
        const result = await enableStudyNotificationsAsync();
        track(ANALYTICS_EVENTS.notificationPermissionResolved.key, {
          can_ask_again: result.ok ? null : result.canAskAgain,
          enabled: result.ok,
          source: "onboarding",
        });
      } catch (error) {
        console.warn("Failed to enable study notifications.", error);
        track(ANALYTICS_EVENTS.notificationPermissionResolved.key, {
          enabled: false,
          error_code: getAnalyticsErrorCode(error),
          source: "onboarding",
        });
      }
    } else {
      try {
        await disableStudyNotificationsAsync();
      } catch (error) {
        console.warn("Failed to disable study notifications.", error);
      }
    }

    finalizeLocalOnboarding();
    track(ANALYTICS_EVENTS.onboardingStepCompleted.key, {
      notifications_requested: requestPermission,
      step: "notifications",
    });
    router.replace("/(tabs)");
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.body}>
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Icon
                  name="notification"
                  size={badgeIconSize}
                  color={colors.icon}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={isFinishing}
                onPress={() => void finishOnboarding(false)}
                style={({ pressed }) => [
                  styles.skip,
                  pressed ? styles.skipPressed : null,
                ]}
                testID="onboarding-notifications-skip"
              >
                <CText style={styles.skipLabel}>
                  {t("onboarding.notifyLater")}
                </CText>
              </Pressable>
            </View>

            <CText
              style={styles.title}
              testID="screen-onboarding-notifications"
            >
              {t("onboarding.notifyTitle")}
            </CText>
            <CText style={styles.subtitle}>{t("onboarding.notifySubtitle")}</CText>

            <View style={styles.points}>
              {points.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointIcon}>
                    <Icon
                      name="check"
                      size={pointCheckSize}
                      color={accents.green.ink}
                    />
                  </View>
                  <CText style={styles.pointText}>{point}</CText>
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
              testID="onboarding-notifications-allow"
            >
              <CText style={styles.ctaLabel}>{t("onboarding.notifyAllow")}</CText>
            </Pressable>
          </View>
        </View>
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
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      iconBadge: {
        width: spacing.exact(56),
        height: spacing.exact(56),
        borderRadius: spacing.exact(18),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
      },
      skip: {
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      skipPressed: {
        opacity: 0.6,
      },
      skipLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.textSecondary,
      },
      title: {
        marginTop: spacing.exact(32),
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        color: colors.textPrimary,
      },
      subtitle: {
        marginTop: spacing.exact(16),
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
        alignItems: "flex-start",
        gap: spacing.exact(12),
      },
      pointIcon: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.soft,
      },
      pointText: {
        flex: 1,
        paddingVertical: spacing.exact(8),
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.textPrimary,
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
        color: colors.onAccent,
      },
    })
  );
}
