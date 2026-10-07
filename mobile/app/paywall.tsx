import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getPaywallOfferHelperKind } from "../src/features/entitlements/paywall-offer-helper";
import { createPaywallOfferTracker } from "../src/features/entitlements/paywall-offer-analytics";
import {
  fetchRevenueCatOfferings,
  getRevenueCatDiagnostic,
  getRevenueCatWhy,
  isRevenueCatConfiguredForCurrentPlatform,
  matchRevenueCatProductId,
  pickRecommendedPackage,
} from "../src/features/entitlements/revenuecat";
import {
  createCheckoutId,
  canRetryUnknownCheckout,
  isCheckoutPending,
  needsCheckoutRecovery,
  refreshCheckoutAccess,
  startCheckoutPurchase,
  startCheckoutRestore,
  useCheckoutStore,
  type CheckoutAttempt,
} from "../src/features/entitlements/checkout";
import {
  getCheckoutErrorTranslationKey,
  getRevenueCatStructuredErrorProperties,
} from "../src/features/entitlements/revenuecat-errors";
import { useScreenOperationGuard } from "../src/hooks/useScreenOperationGuard";
import { formatPlanDate } from "../src/features/study-plan/generate-local-study-plan";
import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../src/portable-ui";
import { useAnalytics } from "../src/providers/AnalyticsProvider";
import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../src/analytics/catalog";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import {
  readHasPlusAccess,
  useEntitlementStore,
  useHasPlusAccess,
  usePurchaseAccess,
  useRevenueCatHydrationError,
  useRevenueCatOfferings,
  type RevenueCatPackageSummary,
} from "../src/state/entitlements";
import { useAppUserId } from "../src/identity/AppIdentityProvider";
import { useCurrentUser } from "../src/state/app-shell";
import {
  getMonetizationContextProperties,
  getMonetizationOfferSnapshot,
} from "../src/features/monetization/monetization-analytics";
import {
  getPaywallEntryProperties,
  getSingleParam,
  returnAfterPaywallUnlock,
} from "../src/features/monetization/paywall-return";
import { Paywall2Screen } from "../src/features/paywall2/Paywall2Screen";
import { useCountryConfig } from "../src/countries/use-country";
import { useMonetizationV2Active } from "../src/features/monetization/v2/store";

export default function PaywallRoute() {
  const { paywallOffer } = useCountryConfig();
  return paywallOffer === "plans" ? <Paywall2Screen testID="screen-paywall" /> : <LegacyPaywallPage />;
}

function LegacyPaywallPage() {
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
    moment?: string | string[];
    presentation?: string | string[];
    entry?: string | string[];
    questionId?: string | string[];
    questionLimit?: string | string[];
    returnTo?: string | string[];
    roadmapStepId?: string | string[];
    surface?: string | string[];
    topicId?: string | string[];
    trainingSessionId?: string | string[];
    examSessionId?: string | string[];
    premiumGateId?: string | string[];
    accessBlockId?: string | string[];
    sourceScreen?: string | string[];
    selectedAnswer?: string | string[];
    source?: string | string[];
    postPurchase?: string | string[];
    studyPlanTaskId?: string | string[];
  }>();
  const appUserId = useAppUserId();
  const authMode = useCurrentUser()?.provider ?? "guest";
  const purchaseAccess = usePurchaseAccess();
  const revenueCatHydrationError = useRevenueCatHydrationError();
  const revenueCatOfferings = useRevenueCatOfferings();
  const offerLoadStatus = useEntitlementStore((state) => state.revenueCatOfferingsLoad?.status ?? "idle");
  const hasPlusAccess = useHasPlusAccess();
  const monetizationV2 = useMonetizationV2Active();
  const sdkConfigured = isRevenueCatConfiguredForCurrentPlatform();
  const checkoutAttempt = useCheckoutStore((state) => state.attempt);
  const nativeRequestInFlight = useCheckoutStore((state) => state.nativeRequestInFlight);
  const recoveryInFlight = useCheckoutStore((state) => state.recoveryInFlight);
  const recoveryStatus = useCheckoutStore((state) => state.recoveryStatus);
  const recoveryAttemptId = useCheckoutStore((state) => state.recoveryAttemptId);
  const journalLoading = useCheckoutStore((state) =>
    state.journalAppUserId !== appUserId || state.journalStatus === "idle" || state.journalStatus === "loading"
  );
  const journalFailed = useCheckoutStore((state) =>
    state.journalAppUserId === appUserId && state.journalStatus === "failed"
  );
  const checkoutBusy = journalLoading || nativeRequestInFlight || recoveryInFlight || isCheckoutPending(checkoutAttempt);
  const operationBusy = journalLoading || nativeRequestInFlight || recoveryInFlight;
  const isPurchasing = nativeRequestInFlight && checkoutAttempt?.kind === "purchase";
  const isRestoring = (nativeRequestInFlight && checkoutAttempt?.kind === "restore") ||
    (recoveryInFlight && recoveryStatus === "restoring");
  const recoveryNeeded = checkoutAttempt?.appUserId === appUserId && needsCheckoutRecovery(checkoutAttempt);
  const retryAvailable = canRetryUnknownCheckout(checkoutAttempt);
  const [paywallViewId] = useState(createCheckoutId);
  const relatedCheckoutRef = useRef<CheckoutAttempt | null>(null);
  if (
    checkoutAttempt?.appUserId === appUserId &&
    (checkoutAttempt.originViewId === paywallViewId ||
      isCheckoutPending(checkoutAttempt) ||
      relatedCheckoutRef.current?.id === checkoutAttempt.id)
  ) {
    relatedCheckoutRef.current = checkoutAttempt;
  }
  const viewClosedRef = useRef(false);
  const screenOperation = useScreenOperationGuard(JSON.stringify(params));
  const [purchaseFeedback, setPurchaseFeedback] = useState<{
    kind: "error" | "success" | "info";
    message: string;
  } | null>(null);
  const [showSlowPurchaseHint, setShowSlowPurchaseHint] = useState(false);
  useEffect(() => {
    setShowSlowPurchaseHint(false);
    if (!isPurchasing || checkoutAttempt?.stage !== "purchase_package") return;
    // Copy only: this timer never cancels checkout or permits another payment.
    const timer = setTimeout(() => setShowSlowPurchaseHint(true), 30_000);
    return () => clearTimeout(timer);
  }, [isPurchasing, checkoutAttempt?.id, checkoutAttempt?.stage]);
  const targetFeature = getSingleParam(params.feature);
  const highlightedFeature = isAppFeature(targetFeature) ? targetFeature : null;

  const paywallMoment = getSingleParam(params.moment);
  const paywallMomentProperties: AnalyticsProperties = paywallMoment
    ? { moment: paywallMoment }
    : {};
  const paywallPresentation =
    getSingleParam(params.presentation) ?? "modal";
  const paywallEntry = getPaywallEntryProperties(params);
  const { source: paywallSource, surface: paywallSurface, roadmap_step_id: paywallRoadmapStepId } = paywallEntry;

  const continueAfterUnlock = () => {
    if (
      viewClosedRef.current ||
      !screenOperation.isCurrent() ||
      !readHasPlusAccess()
    ) {
      return;
    }
    dismissMethodRef.current = "access_unlocked";
    trackPaywallDismissRef.current("access_unlocked");
    viewClosedRef.current = true;
    screenOperation.invalidate();
    if (!returnAfterPaywallUnlock(params)) {
      router.back();
    }
  };

  const purchaseEndsAt = purchaseAccess?.latestExpirationDate
    ? formatPlanDate(purchaseAccess.latestExpirationDate.slice(0, 10))
    : null;
  const recommendedPackage = useMemo(
    () => selectPaywallPackage(revenueCatOfferings, monetizationV2),
    [monetizationV2, revenueCatOfferings]
  );
  const didTrackViewRef = useRef(false);
  const paywallShownAtRef = useRef<number | null>(null);
  const dismissMethodRef = useRef("navigation");
  const didTrackDismissRef = useRef(false);
  const paywallMomentRef = useRef(paywallMoment);
  const paywallEntryRef = useRef(paywallEntry);
  paywallEntryRef.current = paywallEntry;
  paywallMomentRef.current = paywallMoment;
  const trackRef = useRef(track);
  trackRef.current = track;
  const trackPaywallDismissRef = useRef<(method: string) => void>(
    () => undefined
  );
  trackPaywallDismissRef.current = (method: string) => {
    if (paywallShownAtRef.current == null || didTrackDismissRef.current) {
      return;
    }

    didTrackDismissRef.current = true;
    const checkout = useCheckoutStore.getState().attempt;
    const associatedCheckout =
      checkout?.appUserId === appUserId &&
      (checkout.originViewId === paywallViewId ||
        isCheckoutPending(checkout) ||
        relatedCheckoutRef.current?.id === checkout.id)
        ? checkout
        : relatedCheckoutRef.current;
    const accessUnlocked = readHasPlusAccess();
    trackRef.current(ANALYTICS_EVENTS.paywallDismissed.key, {
      ...getMonetizationOfferSnapshot(),
      ...offerTracker.getProperties(),
      paywall_view_id: paywallViewId,
      purchase_attempt_id: associatedCheckout?.id ?? null,
      purchase_origin_view_id: associatedCheckout?.originViewId ?? null,
      purchase_status: associatedCheckout?.status ?? "idle",
      dismiss_method: method,
      has_plus_access: accessUnlocked,
      is_plus: accessUnlocked,
      ...(paywallMomentRef.current ? { moment: paywallMomentRef.current } : {}),
      ...paywallEntryRef.current,
      time_visible_ms: Math.max(0, Date.now() - paywallShownAtRef.current),
    });
  };
  const didStartOfferRefreshRef = useRef(
    !sdkConfigured || revenueCatOfferings.length > 0
  );
  const selectedPackage = recommendedPackage;
  const selectedProductId = selectedPackage
    ? matchRevenueCatProductId(selectedPackage)
    : null;

  const offerContextRef = useRef(() => ({
    properties: {
      ...paywallEntry, ...paywallMomentProperties, presentation: paywallPresentation,
      feature: highlightedFeature ?? null, has_plus_access: readHasPlusAccess(),
      plus_purchase_enabled: FEATURE_FLAGS.enablePlusPurchase,
    },
    track,
    sdkConfigured,
    isVisible: !viewClosedRef.current && screenOperation.isCurrent(),
    selectPackage: (offers: RevenueCatPackageSummary[]) => selectPaywallPackage(offers, monetizationV2),
  }));
  offerContextRef.current = () => ({
    properties: {
      ...paywallEntry, ...paywallMomentProperties, presentation: paywallPresentation,
      feature: highlightedFeature ?? null, has_plus_access: readHasPlusAccess(),
      plus_purchase_enabled: FEATURE_FLAGS.enablePlusPurchase,
    },
    track,
    sdkConfigured,
    isVisible: !viewClosedRef.current && screenOperation.isCurrent(),
    selectPackage: (offers) => selectPaywallPackage(offers, monetizationV2),
  });
  const [offerTracker] = useState(() => createPaywallOfferTracker({
    viewId: paywallViewId,
    getContext: () => offerContextRef.current(),
  }));

  const comparisonRows = useMemo<PaywallComparisonRow[]>(
    () => {
      const included = { kind: "check" as const };
      const locked = { kind: "cross" as const };

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
          free: locked,
          premium: included,
        },
        {
          key: "mistakes",
          title: t("paywall.rowMistakes"),
          subtitle: t("paywall.rowMistakesSub"),
          free: locked,
          premium: included,
        },
        {
          key: "traps",
          title: t("paywall.rowTraps"),
          subtitle: t("paywall.rowTrapsSub"),
          free: locked,
          premium: included,
        },
        {
          key: "srs",
          title: t("paywall.rowSrs"),
          subtitle: t("paywall.rowSrsSub"),
          free: locked,
          premium: included,
        },
        {
          key: "offline",
          title: t("paywall.rowOffline"),
          subtitle: t("paywall.rowOfflineSub"),
          free: locked,
          premium: included,
        },
      ];
    },
    [t]
  );

  const displayPrice =
    selectedPackage?.priceString ?? t("paywall.ctaFallbackPrice");
  const crownIconSize = responsiveFont(24);

  const captureRevenueCat = (
    eventName: string,
    input: {
      error?: unknown;
      extra?: Record<string, string | number | boolean | null>;
      kind: string;
      severity?: "warning" | "error";
      step: string;
      why: string;
    }
  ) => {
    captureError({
      area: "revenuecat",
      error: input.error,
      eventName,
      message: `${input.step}:${input.why}`,
      metadata: getRevenueCatDiagnostic({
        extra: {
          ...paywallEntry,
          ...input.extra,
        },
        kind: input.kind,
        step: input.step,
        why: input.why,
      }),
      severity: input.severity ?? "error",
    });
  };

  useEffect(() => {
    if (didStartOfferRefreshRef.current) {
      return;
    }

    didStartOfferRefreshRef.current = true;
    let cancelled = false;

    void fetchRevenueCatOfferings(appUserId, "paywall_open")
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.warn("Failed to refresh RevenueCat offers on paywall.", error);
        captureRevenueCat("revenuecat_offerings_failed", {
          error,
          kind: "paywall_open",
          step: "get_offerings",
          why: getRevenueCatWhy(error),
          extra: { ...offerTracker.getProperties(), ...getRevenueCatStructuredErrorProperties(error) },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appUserId, offerTracker]);

  useEffect(() => {
    if (didTrackViewRef.current) {
      return;
    }

    didTrackViewRef.current = true;
    paywallShownAtRef.current = Date.now();
    track(ANALYTICS_EVENTS.paywallViewed.key, {
      ...getMonetizationContextProperties(),
      ...offerTracker.getProperties(),
      paywall_view_id: paywallViewId,
      purchase_attempt_id: relatedCheckoutRef.current?.id ?? null,
      purchase_status: relatedCheckoutRef.current?.status ?? "idle",
      auth_mode: authMode,
      feature: highlightedFeature ?? null,
      has_plus_access: hasPlusAccess,
      has_purchase_access: Boolean(purchaseAccess),
      hydration_error_code: revenueCatHydrationError,
      offers_count: revenueCatOfferings.length,
      plus_purchase_enabled: FEATURE_FLAGS.enablePlusPurchase,
      revenuecat_configured: sdkConfigured,
      ...paywallEntry,
      product_id: recommendedPackage?.productIdentifier ?? null,
      price: recommendedPackage?.price ?? null,
      currency: recommendedPackage?.currencyCode ?? null,
      ...paywallMomentProperties,
      presentation: paywallPresentation,
    });
  }, [
    appUserId,
    authMode,
    checkoutAttempt,
    hasPlusAccess,
    highlightedFeature,
    paywallMoment,
    paywallViewId,
    paywallPresentation,
    paywallRoadmapStepId,
    paywallSource,
    paywallSurface,
    purchaseAccess,
    revenueCatHydrationError,
    revenueCatOfferings.length,
    sdkConfigured,
    track,
  ]);

  useEffect(() => {
    offerTracker.start(paywallShownAtRef.current ?? Date.now());
    return () => offerTracker.stop();
  }, [offerTracker]);
  useFocusEffect(useCallback(() => {
    offerTracker.observe();
  }, [offerTracker]));

  useEffect(() => {
    viewClosedRef.current = false;
    return () => {
      viewClosedRef.current = true;
      trackPaywallDismissRef.current(dismissMethodRef.current);
    };
  }, []);

  const showPurchaseError = (message: string) => {
    setPurchaseFeedback({
      kind: "error",
      message,
    });
    if (!mobileEnv.enableE2ETestMode) {
      Alert.alert(t("paywall.directTitle"), message);
    }
  };

  const handlePurchase = async (confirmedRetryAttemptId?: string) => {
    if (viewClosedRef.current) {
      return;
    }
    const ctaProperties = {
      ...offerTracker.getProperties(),
      ...paywallEntry,
      paywall_view_id: paywallViewId,
      action: confirmedRetryAttemptId ? "retry_purchase" : "purchase",
      offer_state: offerLoadStatus,
      package_available: Boolean(selectedPackage),
      revenuecat_configured: sdkConfigured,
      retry_of_attempt_id: confirmedRetryAttemptId ?? null,
    };
    track(ANALYTICS_EVENTS.paywallCtaSelected.key, ctaProperties);
    if ((checkoutBusy && !confirmedRetryAttemptId) || operationBusy || hasPlusAccess || viewClosedRef.current) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, {
        ...ctaProperties,
        blocked_reason: hasPlusAccess ? "already_entitled" : "checkout_busy",
      });
      return;
    }
    if (!FEATURE_FLAGS.enablePlusPurchase) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, {
        ...ctaProperties,
        blocked_reason: "purchase_disabled",
      });
      showPurchaseError(t("paywall.purchaseUnavailable"));
      return;
    }
    if (!sdkConfigured) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, {
        ...ctaProperties,
        blocked_reason: "not_configured",
      });
      captureRevenueCat("paywall_not_configured", {
        kind: "purchase",
        severity: "warning",
        step: "purchase_package",
        why: "not_configured",
        extra: { ...offerTracker.getProperties(), paywall_view_id: paywallViewId },
      });
      showPurchaseError(t("paywall.directMissingConfig"));
      return;
    }

    const canUpdateScreen = screenOperation.captureGuard();
    setPurchaseFeedback(null);
    const result = await startCheckoutPurchase({
      appUserId,
      originViewId: paywallViewId,
      selectedPackage,
      confirmedRetryAttemptId,
      selectPackage: (offers) => selectPaywallPackage(offers, monetizationV2),
      properties: {
        ...offerTracker.getProperties(),
        feature: highlightedFeature ?? "premium_access",
        ...paywallMomentProperties,
        ...paywallEntry,
      },
      track,
      captureError,
    });

    const latestAttemptId = useCheckoutStore.getState().attempt?.id;
    if (!result || !canUpdateScreen() || viewClosedRef.current ||
      (latestAttemptId !== result.id && latestAttemptId !== result.retryOfAttemptId)) {
      return;
    }
    if (result.status === "succeeded") {
      continueAfterUnlock();
    } else if (result.status === "cancelled") {
      setPurchaseFeedback({ kind: "info", message: t("paywall.purchaseCancelled") });
    } else if (result.status === "failed") {
      showPurchaseError(t(getCheckoutErrorTranslationKey(result.errorKind)));
    }
  };

  const handleRestore = async () => {
    if (viewClosedRef.current) {
      return;
    }
    const ctaProperties = {
      ...offerTracker.getProperties(),
      ...paywallEntry,
      paywall_view_id: paywallViewId,
      action: "restore",
      offer_state: offerLoadStatus,
      revenuecat_configured: sdkConfigured,
    };
    track(ANALYTICS_EVENTS.paywallCtaSelected.key, ctaProperties);
    if (operationBusy || viewClosedRef.current) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, {
        ...ctaProperties,
        blocked_reason: "checkout_busy",
      });
      return;
    }
    if (!sdkConfigured) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, {
        ...ctaProperties,
        blocked_reason: "not_configured",
      });
      captureRevenueCat("paywall_not_configured", {
        kind: "restore",
        severity: "warning",
        step: "restore_purchases",
        why: "not_configured",
        extra: { ...offerTracker.getProperties(), paywall_view_id: paywallViewId },
      });
      showPurchaseError(t("paywall.directMissingConfig"));
      return;
    }

    const canUpdateScreen = screenOperation.captureGuard();
    setPurchaseFeedback(null);
    const result = await startCheckoutRestore({
      appUserId,
      originViewId: paywallViewId,
      properties: { ...paywallMomentProperties, ...paywallEntry },
      track,
      captureError,
    });
    if (!result || !canUpdateScreen() || viewClosedRef.current ||
      useCheckoutStore.getState().attempt?.id !== result.id) {
      return;
    }
    if (result.status === "succeeded") {
      continueAfterUnlock();
    } else if (result.status === "empty") {
      setPurchaseFeedback({ kind: "info", message: t(recoveryNeeded ? "paywall.checkout.check_not_found" : "paywall.restoreEmpty") });
    } else if (result.status === "failed") {
      showPurchaseError(t(getCheckoutErrorTranslationKey(result.errorKind)));
    }
  };

  const purchaseDisabled =
    hasPlusAccess ||
    checkoutBusy ||
    !FEATURE_FLAGS.enablePlusPurchase;
  const helperKind = getPaywallOfferHelperKind({
    hasPlusAccess,
    hydrationError: revenueCatHydrationError,
    isPurchasing,
    offeringsCount: revenueCatOfferings.length,
    plusPurchaseEnabled: FEATURE_FLAGS.enablePlusPurchase,
    revenueCatStatus: offerLoadStatus === "loading" || offerLoadStatus === "idle" ? "loading" : "ready",
    sdkConfigured,
  });
  const recoveryMessage = recoveryNeeded
    ? t(checkoutAttempt?.status === "outcome_unknown"
      ? "paywall.checkout.store_problem"
      : checkoutAttempt?.errorKind
        ? getCheckoutErrorTranslationKey(checkoutAttempt.errorKind)
        : "paywall.purchasePending")
    : null;
  const helperMessage =
    !hasPlusAccess && journalLoading
      ? t("paywall.checkout.check_loading")
      : !hasPlusAccess && journalFailed
        ? t("paywall.checkout.local_storage")
        : !hasPlusAccess && isPurchasing
          ? t(checkoutAttempt?.stage === "get_customer_info" ? "paywall.checkout.check_loading"
            : checkoutAttempt?.stage === "get_offerings" ? "paywall.directLoading"
            : showSlowPurchaseHint ? "paywall.checkout.processing_long" : "paywall.purchaseCtaLoading")
          : !hasPlusAccess && recoveryNeeded
            ? recoveryMessage
            : helperKind === "purchase_unavailable"
              ? t("paywall.purchaseUnavailable")
              : helperKind === "purchase_loading"
                ? t("paywall.purchaseCtaLoading")
                : helperKind === "offers_loading"
                  ? t("paywall.directLoading")
                  : helperKind === "missing_config"
                    ? t("paywall.directMissingConfig")
                    : helperKind === "hydration_failed"
                      ? t("paywall.directHydrationFailed")
                      : helperKind === "no_offers"
                        ? t("paywall.directNoOffers")
                        : null;
  const showRetryOffers =
    sdkConfigured &&
    !hasPlusAccess &&
    !recoveryNeeded &&
    (helperKind === "hydration_failed" || helperKind === "no_offers");

  async function handleCheckPurchase() {
    if (operationBusy || !recoveryNeeded || !screenOperation.isCurrent()) return;
    setPurchaseFeedback(null);
    await refreshCheckoutAccess(appUserId);
    // Shared recovery state renders the result even on a different paywall.
  }

  function handleRetryPurchase() {
    const attemptId = checkoutAttempt?.id;
    if (!attemptId || !retryAvailable) return;
    const canUpdateScreen = screenOperation.captureGuard();
    Alert.alert(t("paywall.checkout.retry_title"), t("paywall.checkout.retry_warning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("paywall.checkout.retry_confirm"), onPress: () => {
        if (canUpdateScreen() && useCheckoutStore.getState().attempt?.id === attemptId &&
          canRetryUnknownCheckout(useCheckoutStore.getState().attempt)) {
          void handlePurchase(attemptId);
        }
      } },
    ]);
  }

  async function handleRetryOffers() {
    if (!sdkConfigured || operationBusy || recoveryNeeded) {
      return;
    }

    setPurchaseFeedback(null);

    try {
      await fetchRevenueCatOfferings(appUserId, "paywall_retry");
    } catch (error) {
      console.warn("Failed to retry RevenueCat offers on paywall.", error);
      captureRevenueCat("revenuecat_offerings_failed", {
        error,
        kind: "paywall_retry",
        step: "get_offerings",
        why: getRevenueCatWhy(error),
        extra: { ...offerTracker.getProperties(), ...getRevenueCatStructuredErrorProperties(error) },
      });
    }
  }

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
            onPress={() => {
              if (viewClosedRef.current) {
                return;
              }
              dismissMethodRef.current = "close_button";
              trackPaywallDismissRef.current("close_button");
              viewClosedRef.current = true;
              screenOperation.invalidate();
              router.back();
            }}
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
          </ScrollView>

          <View
            style={[
              styles.footer,
              insets.bottom > 0 ? { paddingBottom: insets.bottom } : null,
            ]}
          >
            {purchaseFeedback && !hasPlusAccess ? (
              <CText
                style={[
                  styles.feedbackText,
                  purchaseFeedback.kind === "error" ? styles.feedbackError
                    : purchaseFeedback.kind === "success" ? styles.feedbackSuccess : null,
                ]}
                testID="paywall-purchase-feedback"
              >
                {purchaseFeedback.message}
              </CText>
            ) : null}

            {helperMessage ? (
              <CText style={styles.helperText}>{helperMessage}</CText>
            ) : null}

            {!hasPlusAccess && recoveryNeeded ? (
              <>
                {recoveryAttemptId === checkoutAttempt?.id &&
                  (recoveryStatus === "not_found" || recoveryStatus === "failed") ? (
                  <CText style={styles.helperText} testID="paywall-check-result">
                    {t(recoveryStatus === "failed" ? "paywall.checkout.check_failed" : "paywall.checkout.check_not_found")}
                  </CText>
                ) : null}
                <Pressable accessibilityRole="button" disabled={operationBusy}
                  onPress={() => void handleCheckPurchase()}
                  style={({ pressed }) => [styles.restoreButton, pressed ? styles.pressed : null]}
                  testID="paywall-check-purchase">
                  <CText style={styles.restoreLabel}>
                    {t(recoveryInFlight && recoveryStatus === "checking" ? "paywall.checkout.check_loading" : "paywall.checkout.check_cta")}
                  </CText>
                </Pressable>
                {checkoutAttempt?.status === "outcome_unknown" ? (
                  <Pressable accessibilityRole="button" disabled={!retryAvailable}
                    onPress={handleRetryPurchase}
                    style={({ pressed }) => [styles.restoreButton, !retryAvailable ? styles.ctaDisabled : null, pressed ? styles.pressed : null]}
                    testID="paywall-retry-purchase">
                    <CText style={styles.restoreLabel}>{t("paywall.checkout.retry_cta")}</CText>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {showRetryOffers ? (
              <Pressable
                accessibilityRole="button"
                disabled={operationBusy}
                onPress={() => void handleRetryOffers()}
                style={({ pressed }) => [
                  styles.restoreButton,
                  pressed ? styles.pressed : null,
                ]}
                testID="paywall-retry-offers"
              >
                <CText style={styles.restoreLabel}>{t("common.retry")}</CText>
              </Pressable>
            ) : null}

            {!hasPlusAccess ? (
              <>
                {selectedProductId === "lifetime" ? (
                  <View style={styles.lifetimeRow}>
                    <CText style={styles.lifetimeText}>
                      {t("paywall.lifetimeNote")}
                    </CText>
                    <View style={styles.lifetimeDot} />
                    <CText style={styles.lifetimeText}>
                      {t("paywall.lifetimeAccess")}
                    </CText>
                  </View>
                ) : null}

                {!recoveryNeeded ? <Pressable
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
                </Pressable> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={operationBusy}
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

function selectPaywallPackage(offers: RevenueCatPackageSummary[], monetizationV2: boolean) {
  return (monetizationV2
    ? offers.find((item) => matchRevenueCatProductId(item) === "lifetime") ??
      offers.find((item) => item.packageType === "LIFETIME")
    : null) ?? pickRecommendedPackage(offers);
}

function isAppFeature(value: string | undefined): value is AppFeature {
  return APP_FEATURES.includes(value as AppFeature);
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
