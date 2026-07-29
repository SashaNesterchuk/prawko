import { router } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useResponsiveStyles } from "../../src/portable-ui";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  getRevenueCatErrorMessage,
  restoreRevenueCatPurchases,
} from "../../src/features/entitlements/revenuecat";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
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

export default function AccessCenterModalScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const styles = useStyles();
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
    }
  }

  return (
    <AppScreen
      title={t("accessCenter.title")}
      subtitle={t("accessCenter.subtitle")}
      footer={
        <View style={styles.footerStack}>
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
      <View style={styles.contentStack}>
        {!hasRealAuth ? (
          <AppCard accent>
            <Text style={styles.sectionLabel}>
              {t("accessCenter.authRequiredTitle")}
            </Text>
            <Text style={styles.bodyText}>
              {t("accessCenter.authRequiredBody")}
            </Text>
            <View style={styles.inlineAction}>
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
            <View style={styles.inlineAction}>
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
          <View style={styles.restoreActions}>
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
  const styles = useStyles();

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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    contentStack: {
      gap: spacing.exact(12),
    },
    inlineAction: {
      marginTop: spacing.exact(12),
    },
    restoreActions: {
      gap: spacing.exact(10),
      marginTop: spacing.exact(16),
    },
    bodyText: {
      color: colors.textSecondary,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    helperText: {
      color: colors.textMuted,
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      marginTop: spacing.exact(12),
    },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: responsiveFont(18),
      fontWeight: "700",
      marginBottom: spacing.exact(6),
    },
    statusCard: {
      borderRadius: radius.large,
      borderWidth: 1,
      marginTop: spacing.exact(16),
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(12),
    },
    statusError: {
      backgroundColor: colors.statusErrorSurface,
      borderColor: colors.statusErrorBorder,
    },
    statusErrorText: {
      color: colors.statusErrorBorder,
    },
    statusSuccess: {
      backgroundColor: colors.statusSuccessSurface,
      borderColor: colors.statusSuccessBorder,
    },
    statusSuccessText: {
      color: colors.statusSuccessBorder,
    },
    statusLine: {
      color: colors.textPrimary,
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(24),
    },
    statusList: {
      gap: spacing.exact(4),
      marginTop: spacing.exact(12),
    },
    statusText: {
      fontSize: responsiveFont(14),
      fontWeight: "600",
      lineHeight: responsiveFont(22),
    },
  }));
}
