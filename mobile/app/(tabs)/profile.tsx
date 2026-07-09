import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ProfilePremiumBanner } from "../../src/components/shell/ProfilePremiumBanner";
import {
  ProfileSettingsGroup,
  ProfileSettingsRow,
} from "../../src/components/shell/ProfileSettingsGroup";
import { ProfileStatsCard } from "../../src/components/shell/ProfileStatsCard";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import {
  buildWeekActivity,
  formatProfileExamDate,
  getProfileStatMetrics,
} from "../../src/features/profile/profile-stats";
import {
  getDaysUntilExamFromDate,
} from "../../src/features/study-plan/generate-local-study-plan";
import { getMobileSupabaseClient } from "../../src/lib/supabase";
import {
  useHasPlusAccess,
} from "../../src/state/entitlements";
import {
  useCurrentStudyPlan,
  useAppShellStore,
} from "../../src/state/app-shell";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { resetAppToFreshStart } from "../../src/state/reset-app";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

const SUPPORT_EMAIL = "support@prawko.app";

export default function ProfileTabScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const signOutLocal = useAppShellStore((state) => state.signOutLocal);
  const currentStudyPlan = useCurrentStudyPlan();
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const resetProgress = useQuestionProgressStore((state) => state.resetProgress);
  const hasPlusAccess = useHasPlusAccess();
  const [examCount, setExamCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void Notifications.getPermissionsAsync()
      .then(({ status }) => {
        setNotificationsEnabled(status === "granted");
      })
      .catch(() => {
        setNotificationsEnabled(false);
      });
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setExamCount(0);
      return;
    }

    let cancelled = false;

    void fetchRecentExamSessions(100)
      .then((sessions) => {
        if (!cancelled) {
          setExamCount(sessions.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExamCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, isFocused]);

  const metrics = useMemo(
    () => getProfileStatMetrics(attempts, examCount),
    [attempts, examCount]
  );

  const weekDays = useMemo(
    () => buildWeekActivity(attempts, preferredLocale),
    [attempts, preferredLocale]
  );

  const examDate = currentStudyPlan?.examDate ?? null;
  const daysUntilExam =
    examDate != null ? getDaysUntilExamFromDate(examDate) : null;
  const localeLabel = t(`languages.${preferredLocale}.label`);

  const handleToggleNotifications = async (nextValue: boolean) => {
    if (nextValue) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotificationsEnabled(status === "granted");
      } catch {
        setNotificationsEnabled(false);
      }
      return;
    }

    Alert.alert(
      t("profile.notificationsDisableTitle"),
      t("profile.notificationsDisableMessage")
    );
  };

  const handleResetAll = () => {
    Alert.alert(t("profile.resetTitle"), t("profile.resetMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.resetConfirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            await resetAppToFreshStart();
            router.replace("/(onboarding)/category");
          })();
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      try {
        await getMobileSupabaseClient().auth.signOut();
      } catch {
        // ignore here; the shell still needs a local fallback reset
      }
    }

    signOutLocal();
    resetProgress();
    Toast.show({
      type: "success",
      text1: t("toasts.signedOutTitle"),
      text2: t("toasts.signedOutSubtitle"),
    });
    router.replace("/(onboarding)/access");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t("profile.shareMessage"),
      });
    } catch {
      // user dismissed
    }
  };

  const handleFeedback = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("profile.feedbackEmailSubject"))}`);
  };

  const handleSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 96 + safeBottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ProfileStatsCard
            title={t("profile.statsTitle")}
            detailsLabel={t("profile.statsDetails")}
            metrics={metrics}
            metricLabels={{
              sessions: t("profile.statSessions"),
              accuracy: t("profile.statAccuracy"),
              exams: t("profile.statExams"),
              streak: t("profile.statStreak"),
            }}
            weekDays={weekDays}
            onPressDetails={() => router.push("/practice")}
          />

          {!hasPlusAccess ? (
            <ProfilePremiumBanner
              title={t("profile.premiumTitle")}
              description={t("profile.premiumDescription")}
              onPress={() => router.push("/paywall")}
            />
          ) : null}

          <ProfileSettingsGroup>
            <ProfileSettingsRow
              title={t("profile.examDateTitle")}
              subtitle={
                daysUntilExam != null
                  ? t("profile.examDateSubtitle", { days: Math.max(0, daysUntilExam) })
                  : undefined
              }
              value={
                examDate != null
                  ? formatProfileExamDate(examDate, preferredLocale)
                  : t("profile.examDateMissing")
              }
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="calendar-outline"
                  size={24}
                />
              }
              onPress={() => router.push("/modals/plan-adjust")}
            />
            <ProfileSettingsRow
              title={t("profile.categoryTitle")}
              value={preferredCategory}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="car-outline"
                  size={24}
                />
              }
              onPress={() => router.push("/(onboarding)/category")}
            />
            <ProfileSettingsRow
              title={t("profile.languageTitle")}
              value={localeLabel}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="language-outline"
                  size={24}
                />
              }
              onPress={() => router.push("/(onboarding)/language")}
            />
            <ProfileSettingsRow
              title={t("profile.notificationsTitle")}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="notifications-outline"
                  size={24}
                />
              }
              trailing="switch"
              switchValue={notificationsEnabled}
              onSwitchChange={(value) => void handleToggleNotifications(value)}
            />
            <ProfileSettingsRow
              title={t("profile.offlineTitle")}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="cloud-download-outline"
                  size={24}
                />
              }
              trailing="premium"
              isLast
              onPress={() =>
                hasPlusAccess
                  ? router.push("/modals/access-center")
                  : router.push("/paywall")
              }
            />
          </ProfileSettingsGroup>

          <ProfileSettingsGroup>
            <ProfileSettingsRow
              title={t("profile.feedbackTitle")}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="chatbubble-ellipses-outline"
                  size={24}
                />
              }
              trailing="none"
              onPress={handleFeedback}
            />
            <ProfileSettingsRow
              title={t("profile.supportTitle")}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="help-circle-outline"
                  size={24}
                />
              }
              trailing="none"
              onPress={handleSupport}
            />
            <ProfileSettingsRow
              title={t("profile.shareTitle")}
              icon={
                <Ionicons
                  color={greenWave.color.inkSecondary}
                  name="share-social-outline"
                  size={24}
                />
              }
              trailing="none"
              isLast
              onPress={() => void handleShare()}
            />
          </ProfileSettingsGroup>

          <Pressable
            accessibilityRole="button"
            onLongPress={() => void handleSignOut()}
            onPress={handleResetAll}
            style={({ pressed }) => [
              styles.resetCard,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.resetIconWrap}>
              <Ionicons
                color={greenWaveAccent.red.ink}
                name="refresh-outline"
                size={24}
              />
            </View>
            <Text style={styles.resetTitle}>{t("profile.resetProgress")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.xl,
  },
  resetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  resetIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWaveAccent.red.soft,
  },
  resetTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWaveAccent.red.ink,
  },
});
