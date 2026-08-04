import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarSheet } from "../../src/components/shell/CalendarSheet";
import { ProfilePremiumBanner } from "../../src/components/shell/ProfilePremiumBanner";
import {
  ProfileSettingsGroup,
  ProfileSettingsRow,
} from "../../src/components/shell/ProfileSettingsGroup";
import { ProfileStatsCard } from "../../src/components/shell/ProfileStatsCard";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TrainingExitDialog } from "../../src/components/shell/TrainingExitDialog";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  disableStudyNotificationsAsync,
  enableStudyNotificationsAsync,
  syncNotificationStateAsync,
} from "../../src/features/notifications/runtime";
import {
  formatProfileExamDate,
  getCurrentStreakFromAttempts,
} from "../../src/features/profile/profile-stats";
import {
  formatOfflineBytes,
  type OfflinePackSnapshot,
  readOfflinePackSnapshot,
} from "../../src/features/offline/offline-pack";
import { getQuestionBank } from "../../src/features/questions/question-bank";
import { getQuestionDisplayStats } from "../../src/features/questions/question-engine";
import {
  applyExamDateChange,
  parseNullableIsoDate,
  toIsoDate,
} from "../../src/features/study-plan/exam-date";
import {
  getDaysUntilExamFromDate,
} from "../../src/features/study-plan/generate-local-study-plan";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { getMobileSupabaseClient } from "../../src/lib/supabase";
import {
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useHasPlusAccess,
} from "../../src/state/entitlements";
import {
  useCurrentStudyPlan,
  useAppShellStore,
} from "../../src/state/app-shell";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStatus,
  useQuestionCatalogVersion,
} from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import { resetAppToFreshStart } from "../../src/state/reset-app";

const SUPPORT_EMAIL = "support@prawko.app";

export default function ProfileTabScreen() {
  const { t, i18n } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom });
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const notificationsEnabled = useAppShellStore(
    (state) => state.isScheduleNotificationEnabled
  );
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const hydrateRemoteStudyPlan = useAppShellStore(
    (state) => state.hydrateRemoteStudyPlan
  );
  const patchExamDate = useAppShellStore((state) => state.patchExamDate);
  const signOutLocal = useAppShellStore((state) => state.signOutLocal);
  const currentStudyPlan = useCurrentStudyPlan();
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const resetProgress = useQuestionProgressStore((state) => state.resetProgress);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionCatalogResolved = useQuestionCatalogResolved();
  const questionCatalogStatus = useQuestionCatalogStatus();
  const hasPlusAccess = useHasPlusAccess();
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [examDatePickerVisible, setExamDatePickerVisible] = useState(false);
  const [isSavingExamDate, setIsSavingExamDate] = useState(false);
  const [offlineSnapshot, setOfflineSnapshot] =
    useState<OfflinePackSnapshot | null>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void syncNotificationStateAsync();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setReadinessSummary(null);
      return;
    }

    let cancelled = false;

    void fetchRemoteHomeProgress(getWarsawIsoDate())
      .then(({ readinessSummary: summary }) => {
        if (!cancelled) {
          setReadinessSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadinessSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    const questionBank =
      questionCatalogResolved &&
      (questionCatalogStatus === "remote" || questionCatalogStatus === "offline")
        ? getQuestionBank()
        : null;

    void readOfflinePackSnapshot({
      currentCategory: preferredCategory,
      questionBank,
    })
      .then((nextSnapshot) => {
        if (!cancelled) {
          setOfflineSnapshot(nextSnapshot);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOfflineSnapshot(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isFocused,
    preferredCategory,
    questionCatalogResolved,
    questionCatalogStatus,
    questionCatalogVersion,
  ]);

  const questionStats = useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const metrics = useMemo(() => {
    const localReadiness =
      questionStats.total > 0
        ? Math.round((questionStats.seen / questionStats.total) * 100)
        : 0;
    const coverage =
      questionStats.total > 0
        ? Math.round((questionStats.seen / questionStats.total) * 100)
        : 0;

    return {
      readiness: Math.round(
        readinessSummary?.readinessScore ?? localReadiness
      ),
      coverage,
      streak: getCurrentStreakFromAttempts(attempts),
    };
  }, [attempts, questionStats, readinessSummary]);

  const examDate =
    currentStudyPlan?.examDate ?? studyPlanSetup.examDate ?? null;
  const daysUntilExam =
    examDate != null ? getDaysUntilExamFromDate(examDate) : null;
  const localeLabel = t(`languages.${preferredLocale}.label`);
  const iconSize = responsiveFont(24);
  const offlineRowValue = hasPlusAccess
    ? getProfileOfflineBadge(t, offlineSnapshot)
    : undefined;
  const offlineRowSubtitle = getProfileOfflineSubtitle({
    currentCategory: preferredCategory,
    snapshot: offlineSnapshot,
    t,
  });

  const handleConfirmExamDate = async (date: Date) => {
    if (isSavingExamDate) {
      return;
    }

    setIsSavingExamDate(true);
    try {
      await applyExamDateChange({
        authMode,
        currentStudyPlan,
        currentStudyPlanRemoteId,
        examDate: toIsoDate(date),
        hydrateRemoteStudyPlan,
        preferredCategory,
        preferredLocale,
        patchExamDate,
        schoolCode: studyPlanSetup.schoolCode,
      });
      setExamDatePickerVisible(false);
    } catch (error) {
      console.warn("Failed to update exam date.", error);
    } finally {
      setIsSavingExamDate(false);
    }
  };

  const handleToggleNotifications = async (nextValue: boolean) => {
    try {
      if (nextValue) {
        await enableStudyNotificationsAsync();
        return;
      }

      await disableStudyNotificationsAsync();
    } catch (error) {
      console.warn("Failed to toggle study notifications.", error);
    }
  };

  const handleResetAll = () => {
    setShowResetDialog(true);
  };

  const handleDismissResetDialog = () => {
    setShowResetDialog(false);
  };

  const handleConfirmReset = () => {
    setShowResetDialog(false);
    void (async () => {
      await resetAppToFreshStart();
      router.replace("/(onboarding)/category");
    })();
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
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-profile"
      >
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {!hasPlusAccess ? (
            <ProfilePremiumBanner
              title={t("profile.premiumTitle")}
              description={t("profile.premiumDescription")}
              priceBadge={t("profile.premiumPriceBadge", {
                price: t("paywall.ctaFallbackPrice"),
              })}
              onPress={() => router.navigate("/paywall")}
            />
          ) : null}

          <ProfileStatsCard
            title={t("profile.statsTitle")}
            detailsLabel={t("profile.statsDetails")}
            metrics={metrics}
            metricLabels={{
              readiness: t("profile.statReadiness"),
              coverage: t("profile.statCoverage"),
              streak: t("profile.statStreak"),
            }}
            onPressDetails={() => router.navigate("/statistics")}
          />

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
                  color={colors.textSecondary}
                  name="calendar-outline"
                  size={iconSize}
                />
              }
              onPress={() => setExamDatePickerVisible(true)}
            />
            <ProfileSettingsRow
              title={t("profile.categoryTitle")}
              value={preferredCategory}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="car-outline"
                  size={iconSize}
                />
              }
              onPress={() =>
                router.navigate({
                  pathname: "/(onboarding)/category",
                  params: { mode: "settings" },
                })
              }
            />
            <ProfileSettingsRow
              title={t("profile.languageTitle")}
              value={localeLabel}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="language-outline"
                  size={iconSize}
                />
              }
              onPress={() =>
                router.navigate({
                  pathname: "/(onboarding)/language",
                  params: { mode: "settings" },
                })
              }
            />
            <ProfileSettingsRow
              title={t("profile.notificationsTitle")}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="notifications-outline"
                  size={iconSize}
                />
              }
              trailing="switch"
              switchValue={notificationsEnabled}
              onSwitchChange={(value) => void handleToggleNotifications(value)}
            />
            <ProfileSettingsRow
              title={t("profile.offlineModeTitle")}
              subtitle={offlineRowSubtitle}
              testID="profile-row-offline-mode"
              value={offlineRowValue}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="download-outline"
                  size={iconSize}
                />
              }
              trailing={hasPlusAccess ? "value" : "premium"}
              onPress={() => router.navigate("/modals/offline-mode")}
            />
            <ProfileSettingsRow
              title={t("profile.plusTitle")}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="star-outline"
                  size={iconSize}
                />
              }
              isLast
              onPress={() =>
                hasPlusAccess
                  ? router.navigate("/modals/access-center")
                  : router.navigate("/paywall")
              }
            />
          </ProfileSettingsGroup>

          <ProfileSettingsGroup>
            <ProfileSettingsRow
              title={t("profile.feedbackTitle")}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="chatbubble-ellipses-outline"
                  size={iconSize}
                />
              }
              trailing="none"
              onPress={handleFeedback}
            />
            <ProfileSettingsRow
              title={t("profile.supportTitle")}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="help-circle-outline"
                  size={iconSize}
                />
              }
              trailing="none"
              onPress={handleSupport}
            />
            <ProfileSettingsRow
              title={t("profile.shareTitle")}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="share-social-outline"
                  size={iconSize}
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
                color={accents.red.ink}
                name="refresh-outline"
                size={iconSize}
              />
            </View>
            <Text style={styles.resetTitle}>{t("profile.resetProgress")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <TrainingExitDialog
        body={t("profile.resetMessage")}
        continueLabel={t("profile.resetCancel")}
        finishLabel={t("profile.resetConfirm")}
        layout="horizontal"
        onContinue={handleDismissResetDialog}
        onFinish={handleConfirmReset}
        title={t("profile.resetTitle")}
        visible={showResetDialog}
      />

      <CalendarSheet
        visible={examDatePickerVisible}
        locale={i18n.language}
        initialDate={parseNullableIsoDate(examDate)}
        confirmLabel={t("onboarding.examDateConfirm")}
        clearLabel={t("onboarding.examDateClear")}
        onClose={() => setExamDatePickerVisible(false)}
        onConfirm={(date) => {
          void handleConfirmExamDate(date);
        }}
        onClear={() => setExamDatePickerVisible(false)}
      />
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      scroll: {
        flex: 1,
      },
      content: {
        padding: spacing.exact(24),
        paddingBottom: spacing.exact(96) + safeBottom,
        gap: spacing.exact(24),
      },
      resetCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(16),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: spacing.exact(12),
        shadowOffset: { width: 0, height: spacing.exact(2) },
        elevation: 2,
      },
      pressed: {
        opacity: 0.85,
      },
      resetIconWrap: {
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: accents.red.soft,
      },
      resetTitle: {
        flex: 1,
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.16,
        color: accents.red.ink,
      },
    })
  );
}

function getProfileOfflineBadge(
  t: ReturnType<typeof useTranslation>["t"],
  snapshot: OfflinePackSnapshot | null
) {
  if (snapshot?.transfer?.status === "downloading") {
    return t("offlineMode.downloadingBadge");
  }

  if (snapshot?.transfer?.status === "error") {
    return t("offlineMode.interruptedBadge");
  }

  if (snapshot?.hasStoredData && !snapshot.readyPack) {
    return t("offlineMode.repairBadge");
  }

  if (
    snapshot?.readyPackMatchesCurrentCategory &&
    snapshot.readyPackMatchesCurrentCatalog === false
  ) {
    return t("offlineMode.updateBadge");
  }

  if (snapshot?.readyPackMatchesCurrentCategory) {
    return t("offlineMode.readyBadge");
  }

  return t("offlineMode.downloadBadge");
}

function getProfileOfflineSubtitle({
  currentCategory,
  snapshot,
  t,
}: {
  currentCategory: string;
  snapshot: OfflinePackSnapshot | null;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (snapshot?.transfer) {
    return t("offlineMode.downloadedProgress", {
      done: snapshot.transfer.downloadedAssetCount,
      total: snapshot.transfer.targetAssetCount,
    });
  }

  if (snapshot?.readyPackMatchesCurrentCategory && snapshot.readyPack) {
    return `${snapshot.readyPack.questionCount} • ${formatOfflineBytes(
      snapshot.readyPack.totalBytes
    )}`;
  }

  if (snapshot?.readyPack?.category) {
    return t("offlineMode.statusOtherCategory", {
      category: snapshot.readyPack.category,
    });
  }

  if (snapshot?.hasStoredData) {
    return t("offlineMode.statusNeedsRepair");
  }

  return t("offlineMode.subtitle", {
    category: currentCategory,
  });
}
