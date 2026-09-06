import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_FEATURES, FEATURE_FLAGS, type AppFeature } from "@prawko/config";

import { mobileEnv } from "../src/config/env";
import {
  PaywallComparisonTable,
  type PaywallComparisonRow,
} from "../src/components/shell/PaywallComparisonTable";
import { PaywallScreen } from "../src/components/shell/PaywallScreen";
import { NavigationButton } from "../src/components/shell/NavigationButton";
import {
  fetchRevenueCatSnapshot,
  getRevenueCatErrorMessage,
  isRevenueCatConfiguredForCurrentPlatform,
  isRevenueCatPurchaseCancelled,
  matchRevenueCatProductId,
  pickRecommendedPackage,
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
import {
  ANALYTICS_EVENTS,
  getAnalyticsErrorCode,
} from "../src/analytics/catalog";
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
import { useAppUserId } from "../src/identity/AppIdentityProvider";
import { useAppShellStore } from "../src/state/app-shell";

export default function PaywallPage() {
  const { t } = useTranslation();
  const { responsiveFont } = useResponsiveFonts();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  const appUserId = useAppUserId();
  const authMode = useAppShellStore((state) => state.authMode);
  const purchaseAccess = usePurchaseAccess();
  const revenueCatConfigured = useRevenueCatConfigured();
  const revenueCatOfferings = useRevenueCatOfferings();
  const revenueCatStatus = useRevenueCatStatus();
  const hasPlusAccess = useHasPlusAccess();
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
      const included = { kind: "check" as const };
      const examLimit = {
        kind: "label" as const,
        text: t("paywall.freeExamLimit"),
      };
      const dailyLimit = {
        kind: "label" as const,
        text: t("paywall.freeDailyLimit"),
      };

      return [
        {
          key: "trainer",
          title: t("paywall.rowTrainer"),
          free: included,
          premium: included,
        },
        {
          key: "exam",
          title: t("paywall.rowExam"),
          free: examLimit,
          premium: included,
        },
        {
          key: "mistakes",
          title: t("paywall.rowMistakes"),
          subtitle: t("paywall.rowMistakesSub"),
          free: dailyLimit,
          premium: included,
        },
        {
          key: "traps",
          title: t("paywall.rowTraps"),
          subtitle: t("paywall.rowTrapsSub"),
          free: dailyLimit,
          premium: included,
        },
        {
          key: "srs",
          title: t("paywall.rowSrs"),
          subtitle: t("paywall.rowSrsSub"),
          free: dailyLimit,
          premium: included,
        },
        {
          key: "offline",
          title: t("paywall.rowOffline"),
          subtitle: t("paywall.rowOfflineSub"),
          free: { kind: "cross" },
          premium: included,
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
    track(ANALYTICS_EVENTS.paywallViewed.key, {
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

  const showPurchaseError = (message: string) => {
    setPurchaseFeedback({
      kind: "error",
      message,
    });
    if (!mobileEnv.enableE2ETestMode) {
      Alert.alert(t("paywall.directTitle"), message);
    }
  };

  const handlePurchase = async () => {
    if (!FEATURE_FLAGS.enablePlusPurchase) {
      showPurchaseError(t("paywall.purchaseUnavailable"));
      return;
    }

    if (!revenueCatConfigured && !isRevenueCatConfiguredForCurrentPlatform()) {
      showPurchaseError(t("paywall.directMissingConfig"));
      return;
    }

    setIsPurchasing(true);
    setPurchaseFeedback(null);

    try {
      let targetPackage = selectedPackage;

      if (!targetPackage) {
        const snapshot = await fetchRevenueCatSnapshot(appUserId);
        hydrateRevenueCatSnapshot(snapshot);
        targetPackage = pickRecommendedPackage(snapshot.offerings);
      }

      if (!targetPackage) {
        showPurchaseError(t("paywall.directNoOffers"));
        return;
      }

      track(ANALYTICS_EVENTS.purchaseStarted.key, {
        feature: highlightedFeature ?? "premium_access",
        offering_identifier: targetPackage.offeringIdentifier,
        package_identifier: targetPackage.identifier,
        package_type: targetPackage.packageType,
        price: targetPackage.price,
        product_identifier: targetPackage.productIdentifier,
        source: paywallSource,
        ui: "package",
      });

      const snapshot = await purchaseRevenueCatPackage({
        appUserId,
        identifier: targetPackage.identifier,
        offeringIdentifier: targetPackage.offeringIdentifier,
      });

      hydrateRevenueCatSnapshot(snapshot);
      track(ANALYTICS_EVENTS.purchaseSucceeded.key, {
        active_entitlements_count:
          snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
        offering_identifier: targetPackage.offeringIdentifier,
        package_identifier: targetPackage.identifier,
        package_type: targetPackage.packageType,
        product_identifier: targetPackage.productIdentifier,
        source: paywallSource,
        ui: "package",
      });
      setPurchaseFeedback({
        kind: "success",
        message: t("paywall.purchaseSuccess", {
          title: targetPackage.title,
        }),
      });
      continueAfterUnlock();
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        track(ANALYTICS_EVENTS.purchaseCancelled.key, {
          offering_identifier: selectedPackage?.offeringIdentifier ?? null,
          package_identifier: selectedPackage?.identifier ?? null,
          package_type: selectedPackage?.packageType ?? null,
          product_identifier: selectedPackage?.productIdentifier ?? null,
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
          offering_identifier: selectedPackage?.offeringIdentifier ?? null,
          package_identifier: selectedPackage?.identifier ?? null,
          package_type: selectedPackage?.packageType ?? null,
          product_identifier: selectedPackage?.productIdentifier ?? null,
          source: "paywall",
        },
      });
      track(ANALYTICS_EVENTS.purchaseFailed.key, {
        error_code: getAnalyticsErrorCode(error),
        offering_identifier: selectedPackage?.offeringIdentifier ?? null,
        package_identifier: selectedPackage?.identifier ?? null,
        package_type: selectedPackage?.packageType ?? null,
        product_identifier: selectedPackage?.productIdentifier ?? null,
        source: paywallSource,
      });
      showPurchaseError(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!revenueCatConfigured && !isRevenueCatConfiguredForCurrentPlatform()) {
      showPurchaseError(t("paywall.directMissingConfig"));
      return;
    }

    setIsRestoring(true);
    setPurchaseFeedback(null);
    track(ANALYTICS_EVENTS.purchaseRestoreStarted.key, {
      source: "paywall",
    });

    try {
      const snapshot = await restoreRevenueCatPurchases(appUserId);

      hydrateRevenueCatSnapshot(snapshot);

      if (
        !snapshot.featureEntitlements.premium_access &&
        !snapshot.featureEntitlements.ai_question_chat
      ) {
        track(ANALYTICS_EVENTS.purchaseRestoreEmpty.key, {
          source: "paywall",
        });
        showPurchaseError(t("paywall.restoreEmpty"));
        return;
      }

      track(ANALYTICS_EVENTS.purchaseRestoreSucceeded.key, {
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
      track(ANALYTICS_EVENTS.purchaseRestoreFailed.key, {
        error_code: getAnalyticsErrorCode(error),
        source: "paywall",
      });
      showPurchaseError(message);
    } finally {
      setIsRestoring(false);
    }
  };

  const purchaseDisabled =
    hasPlusAccess ||
    isPurchasing ||
    isRestoring ||
    !FEATURE_FLAGS.enablePlusPurchase;
  const helperMessage = !hasPlusAccess
    ? !FEATURE_FLAGS.enablePlusPurchase
      ? t("paywall.purchaseUnavailable")
      : isPurchasing
        ? t("paywall.purchaseCtaLoading")
        : revenueCatStatus === "loading" && revenueCatOfferings.length === 0
          ? t("paywall.directLoading")
          : !revenueCatConfigured
            ? t("paywall.directMissingConfig")
            : revenueCatStatus === "ready" && revenueCatOfferings.length === 0
              ? t("paywall.directNoOffers")
              : null
    : null;

  return (
    <PaywallScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
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

            {!hasPlusAccess && revenueCatOfferings.length > 1 ? (
              <View style={styles.packageList}>
                {revenueCatOfferings.map((item) => {
                  const key = getPackageKey(item);
                  const productId = matchRevenueCatProductId(item);
                  const isSelected =
                    selectedPackage != null && getPackageKey(selectedPackage) === key;
                  const label =
                    productId === "monthly"
                      ? t("paywall.packageMonthly")
                      : productId === "yearly"
                        ? t("paywall.packageYearly")
                        : productId === "lifetime"
                          ? t("paywall.packageLifetime")
                          : item.title;

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedPackageKey(key);
                        track(ANALYTICS_EVENTS.paywallPackageSelected.key, {
                          offering_identifier: item.offeringIdentifier,
                          package_identifier: item.identifier,
                          package_type: item.packageType,
                          product_identifier: item.productIdentifier,
                          source: paywallSource,
                        });
                      }}
                      style={({ pressed }) => [
                        styles.packageChip,
                        isSelected ? styles.packageChipSelected : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <CText
                        semiBold
                        style={[
                          styles.packageChipLabel,
                          isSelected ? styles.packageChipLabelSelected : null,
                        ]}
                      >
                        {label}
                      </CText>
                      <CText
                        style={[
                          styles.packageChipPrice,
                          isSelected ? styles.packageChipLabelSelected : null,
                        ]}
                      >
                        {item.priceString}
                      </CText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!hasPlusAccess ? (
              <View style={styles.noAdsBadge}>
                <CText style={styles.noAdsBadgeText}>
                  {t("paywall.noAdsBadge")}
                </CText>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              insets.bottom > 0 ? { paddingBottom: insets.bottom } : null,
            ]}
          >
            {purchaseFeedback ? (
              <CText
                style={[
                  styles.feedbackText,
                  purchaseFeedback.kind === "error"
                    ? styles.feedbackError
                    : styles.feedbackSuccess,
                ]}
                testID="paywall-purchase-feedback"
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
                  disabled={purchaseDisabled}
                  onPress={() => void handlePurchase()}
                  style={({ pressed }) => [
                    styles.cta,
                    purchaseDisabled ? styles.ctaDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                  testID="paywall-activate-cta"
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
                  disabled={isPurchasing || isRestoring}
                  onPress={() => void handleRestore()}
                  style={({ pressed }) => [
                    styles.restoreButton,
                    pressed ? styles.pressed : null,
                  ]}
                  testID="paywall-restore-cta"
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
      textAlign: "center",
      color: colors.onAccent,
    },
    heroPrice: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
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
    packageList: {
      width: "100%",
      gap: spacing.exact(8),
    },
    packageChip: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(14),
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassThin,
      backgroundColor: colors.glassThin,
    },
    packageChipSelected: {
      borderColor: accents.amber.fill,
      backgroundColor: accents.amber.fill,
    },
    packageChipLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(22),
      color: colors.onAccent,
    },
    packageChipPrice: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(22),
      color: colors.onAccentMuted,
    },
    packageChipLabelSelected: {
      color: colors.onAccent,
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
      marginTop: "auto",
      gap: spacing.exact(8),
      paddingTop: spacing.exact(8),
      paddingBottom: spacing.exact(8),
    },
    feedbackText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      textAlign: "center",
    },
    feedbackError: {
      color: accents.amber.fill,
    },
    feedbackSuccess: {
      color: colors.onAccent,
    },
    helperText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      textAlign: "center",
      color: colors.onAccent,
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
