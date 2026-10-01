import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  getRevenueCatDiagnostic,
  getRevenueCatWhy,
  isRevenueCatConfiguredForCurrentPlatform,
  presentRevenueCatCustomerCenter,
} from "../../src/features/entitlements/revenuecat";
import {
  createCheckoutId,
  isCheckoutPending,
  needsCheckoutRecovery,
  refreshCheckoutAccess,
  startCheckoutRestore,
  useCheckoutStore,
} from "../../src/features/entitlements/checkout";
import { getCheckoutErrorTranslationKey } from "../../src/features/entitlements/revenuecat-errors";
import { useScreenOperationGuard } from "../../src/hooks/useScreenOperationGuard";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import {
  useEntitlementStore,
  useHasPlusAccess,
  usePurchaseAccess,
  useRevenueCatHydrationError,
} from "../../src/state/entitlements";
import { useAppUserId } from "../../src/identity/AppIdentityProvider";
import { useAppShellStore, useCurrentUser } from "../../src/state/app-shell";

type FeedbackState =
  | {
      kind: "error" | "success" | "info";
      message: string;
    }
  | null;

export default function AccessCenterModalScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const styles = useStyles();
  const currentUser = useCurrentUser();
  const appUserId = useAppUserId();
  const authMode = useAppShellStore((state) => state.authMode);
  const hasPlusAccess = useHasPlusAccess();
  const purchaseAccess = usePurchaseAccess();
  const sdkConfigured = isRevenueCatConfiguredForCurrentPlatform();
  const revenueCatHydrationError = useRevenueCatHydrationError();
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const checkoutAttempt = useCheckoutStore((state) => state.attempt);
  const nativeRequestInFlight = useCheckoutStore((state) => state.nativeRequestInFlight);
  const recoveryInFlight = useCheckoutStore((state) => state.recoveryInFlight);
  const recoveryStatus = useCheckoutStore((state) => state.recoveryStatus);
  const recoveryAttemptId = useCheckoutStore((state) => state.recoveryAttemptId);
  const journalLoading = useCheckoutStore((state) =>
    state.journalAppUserId !== appUserId || state.journalStatus === "idle" || state.journalStatus === "loading"
  );
  const checkoutBusy = journalLoading || nativeRequestInFlight || recoveryInFlight || isCheckoutPending(checkoutAttempt);
  const operationBusy = journalLoading || nativeRequestInFlight || recoveryInFlight;
  const recoveryNeeded = checkoutAttempt?.appUserId === appUserId && needsCheckoutRecovery(checkoutAttempt);
  const isRestoring = (nativeRequestInFlight && checkoutAttempt?.kind === "restore") ||
    (recoveryInFlight && recoveryStatus === "restoring");
  const [checkoutViewId] = useState(createCheckoutId);
  const screenOperation = useScreenOperationGuard();
  const [isOpeningCustomerCenter, setIsOpeningCustomerCenter] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<FeedbackState>(null);

  const hasRealAuth =
    authMode === "supabase" && Boolean(currentUser) && isMobileSupabaseConfigured;
  const purchaseAccessEndsAt = purchaseAccess?.latestExpirationDate
    ? formatPlanDate(purchaseAccess.latestExpirationDate.slice(0, 10))
    : null;

  async function handleRestorePurchase() {
    if (!sdkConfigured) {
      captureError({
        area: "revenuecat",
        eventName: "paywall_not_configured",
        message: "restore_purchases:not_configured",
        metadata: getRevenueCatDiagnostic({
          extra: {
            source: "access_center",
          },
          kind: "restore",
          step: "restore_purchases",
          why: "not_configured",
        }),
        severity: "warning",
      });
      setRestoreFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    if (operationBusy || isOpeningCustomerCenter) {
      return;
    }
    const canUpdateScreen = screenOperation.captureGuard();
    setRestoreFeedback(null);
    const result = await startCheckoutRestore({
      appUserId,
      originViewId: checkoutViewId,
      properties: { source: "access_center" },
      track,
      captureError,
    });
    if (!result || !canUpdateScreen() || useCheckoutStore.getState().attempt?.id !== result.id) {
      return;
    }
    if (result.status === "succeeded") {
      setRestoreFeedback({ kind: "success", message: t("paywall.restoreSuccess") });
    } else if (result.status === "empty") {
      setRestoreFeedback({ kind: "info", message: t(recoveryNeeded ? "paywall.checkout.check_not_found" : "paywall.restoreEmpty") });
    } else if (result.status === "failed") {
      setRestoreFeedback({
        kind: "error",
        message: t(getCheckoutErrorTranslationKey(result.errorKind)),
      });
    }
  }

  async function handleOpenCustomerCenter() {
    if (checkoutBusy || isOpeningCustomerCenter) {
      return;
    }
    const canUpdateScreen = screenOperation.captureGuard();
    if (!currentUser || authMode !== "supabase") {
      setRestoreFeedback({
        kind: "error",
        message: t("paywall.directRequiresAuth"),
      });
      return;
    }

    if (!sdkConfigured) {
      captureError({
        area: "revenuecat",
        eventName: "paywall_not_configured",
        message: "customer_center:not_configured",
        metadata: getRevenueCatDiagnostic({
          extra: {
            source: "access_center",
          },
          kind: "customer_center",
          step: "open_customer_center",
          why: "not_configured",
        }),
        severity: "warning",
      });
      setRestoreFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    setIsOpeningCustomerCenter(true);
    setRestoreFeedback(null);
    track(ANALYTICS_EVENTS.customerCenterOpened.key, {
      source: "access_center",
    });

    try {
      await presentRevenueCatCustomerCenter({
        appUserId,
        onCustomerInfoUpdated: (snapshot) => {
          hydrateRevenueCatSnapshot(snapshot);
        },
      });
    } catch (error) {
      const why = getRevenueCatWhy(error);

      captureError({
        area: "payments",
        error,
        eventName: "customer_center_open_failed",
        message: "Failed to open RevenueCat Customer Center.",
        metadata: getRevenueCatDiagnostic({
          extra: {
            source: "access_center",
          },
          kind: "customer_center",
          step: "open_customer_center",
          why,
        }),
      });
      if (canUpdateScreen()) {
        setRestoreFeedback({
          kind: "error",
          message: t("accessCenter.manageSubscriptionFailedBody"),
        });
      }
    } finally {
      if (screenOperation.isMounted()) {
        setIsOpeningCustomerCenter(false);
      }
    }
  }

  async function handleCheckPurchase() {
    if (operationBusy || isOpeningCustomerCenter || !recoveryNeeded) return;
    const canUpdateScreen = screenOperation.captureGuard();
    const attemptId = checkoutAttempt?.id;
    setRestoreFeedback(null);
    const result = await refreshCheckoutAccess(appUserId);
    if (!result || !canUpdateScreen() || useCheckoutStore.getState().attempt?.id !== attemptId) return;
    setRestoreFeedback({
      kind: result.outcome === "active" ? "success" : result.outcome === "failed" ? "error" : "info",
      message: t(result.outcome === "active" ? "paywall.purchaseAccessActive"
        : result.outcome === "failed" ? "paywall.checkout.check_failed" : "paywall.checkout.check_not_found"),
    });
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
            onPress={() => router.navigate("/paywall")}
          />
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => {
              screenOperation.invalidate();
              router.back();
            }}
          />
        </View>
      }
    >
      <View style={styles.contentStack}>
        {!hasRealAuth ? (
          <AppCard accent>
            <CText style={styles.sectionLabel}>
              {t("accessCenter.authRequiredTitle")}
            </CText>
            <CText style={styles.bodyText}>
              {t("accessCenter.authRequiredBody")}
            </CText>
            <View style={styles.inlineAction}>
              <AppButton
                label={t("accessCenter.openSignIn")}
                onPress={() => router.replace("/(onboarding)/access")}
              />
            </View>
          </AppCard>
        ) : null}

        <AppCard accent>
          <CText style={styles.sectionLabel}>{t("accessCenter.statusTitle")}</CText>
          <CText style={styles.bodyText}>{t("accessCenter.statusSubtitle")}</CText>
          <View style={styles.statusList}>
            <CText style={styles.statusLine}>
              {hasPlusAccess
                ? t("profile.plusAccessActive")
                : t("profile.plusAccessMissing")}
            </CText>
            <CText style={styles.statusLine}>
              {purchaseAccess
                ? t("profile.purchaseAccessValue", {
                    date:
                      purchaseAccessEndsAt ?? t("profile.accessNoExpiry"),
                  })
                : t("profile.purchaseAccessMissing")}
            </CText>
          </View>
          {sdkConfigured && hasRealAuth ? (
            <View style={styles.inlineAction}>
              <AppButton
                variant="secondary"
                disabled={isOpeningCustomerCenter || checkoutBusy}
                label={t(
                  isOpeningCustomerCenter
                    ? "accessCenter.customerCenterLoading"
                    : "accessCenter.manageSubscription"
                )}
                onPress={() => void handleOpenCustomerCenter()}
              />
            </View>
          ) : null}
        </AppCard>

        <AppCard>
          <CText style={styles.sectionLabel}>{t("paywall.purchaseAccessTitle")}</CText>
          <CText style={styles.bodyText}>{t("accessCenter.restoreBody")}</CText>
          {!sdkConfigured ? (
            <CText style={styles.helperText}>{t("paywall.directMissingConfig")}</CText>
          ) : revenueCatHydrationError ? (
            <CText style={styles.helperText}>{t("paywall.directHydrationFailed")}</CText>
          ) : null}
          {restoreFeedback ? (
            <StatusCard
              kind={restoreFeedback.kind}
              message={restoreFeedback.message}
            />
          ) : null}
          {recoveryNeeded && !hasPlusAccess ? (
            <>
              <CText style={styles.helperText}>
                {t(checkoutAttempt?.status === "outcome_unknown"
                  ? "paywall.checkout.store_problem"
                  : checkoutAttempt?.errorKind
                    ? getCheckoutErrorTranslationKey(checkoutAttempt.errorKind)
                    : "paywall.purchasePending")}
              </CText>
              {!restoreFeedback && recoveryAttemptId === checkoutAttempt?.id &&
                (recoveryStatus === "not_found" || recoveryStatus === "failed") ? (
                <CText style={styles.helperText}>
                  {t(recoveryStatus === "failed" ? "paywall.checkout.check_failed" : "paywall.checkout.check_not_found")}
                </CText>
              ) : null}
            </>
          ) : null}
          <View style={styles.restoreActions}>
            <AppButton
              variant="secondary"
              disabled={operationBusy || isOpeningCustomerCenter || !sdkConfigured}
              label={t(
                isRestoring
                  ? "paywall.restoreCtaLoading"
                  : "paywall.restoreCta"
              )}
              onPress={() => void handleRestorePurchase()}
            />
            {recoveryNeeded && !hasPlusAccess ? (
              <AppButton variant="secondary" disabled={operationBusy || isOpeningCustomerCenter}
                label={t(recoveryInFlight ? "paywall.checkout.check_loading" : "paywall.checkout.check_cta")}
                onPress={() => void handleCheckPurchase()} />
            ) : null}
            <AppButton
              variant="ghost"
              label={t("accessCenter.openOffers")}
              onPress={() => router.navigate("/paywall")}
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
  kind: "error" | "success" | "info";
  message: string;
}) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.statusCard,
        kind === "error" ? styles.statusError : kind === "success" ? styles.statusSuccess : styles.statusInfo,
      ]}
    >
      <CText
        style={[
          styles.statusText,
          kind === "error" ? styles.statusErrorText : kind === "success" ? styles.statusSuccessText : styles.bodyText,
        ]}
      >
        {message}
      </CText>
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
      fontFamily: getFontFamily("bold"),
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
    statusInfo: {
      borderColor: colors.textMuted,
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
      fontFamily: getFontFamily("semiBold"),
      lineHeight: responsiveFont(22),
    },
  }));
}
