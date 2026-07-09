import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  getRevenueCatErrorMessage,
  restoreRevenueCatPurchases,
} from "../../src/features/entitlements/revenuecat";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useEntitlementStore,
  useHasPlusAccess,
  usePurchaseAccess,
  useRevenueCatConfigured,
} from "../../src/state/entitlements";
import { useAppShellStore, useCurrentUser } from "../../src/state/app-shell";

type FeedbackState =
  | {
      kind: "error" | "success";
      message: string;
    }
  | null;

const STATUS_COLORS = {
  errorBorder: "#C2826B",
  errorSurface: "#F7E7DF",
  successBorder: "#5D8A80",
  successSurface: "#E6F2EC",
};

export default function AccessCenterModalScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const theme = useTheme();
  const styles = getStyles(theme);
  const currentUser = useCurrentUser();
  const authMode = useAppShellStore((state) => state.authMode);
  const hasPlusAccess = useHasPlusAccess();
  const purchaseAccess = usePurchaseAccess();
  const revenueCatConfigured = useRevenueCatConfigured();
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const setRevenueCatStatus = useEntitlementStore(
    (state) => state.setRevenueCatStatus
  );
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<FeedbackState>(null);

  const hasRealAuth =
    authMode === "supabase" && Boolean(currentUser) && isMobileSupabaseConfigured;
  const purchaseAccessEndsAt = purchaseAccess?.latestExpirationDate
    ? formatPlanDate(purchaseAccess.latestExpirationDate.slice(0, 10))
    : null;

  async function handleRestorePurchase() {
    if (!currentUser || authMode !== "supabase") {
      setRestoreFeedback({
        kind: "error",
        message: t("paywall.directRequiresAuth"),
      });
      return;
    }

    if (!revenueCatConfigured) {
      setRestoreFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    setIsRestoring(true);
    setRestoreFeedback(null);
    setRevenueCatStatus("loading");
    track("purchase_restore_started", {
      source: "access_center",
    });

    try {
      const snapshot = await restoreRevenueCatPurchases(currentUser.id);

      hydrateRevenueCatSnapshot(snapshot);

      if (
        !snapshot.featureEntitlements.premium_access &&
        !snapshot.featureEntitlements.ai_question_chat
      ) {
        track("purchase_restore_empty", {
          source: "access_center",
        });
        setRestoreFeedback({
          kind: "error",
          message: t("paywall.restoreEmpty"),
        });
        return;
      }

      track("purchase_restore_succeeded", {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        source: "access_center",
      });
      setRestoreFeedback({
        kind: "success",
        message: t("paywall.restoreSuccess"),
      });
      Toast.show({
        type: "success",
        text1: t("toasts.restoreSuccessTitle"),
        text2: t("toasts.restoreSuccessSubtitle"),
      });
    } catch (error) {
      const message = getRevenueCatErrorMessage(error);

      captureError({
        area: "payments",
        error,
        eventName: "access_center_purchase_restore_failed",
        message: "Purchase restore failed from the access center.",
        metadata: {
          source: "access_center",
        },
      });
      setRevenueCatStatus("ready");
      track("purchase_restore_failed", {
        message,
        source: "access_center",
      });
      setRestoreFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.restoreFailedTitle"),
        text2: message,
      });
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleOpenManagementUrl() {
    if (!purchaseAccess?.managementUrl) {
      return;
    }

    try {
      await Linking.openURL(purchaseAccess.managementUrl);
    } catch (error) {
      captureError({
        area: "payments",
        error,
        eventName: "purchase_management_url_open_failed",
        message: "Failed to open the purchase management URL from the access center.",
        metadata: {
          source: "access_center",
        },
      });
      Toast.show({
        type: "error",
        text1: t("accessCenter.manageSubscriptionFailedTitle"),
        text2: t("accessCenter.manageSubscriptionFailedBody"),
      });
    }
  }

  return (
    <AppScreen
      title={t("accessCenter.title")}
      subtitle={t("accessCenter.subtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            variant="secondary"
            label={t("accessCenter.openPaywall")}
            onPress={() => router.push("/paywall")}
          />
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        {!hasRealAuth ? (
          <AppCard accent>
            <Text style={styles.sectionLabel}>
              {t("accessCenter.authRequiredTitle")}
            </Text>
            <Text style={styles.bodyText}>
              {t("accessCenter.authRequiredBody")}
            </Text>
            <View style={{ marginTop: 12 }}>
              <AppButton
                label={t("accessCenter.openSignIn")}
                onPress={() => router.replace("/(onboarding)/access")}
              />
            </View>
          </AppCard>
        ) : null}

        <AppCard accent>
          <Text style={styles.sectionLabel}>{t("accessCenter.statusTitle")}</Text>
          <Text style={styles.bodyText}>{t("accessCenter.statusSubtitle")}</Text>
          <View style={styles.statusList}>
            <Text style={styles.statusLine}>
              {hasPlusAccess
                ? t("profile.plusAccessActive")
                : t("profile.plusAccessMissing")}
            </Text>
            <Text style={styles.statusLine}>
              {purchaseAccess
                ? t("profile.purchaseAccessValue", {
                    date:
                      purchaseAccessEndsAt ?? t("profile.accessNoExpiry"),
                  })
                : t("profile.purchaseAccessMissing")}
            </Text>
          </View>
          {purchaseAccess?.managementUrl ? (
            <View style={{ marginTop: 12 }}>
              <AppButton
                variant="secondary"
                label={t("accessCenter.manageSubscription")}
                onPress={() => void handleOpenManagementUrl()}
              />
            </View>
          ) : null}
        </AppCard>

        <AppCard>
          <Text style={styles.sectionLabel}>{t("paywall.purchaseAccessTitle")}</Text>
          <Text style={styles.bodyText}>{t("accessCenter.restoreBody")}</Text>
          {!revenueCatConfigured ? (
            <Text style={styles.helperText}>{t("paywall.directMissingConfig")}</Text>
          ) : null}
          {restoreFeedback ? (
            <StatusCard
              kind={restoreFeedback.kind}
              message={restoreFeedback.message}
            />
          ) : null}
          <View style={{ gap: 10, marginTop: 16 }}>
            <AppButton
              variant="secondary"
              disabled={isRestoring || !revenueCatConfigured}
              label={t(
                isRestoring
                  ? "paywall.restoreCtaLoading"
                  : "paywall.restoreCta"
              )}
              onPress={() => void handleRestorePurchase()}
            />
            <AppButton
              variant="ghost"
              label={t("accessCenter.openOffers")}
              onPress={() => router.push("/paywall")}
            />
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

function StatusCard({
  kind,
  message,
}: {
  kind: "error" | "success";
  message: string;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View
      style={[
        styles.statusCard,
        kind === "error" ? styles.statusError : styles.statusSuccess,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          kind === "error" ? styles.statusErrorText : styles.statusSuccessText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    bodyText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    formStack: {
      gap: 12,
      marginTop: 16,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },
    sectionLabel: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 6,
    },
    statusCard: {
      borderRadius: theme.radius.large,
      borderWidth: 1,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statusError: {
      backgroundColor: STATUS_COLORS.errorSurface,
      borderColor: STATUS_COLORS.errorBorder,
    },
    statusErrorText: {
      color: STATUS_COLORS.errorBorder,
    },
    statusSuccess: {
      backgroundColor: STATUS_COLORS.successSurface,
      borderColor: STATUS_COLORS.successBorder,
    },
    statusSuccessText: {
      color: STATUS_COLORS.successBorder,
    },
    statusLine: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      lineHeight: 24,
    },
    statusList: {
      gap: 4,
      marginTop: 12,
    },
    statusText: {
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 22,
    },
  });
