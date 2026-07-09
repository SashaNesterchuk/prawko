import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { APP_FEATURES, FEATURE_FLAGS, type AppFeature } from "@prawko/config";

import {
  PaywallComparisonTable,
  type PaywallComparisonRow,
} from "../src/components/shell/PaywallComparisonTable";
import { PaywallScreen } from "../src/components/shell/PaywallScreen";
import {
  getRevenueCatErrorMessage,
  isRevenueCatPurchaseCancelled,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../src/features/entitlements/revenuecat";
import { formatPlanDate } from "../src/features/study-plan/generate-local-study-plan";
import { useAnalytics } from "../src/providers/AnalyticsProvider";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import {
  useEntitlementStore,
  useHasPlusAccess,
  usePurchaseAccess,
  useRevenueCatConfigured,
  useRevenueCatOfferings,
  useRevenueCatStatus,
} from "../src/state/entitlements";
import { useCurrentUser, useAppShellStore } from "../src/state/app-shell";
import { greenWave, greenWaveAccent } from "../src/theme/green-wave";

export default function PaywallPage() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const params = useLocalSearchParams<{
    feature?: string | string[];
  }>();
  const currentUser = useCurrentUser();
  const authMode = useAppShellStore((state) => state.authMode);
  const purchaseAccess = usePurchaseAccess();
  const revenueCatConfigured = useRevenueCatConfigured();
  const revenueCatOfferings = useRevenueCatOfferings();
  const revenueCatStatus = useRevenueCatStatus();
  const hasPlusAccess = useHasPlusAccess();
  const setRevenueCatStatus = useEntitlementStore(
    (state) => state.setRevenueCatStatus
  );
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchaseFeedback, setPurchaseFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const targetFeature = getSingleParam(params.feature);
  const highlightedFeature = isAppFeature(targetFeature) ? targetFeature : null;

  const canUseDirectPurchase =
    FEATURE_FLAGS.enablePlusPurchase &&
    authMode === "supabase" &&
    Boolean(currentUser);
  const purchaseEndsAt = purchaseAccess?.latestExpirationDate
    ? formatPlanDate(purchaseAccess.latestExpirationDate.slice(0, 10))
    : null;
  const recommendedPackage = useMemo(
    () => pickRecommendedPackage(revenueCatOfferings),
    [revenueCatOfferings]
  );
  const didTrackViewRef = useRef(false);
  const [selectedPackageKey, setSelectedPackageKey] = useState<string | null>(null);
  const selectedPackage =
    revenueCatOfferings.find((item) => getPackageKey(item) === selectedPackageKey) ??
    recommendedPackage;

  const comparisonRows = useMemo<PaywallComparisonRow[]>(
    () => [
      {
        key: "trainer",
        title: t("paywall.rowTrainer"),
        free: { kind: "check" },
        premium: { kind: "check" },
      },
      {
        key: "exam",
        title: t("paywall.rowExam"),
        free: { kind: "label", text: t("paywall.freeExamLimit") },
        premium: { kind: "check" },
      },
      {
        key: "mistakes",
        title: t("paywall.rowMistakes"),
        subtitle: t("paywall.rowMistakesSub"),
        free: { kind: "cross" },
        premium: { kind: "check" },
      },
      {
        key: "traps",
        title: t("paywall.rowTraps"),
        subtitle: t("paywall.rowTrapsSub"),
        free: { kind: "cross" },
        premium: { kind: "check" },
      },
      {
        key: "srs",
        title: t("paywall.rowSrs"),
        subtitle: t("paywall.rowSrsSub"),
        free: { kind: "cross" },
        premium: { kind: "check" },
      },
      {
        key: "offline",
        title: t("paywall.rowOffline"),
        subtitle: t("paywall.rowOfflineSub"),
        free: { kind: "cross" },
        premium: { kind: "check" },
      },
    ],
    [t]
  );

  const displayPrice =
    selectedPackage?.priceString ?? t("paywall.ctaFallbackPrice");

  useEffect(() => {
    if (!selectedPackageKey && recommendedPackage) {
      setSelectedPackageKey(getPackageKey(recommendedPackage));
    }
  }, [recommendedPackage, selectedPackageKey]);

  useEffect(() => {
    if (didTrackViewRef.current) {
      return;
    }

    didTrackViewRef.current = true;
    track("paywall_viewed", {
      auth_mode: authMode,
      feature: highlightedFeature ?? null,
      has_plus_access: hasPlusAccess,
      has_purchase_access: Boolean(purchaseAccess),
      offers_count: revenueCatOfferings.length,
      plus_purchase_enabled: FEATURE_FLAGS.enablePlusPurchase,
      revenuecat_configured: revenueCatConfigured,
      source: highlightedFeature === "ai_question_chat" ? "ai_chat" : "profile",
    });
  }, [
    authMode,
    hasPlusAccess,
    highlightedFeature,
    purchaseAccess,
    revenueCatConfigured,
    revenueCatOfferings.length,
    track,
  ]);

  const handlePurchase = async () => {
    if (!currentUser || authMode !== "supabase") {
      router.replace("/(onboarding)/access");
      return;
    }

    if (!FEATURE_FLAGS.enablePlusPurchase) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.purchaseUnavailable"),
      });
      return;
    }

    if (!revenueCatConfigured) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    if (!selectedPackage) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directNoOfferSelected"),
      });
      return;
    }

    setIsPurchasing(true);
    setPurchaseFeedback(null);
    setRevenueCatStatus("loading");
    track("purchase_started", {
      feature: highlightedFeature ?? "premium_access",
      offering_identifier: selectedPackage.offeringIdentifier,
      package_identifier: selectedPackage.identifier,
      package_type: selectedPackage.packageType,
      price: selectedPackage.price,
      product_identifier: selectedPackage.productIdentifier,
      source: "paywall",
    });

    try {
      const snapshot = await purchaseRevenueCatPackage({
        appUserId: currentUser.id,
        identifier: selectedPackage.identifier,
        offeringIdentifier: selectedPackage.offeringIdentifier,
      });

      hydrateRevenueCatSnapshot(snapshot);
      track("purchase_succeeded", {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: "paywall",
      });
      setPurchaseFeedback({
        kind: "success",
        message: t("paywall.purchaseSuccess", {
          title: selectedPackage.title,
        }),
      });
      Toast.show({
        type: "success",
        text1: t("toasts.purchaseSuccessTitle"),
        text2: t("toasts.purchaseSuccessSubtitle", {
          title: selectedPackage.title,
        }),
      });
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        setRevenueCatStatus("ready");
        track("purchase_cancelled", {
          offering_identifier: selectedPackage.offeringIdentifier,
          package_identifier: selectedPackage.identifier,
          package_type: selectedPackage.packageType,
          product_identifier: selectedPackage.productIdentifier,
          source: "paywall",
        });
        setPurchaseFeedback({
          kind: "error",
          message: t("paywall.purchaseCancelled"),
        });
        return;
      }

      const message = getRevenueCatErrorMessage(error);

      captureError({
        area: "monetization",
        error,
        eventName: "purchase_failed",
        message: "Direct purchase failed from the paywall.",
        metadata: {
          feature: highlightedFeature ?? "premium_access",
          offering_identifier: selectedPackage.offeringIdentifier,
          package_identifier: selectedPackage.identifier,
          package_type: selectedPackage.packageType,
          product_identifier: selectedPackage.productIdentifier,
          source: "paywall",
        },
      });
      setRevenueCatStatus("ready");
      track("purchase_failed", {
        message,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: "paywall",
      });
      setPurchaseFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.purchaseFailedTitle"),
        text2: message,
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!currentUser || authMode !== "supabase") {
      router.replace("/(onboarding)/access");
      return;
    }

    if (!revenueCatConfigured) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    setIsRestoring(true);
    setPurchaseFeedback(null);
    setRevenueCatStatus("loading");
    track("purchase_restore_started", {
      source: "paywall",
    });

    try {
      const snapshot = await restoreRevenueCatPurchases(currentUser.id);

      hydrateRevenueCatSnapshot(snapshot);

      if (
        !snapshot.featureEntitlements.premium_access &&
        !snapshot.featureEntitlements.ai_question_chat
      ) {
        track("purchase_restore_empty", {
          source: "paywall",
        });
        setPurchaseFeedback({
          kind: "error",
          message: t("paywall.restoreEmpty"),
        });
        return;
      }

      track("purchase_restore_succeeded", {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        source: "paywall",
      });
      setPurchaseFeedback({
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
        area: "monetization",
        error,
        eventName: "purchase_restore_failed",
        message: "Purchase restore failed from the paywall.",
        metadata: {
          source: "paywall",
        },
      });
      setRevenueCatStatus("ready");
      track("purchase_restore_failed", {
        message,
        source: "paywall",
      });
      setPurchaseFeedback({
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
  };

  const purchaseDisabled =
    hasPlusAccess ||
    isPurchasing ||
    isRestoring ||
    (canUseDirectPurchase &&
      (revenueCatStatus === "loading" ||
        !selectedPackage ||
        !FEATURE_FLAGS.enablePlusPurchase ||
        !revenueCatConfigured));
  const helperMessage =
    !hasPlusAccess && !canUseDirectPurchase
      ? !currentUser || authMode !== "supabase"
        ? t("paywall.directRequiresAuth")
        : !FEATURE_FLAGS.enablePlusPurchase
          ? t("paywall.purchaseUnavailable")
          : !revenueCatConfigured
            ? t("paywall.directMissingConfig")
            : revenueCatStatus === "loading" && revenueCatOfferings.length === 0
              ? t("paywall.directLoading")
              : revenueCatOfferings.length === 0
                ? t("paywall.directNoOffers")
                : null
      : null;

  return (
    <PaywallScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t("common.close")}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color="#ffffff" name="close" size={28} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <MaterialCommunityIcons color="#ffffff" name="crown-outline" size={32} />
            <Text style={styles.heroTitle}>
              {t(hasPlusAccess ? "paywall.activeTitle" : "paywall.comparisonTitle")}
            </Text>
            {!hasPlusAccess ? (
              <Text style={styles.heroPrice}>
                {t("paywall.priceHeadline", { price: displayPrice })}
              </Text>
            ) : null}
          </View>

          {hasPlusAccess ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeCardTitle}>
                {t("paywall.purchaseAccessActive")}
              </Text>
              <Text style={styles.activeCardBody}>
                {purchaseEndsAt
                  ? t("paywall.purchaseEndsAt", { date: purchaseEndsAt })
                  : t("paywall.purchaseNoExpiry")}
              </Text>
            </View>
          ) : null}

          <PaywallComparisonTable
            freeLabel={t("paywall.columnFree")}
            premiumLabel={t("paywall.columnPremium")}
            rows={comparisonRows}
          />

          {!hasPlusAccess ? (
            <View style={styles.noAdsBadge}>
              <Text style={styles.noAdsBadgeText}>{t("paywall.noAdsBadge")}</Text>
            </View>
          ) : null}

          {!hasPlusAccess ? (
            <>
              {purchaseFeedback ? (
                <Text
                  style={[
                    styles.feedbackText,
                    purchaseFeedback.kind === "error"
                      ? styles.feedbackError
                      : styles.feedbackSuccess,
                  ]}
                >
                  {purchaseFeedback.message}
                </Text>
              ) : null}

              {helperMessage ? (
                <Text style={styles.helperText}>{helperMessage}</Text>
              ) : null}

              <View style={styles.lifetimeRow}>
                <Text style={styles.lifetimeText}>
                  {t("paywall.lifetimeNote")}
                </Text>
                <View style={styles.lifetimeDot} />
                <Text style={styles.lifetimeText}>
                  {t("paywall.lifetimeAccess")}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={purchaseDisabled}
                onPress={() => void handlePurchase()}
                style={({ pressed }) => [
                  styles.cta,
                  purchaseDisabled ? styles.ctaDisabled : null,
                  pressed && !purchaseDisabled ? styles.pressed : null,
                ]}
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.ctaLabel}>
                    {!currentUser || authMode !== "supabase"
                      ? t("paywall.openSignIn")
                      : t("paywall.activateCta")}
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isPurchasing || isRestoring || !revenueCatConfigured}
                onPress={() => void handleRestore()}
                style={({ pressed }) => [
                  styles.restoreButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.restoreLabel}>
                  {t(
                    isRestoring
                      ? "paywall.restoreCtaLoading"
                      : "paywall.restoreCta"
                  )}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.cta,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ctaLabel}>{t("paywall.primaryCta")}</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaywallScreen>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isAppFeature(value: string | undefined): value is AppFeature {
  return APP_FEATURES.includes(value as AppFeature);
}

function pickRecommendedPackage(
  packages: ReturnType<typeof useRevenueCatOfferings>
) {
  return (
    packages.find((item) => item.packageType === "LIFETIME") ??
    packages.find((item) => item.productIdentifier.includes("lifetime")) ??
    packages[0] ??
    null
  );
}

function getPackageKey(item: {
  identifier: string;
  offeringIdentifier: string;
}) {
  return `${item.offeringIdentifier}:${item.identifier}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.xs,
  },
  closeButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.xl,
    gap: greenWave.spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.xs,
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
    color: "#ffffff",
  },
  heroPrice: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.64,
    textAlign: "center",
    color: "#ffffff",
  },
  activeCard: {
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: "rgba(255,255,255,0.18)",
    gap: greenWave.spacing.xs,
  },
  activeCardTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#ffffff",
  },
  activeCardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
  },
  noAdsBadge: {
    alignSelf: "center",
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.ink,
  },
  noAdsBadgeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    color: "#ffffff",
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  feedbackError: {
    color: "#ffe0db",
  },
  feedbackSuccess: {
    color: "#ffffff",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
  },
  lifetimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: greenWave.spacing.xs,
  },
  lifetimeText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: "#ffffff",
  },
  lifetimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: greenWave.spacing.xl,
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.amber.fill,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  ctaLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
    color: "#ffffff",
  },
  restoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.sm,
  },
  restoreLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: "rgba(255,255,255,0.85)",
  },
});
