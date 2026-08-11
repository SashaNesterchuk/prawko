import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_FEATURES, FEATURE_FLAGS, type AppFeature } from "@prawko/config";

import {
  PaywallComparisonTable,
  type PaywallComparisonRow,
} from "../src/components/shell/PaywallComparisonTable";
import { PaywallScreen } from "../src/components/shell/PaywallScreen";
import { NavigationButton } from "../src/components/shell/NavigationButton";
import {
  getRevenueCatErrorMessage,
  isRevenueCatPurchaseCancelled,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../src/features/entitlements/revenuecat";
import { formatPlanDate } from "../src/features/study-plan/generate-local-study-plan";
import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../src/portable-ui";
import { useAnalytics } from "../src/providers/AnalyticsProvider";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import {
  useEntitlementStore,
  useHasPlusAccess,
  usePurchaseAccess,
  useRevenueCatConfigured,
  useRevenueCatOfferings,
  useRevenueCatStatus,
} from "../src/state/entitlements";
import { useCurrentUser, useAppShellStore } from "../src/state/app-shell";

export default function PaywallPage() {
  const { t } = useTranslation();
  const { responsiveFont } = useResponsiveFonts();
  const { colors } = useTheme();
  const styles = useStyles();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const params = useLocalSearchParams<{
    feature?: string | string[];
    locale?: string | string[];
    mode?: string | string[];
    questionId?: string | string[];
    questionLimit?: string | string[];
    returnTo?: string | string[];
    selectedAnswer?: string | string[];
    studyPlanTaskId?: string | string[];
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
  const returnTo = getSingleParam(params.returnTo);
  const returnQuestionId = getSingleParam(params.questionId);
  const returnLocale = getSingleParam(params.locale);
  const returnSelectedAnswer = getSingleParam(params.selectedAnswer);
  const highlightedFeature = isAppFeature(targetFeature) ? targetFeature : null;

  const returnExamMode = getSingleParam(params.mode);
  const returnExamQuestionLimit = getSingleParam(params.questionLimit);
  const returnExamStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const paywallSource =
    returnTo === "exam"
      ? "exam_restart"
      : highlightedFeature === "ai_question_chat" || returnTo === "ai-chat"
        ? "ai_chat"
        : "profile";

  const continueAfterUnlock = () => {
    if (returnTo === "ai-chat" && returnQuestionId) {
      router.replace({
        pathname: "/modals/ai-chat",
        params: {
          questionId: returnQuestionId,
          ...(returnLocale ? { locale: returnLocale } : {}),
          ...(returnSelectedAnswer
            ? { selectedAnswer: returnSelectedAnswer }
            : {}),
        },
      });
      return;
    }

    if (returnTo === "exam") {
      router.replace({
        pathname: "/exam",
        params: {
          ...(returnExamMode ? { mode: returnExamMode } : {}),
          ...(returnExamQuestionLimit
            ? { questionLimit: returnExamQuestionLimit }
            : {}),
          ...(returnExamStudyPlanTaskId
            ? { studyPlanTaskId: returnExamStudyPlanTaskId }
            : {}),
        },
      });
      return;
    }

    router.back();
  };

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
    () => {
      const withAds = {
        kind: "label" as const,
        text: t("paywall.adsCell"),
        tone: "danger" as const,
      };
      const noAds = {
        kind: "label" as const,
        text: t("paywall.noAdsCell"),
        tone: "emphasis" as const,
      };

      return [
        {
          key: "trainer",
          title: t("paywall.rowTrainer"),
          free: withAds,
          premium: noAds,
        },
        {
          key: "exam",
          title: t("paywall.rowExam"),
          free: withAds,
          premium: noAds,
        },
        {
          key: "mistakes",
          title: t("paywall.rowMistakes"),
          subtitle: t("paywall.rowMistakesSub"),
          free: withAds,
          premium: noAds,
        },
        {
          key: "traps",
          title: t("paywall.rowTraps"),
          subtitle: t("paywall.rowTrapsSub"),
          free: withAds,
          premium: noAds,
        },
        {
          key: "srs",
          title: t("paywall.rowSrs"),
          subtitle: t("paywall.rowSrsSub"),
          free: withAds,
          premium: noAds,
        },
        {
          key: "offline",
          title: t("paywall.rowOffline"),
          subtitle: t("paywall.rowOfflineSub"),
          free: { kind: "cross" },
          premium: { kind: "check" },
        },
      ];
    },
    [t]
  );

  const displayPrice =
    selectedPackage?.priceString ?? t("paywall.ctaFallbackPrice");
  const crownIconSize = responsiveFont(24);

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
      source: paywallSource,
    });
  }, [
    authMode,
    hasPlusAccess,
    highlightedFeature,
    paywallSource,
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
    track("plus_purchase_started", {
      feature: highlightedFeature ?? "premium_access",
      offering_identifier: selectedPackage.offeringIdentifier,
      package_identifier: selectedPackage.identifier,
      package_type: selectedPackage.packageType,
      price: selectedPackage.price,
      product_identifier: selectedPackage.productIdentifier,
      source: paywallSource,
    });
    track("purchase_started", {
      feature: highlightedFeature ?? "premium_access",
      offering_identifier: selectedPackage.offeringIdentifier,
      package_identifier: selectedPackage.identifier,
      package_type: selectedPackage.packageType,
      price: selectedPackage.price,
      product_identifier: selectedPackage.productIdentifier,
      source: paywallSource,
    });

    try {
      const snapshot = await purchaseRevenueCatPackage({
        appUserId: currentUser.id,
        identifier: selectedPackage.identifier,
        offeringIdentifier: selectedPackage.offeringIdentifier,
      });

      hydrateRevenueCatSnapshot(snapshot);
      track("plus_purchase_success", {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: paywallSource,
      });
      track("purchase_succeeded", {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: paywallSource,
      });
      setPurchaseFeedback({
        kind: "success",
        message: t("paywall.purchaseSuccess", {
          title: selectedPackage.title,
        }),
      });
      continueAfterUnlock();
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
      track("plus_purchase_fail", {
        message,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: paywallSource,
      });
      track("purchase_failed", {
        message,
        offering_identifier: selectedPackage.offeringIdentifier,
        package_identifier: selectedPackage.identifier,
        package_type: selectedPackage.packageType,
        product_identifier: selectedPackage.productIdentifier,
        source: paywallSource,
      });
      setPurchaseFeedback({
        kind: "error",
        message,
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
      continueAfterUnlock();
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
    !hasPlusAccess &&
    !canUseDirectPurchase &&
    currentUser &&
    authMode === "supabase"
      ? !FEATURE_FLAGS.enablePlusPurchase
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
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        testID="screen-paywall"
      >
        <StatusBar style="light" />

        <View style={styles.header}>
          <NavigationButton
            accessibilityLabel={t("common.close")}
            onPress={() => router.back()}
            tone="onAccent"
            type="close"
          />
        </View>

        <View style={styles.body}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroTitleRow}>
                <MaterialCommunityIcons
                  color={colors.onAccent}
                  name="crown-outline"
                  size={crownIconSize}
                />
                <CText semiBold style={styles.heroTitle}>
                  {t(
                    hasPlusAccess
                      ? "paywall.activeTitle"
                      : "paywall.comparisonTitle"
                  )}
                </CText>
              </View>
              {!hasPlusAccess ? (
                <CText bold style={styles.heroPrice}>
                  {t("paywall.priceHeadline", { price: displayPrice })}
                </CText>
              ) : null}
            </View>

            {hasPlusAccess ? (
              <View style={styles.activeCard}>
                <CText semiBold style={styles.activeCardTitle}>
                  {t("paywall.purchaseAccessActive")}
                </CText>
                <CText style={styles.activeCardBody}>
                  {purchaseEndsAt
                    ? t("paywall.purchaseEndsAt", { date: purchaseEndsAt })
                    : t("paywall.purchaseNoExpiry")}
                </CText>
              </View>
            ) : null}

            <PaywallComparisonTable
              freeLabel={t("paywall.columnFree")}
              premiumLabel={t("paywall.columnPremium")}
              rows={comparisonRows}
            />

            {!hasPlusAccess ? (
              <View style={styles.noAdsBadge}>
                <CText style={styles.noAdsBadgeText}>
                  {t("paywall.noAdsBadge")}
                </CText>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {purchaseFeedback ? (
              <CText
                style={[
                  styles.feedbackText,
                  purchaseFeedback.kind === "error"
                    ? styles.feedbackError
                    : styles.feedbackSuccess,
                ]}
              >
                {purchaseFeedback.message}
              </CText>
            ) : null}

            {helperMessage ? (
              <CText style={styles.helperText}>{helperMessage}</CText>
            ) : null}

            {!hasPlusAccess ? (
              <>
                <View style={styles.lifetimeRow}>
                  <CText style={styles.lifetimeText}>
                    {t("paywall.lifetimeNote")}
                  </CText>
                  <View style={styles.lifetimeDot} />
                  <CText style={styles.lifetimeText}>
                    {t("paywall.lifetimeAccess")}
                  </CText>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={purchaseDisabled && canUseDirectPurchase}
                  onPress={() => void handlePurchase()}
                  style={({ pressed }) => [
                    styles.cta,
                    purchaseDisabled && canUseDirectPurchase
                      ? styles.ctaDisabled
                      : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  {isPurchasing ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <CText semiBold style={styles.ctaLabel}>
                      {t("paywall.activateCta")}
                    </CText>
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
                  <CText style={styles.restoreLabel}>
                    {t(
                      isRestoring
                        ? "paywall.restoreCtaLoading"
                        : "paywall.restoreCta"
                    )}
                  </CText>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={continueAfterUnlock}
                style={({ pressed }) => [
                  styles.cta,
                  pressed ? styles.pressed : null,
                ]}
              >
                <CText semiBold style={styles.ctaLabel}>
                  {t("paywall.primaryCta")}
                </CText>
              </Pressable>
            )}
          </View>
        </View>
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

function useStyles() {
  return useResponsiveStyles(({ accents, colors, radius, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.exact(24),
      paddingBottom: spacing.exact(4),
    },
    pressed: {
      opacity: 0.85,
    },
    body: {
      flex: 1,
      paddingHorizontal: spacing.exact(24),
      paddingBottom: spacing.exact(24),
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingTop: spacing.exact(24),
      paddingBottom: spacing.exact(16),
      gap: spacing.exact(16),
      alignItems: "center",
    },
    hero: {
      alignItems: "center",
      gap: spacing.exact(4),
    },
    heroTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(12),
    },
    heroTitle: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      letterSpacing: -0.2,
      textAlign: "center",
      color: colors.onAccent,
    },
    heroPrice: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      letterSpacing: -0.64,
      textAlign: "center",
      color: colors.onAccent,
    },
    activeCard: {
      width: "100%",
      padding: spacing.exact(16),
      borderRadius: radius.xl,
      backgroundColor: colors.glassThin,
      gap: spacing.exact(4),
    },
    activeCardTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.onAccent,
    },
    activeCardBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.onAccentMuted,
    },
    noAdsBadge: {
      alignSelf: "center",
      paddingHorizontal: spacing.exact(12),
      paddingVertical: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: accents.green.ink,
    },
    noAdsBadgeText: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      textAlign: "center",
      color: colors.onAccent,
    },
    footer: {
      gap: spacing.exact(8),
      paddingTop: spacing.exact(8),
    },
    feedbackText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      textAlign: "center",
    },
    feedbackError: {
      color: colors.warningSoft,
    },
    feedbackSuccess: {
      color: colors.onAccent,
    },
    helperText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      textAlign: "center",
      color: colors.onAccentMuted,
    },
    lifetimeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(4),
    },
    lifetimeText: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.onAccent,
    },
    lifetimeDot: {
      width: spacing.exact(6),
      height: spacing.exact(6),
      borderRadius: spacing.exact(3),
      backgroundColor: colors.onAccent,
    },
    cta: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(52),
      paddingHorizontal: spacing.exact(24),
      paddingVertical: spacing.exact(12),
      borderRadius: radius.pill,
      backgroundColor: accents.amber.fill,
      shadowColor: colors.shadowDeep,
      shadowOpacity: 0.1,
      shadowRadius: spacing.exact(36),
      shadowOffset: { width: 0, height: spacing.exact(14) },
      elevation: 4,
    },
    ctaDisabled: {
      opacity: 0.55,
    },
    ctaLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      letterSpacing: -0.2,
      textAlign: "center",
      color: colors.onAccent,
    },
    restoreButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.exact(4),
    },
    restoreLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.onAccentMuted,
    },
  }));
}
