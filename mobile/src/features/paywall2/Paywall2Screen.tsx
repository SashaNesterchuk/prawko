import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";

import { FEATURE_FLAGS } from "@prawko/config";

import {
  createCheckoutId,
  isCheckoutPending,
  startCheckoutPurchase,
  startCheckoutRestore,
  useCheckoutStore,
} from "../entitlements/checkout";
import {
  fetchRevenueCatOfferings,
  fetchTrialIneligibleProductIds,
  isRevenueCatConfiguredForCurrentPlatform,
  matchRevenueCatProductId,
  pickRecommendedPackage,
} from "../entitlements/revenuecat";
import { getCheckoutErrorTranslationKey } from "../entitlements/revenuecat-errors";
import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import { useAnalyticsDuration } from "../../analytics/useAnalyticsDuration";
import { createPaywallOfferTracker } from "../entitlements/paywall-offer-analytics";
import { getPackageAnalyticsSnapshot } from "../entitlements/offer-snapshot";
import { createPaywallOriginSnapshot } from "../entitlements/offer-origin";
import { createPaywallTrialEligibilityTracker } from "../entitlements/trial-eligibility-observation";
import type { CriticalAnalyticsPayloads } from "../../analytics/critical-payloads";
import { getMonetizationContextProperties } from "../monetization/monetization-analytics";
import {
  getPaywallEntryProperties,
  getSingleParam,
  returnAfterPaywallUnlock,
} from "../monetization/paywall-return";
import { useMonetizationV2Active } from "../monetization/v2/store";
import { useCountryConfig } from "../../countries/use-country";
import { Paywall2View, type Paywall2Offer } from "./Paywall2View";
import { getPaywall2PlanAnalyticsSnapshot, selectPaywall2AnalyticsPlan } from "./analytics";
import {
  findPaywall2PlanPackage,
  PAYWALL2_DEFAULT_PLAN,
  pickPaywall2Plan,
  resolvePaywall2Plans,
  type Paywall2PlanId,
} from "./plans";
import { useAppUserId } from "../../identity/AppIdentityProvider";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useAppShellStore, useCurrentUser } from "../../state/app-shell";
import {
  readHasPlusAccess,
  useEntitlementStore,
  useHasPlusAccess,
  useRevenueCatOfferings,
  type RevenueCatPackageSummary,
} from "../../state/entitlements";

export function Paywall2Screen({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const paywallEntry = getPaywallEntryProperties(params);
  const presentation = getSingleParam(params.presentation) ?? "modal";
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const appUserId = useAppUserId();
  const authMode = useCurrentUser()?.provider ?? "guest";
  const offerings = useRevenueCatOfferings();
  const hasPlusAccess = useHasPlusAccess();
  const monetizationV2 = useMonetizationV2Active();
  const subscriptionOffer = useCountryConfig().paywallOffer === "plans";
  const sdkConfigured = isRevenueCatConfiguredForCurrentPlatform();
  const attempt = useCheckoutStore((state) => state.attempt);
  const nativeRequestInFlight = useCheckoutStore((state) => state.nativeRequestInFlight);
  const recoveryInFlight = useCheckoutStore((state) => state.recoveryInFlight);
  const [viewId] = useState(createCheckoutId);
  const [feedback, setFeedback] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(true);
  const [analyticsFocused, setAnalyticsFocused] = useState(true);
  const visibleClock = useAnalyticsDuration(viewId, analyticsFocused);

  const offersLoadStatus = useEntitlementStore((state) => state.revenueCatOfferingsLoad?.status);
  const [selectedPlanId, setSelectedPlanId] = useState<Paywall2PlanId>(PAYWALL2_DEFAULT_PLAN);
  const [trialIneligible, setTrialIneligible] = useState<{ key: string; ids: string[] } | null>(null);
  const [trialEligibilityErrorKey, setTrialEligibilityErrorKey] = useState<string | null>(null);
  const [paywallOrigin] = useState(() => {
    const shell = useAppShellStore.getState();
    return createPaywallOriginSnapshot({
      variant: "paywall2", offer: subscriptionOffer ? "plans" : "lifetime",
      default_plan: subscriptionOffer ? PAYWALL2_DEFAULT_PLAN : null, config_version: 1,
      country: shell.examCountry, category: shell.preferredCategory, locale: shell.preferredLocale,
      monetization_version: monetizationV2 ? 2 : 1, presentation,
      source: paywallEntry.source ?? null, surface: paywallEntry.surface ?? null,
    });
  });
  const [trialTracker] = useState<ReturnType<typeof createPaywallTrialEligibilityTracker>>(() => createPaywallTrialEligibilityTracker({
    viewId, getContext: () => ({
      properties: analyticsRef.current.paywallProperties, track: analyticsRef.current.track,
      isVisible: mountedRef.current && focusedRef.current && AppState.currentState === "active",
    }),
  }));
  const trialProductIds = useMemo(
    () => offerings.filter((item) => item.freeTrialDays).map((item) => item.productIdentifier),
    [offerings]
  );
  const trialKey = trialProductIds.join(",");
  useEffect(() => {
    if (!trialKey) return;
    let active = true;
    const observation = trialTracker.begin(trialKey.split(","));
    fetchTrialIneligibleProductIds(appUserId, trialKey.split(","), observation.observe)
      .then((ids) => active && setTrialIneligible({ key: trialKey, ids }))
      .catch((error) => {
        if (active) setTrialEligibilityErrorKey(trialKey);
        console.warn("Failed to check free trial eligibility on paywall2.", error);
      });
    return () => {
      active = false;
      observation.stop();
    };
  }, [appUserId, trialKey, trialTracker]);

  const planOffer = useMemo(
    () => resolvePaywall2Plans(offerings, {
      // Dev builds run with RevenueCat off, so they preview sample prices.
      preview: __DEV__,
      trialIneligibleProductIds: !trialKey ? [] : trialIneligible?.key === trialKey ? trialIneligible.ids : null,
    }),
    [offerings, trialIneligible, trialKey]
  );
  // Country config owns billing, not the offering or UI locale. PL must never
  // show lifetime claims, even if the store has no supported subscription.
  // The production /paywall route keeps CZ/SK on LegacyPaywallPage.
  const plans = subscriptionOffer ? planOffer.plans : null;
  const selectedPlan = plans ? pickPaywall2Plan(plans, selectedPlanId) : null;
  const lifetimePackage = useMemo(
    () => subscriptionOffer ? null : selectLifetimePackage(offerings, monetizationV2),
    [monetizationV2, offerings, subscriptionOffer]
  );
  const selectedPackage = subscriptionOffer ? selectedPlan?.package ?? null : lifetimePackage;
  const offer: Paywall2Offer = subscriptionOffer
    ? {
        kind: "plans",
        plans: planOffer.plans,
        selectedPlanId: selectedPlan?.id ?? PAYWALL2_DEFAULT_PLAN,
        onSelectPlan: (id, placement) => selectPlan(id, placement),
      }
    : {
        kind: "lifetime",
        price: lifetimePackage?.priceString ?? (__DEV__ ? t("paywall.ctaFallbackPrice") : null),
      };
  const busy = nativeRequestInFlight || recoveryInFlight || isCheckoutPending(attempt);
  const purchaseBusy = nativeRequestInFlight && attempt?.kind === "purchase";
  const restoreBusy = nativeRequestInFlight && attempt?.kind === "restore";
  const offerUnavailable = subscriptionOffer && !hasPlusAccess && !selectedPackage &&
    (offersLoadStatus === "ready" || offersLoadStatus === "empty" || offersLoadStatus === "failed");

  const paywallProperties: AnalyticsProperties = {
    ...paywallOrigin,
    ...paywallEntry,
    presentation,
    feature: "premium_access",
    paywall_variant: "paywall2",
    paywall_offer: offer.kind,
    plan: selectedPlan?.id ?? null,
    trial_days: selectedPlan?.trialDays ?? null,
    ...(subscriptionOffer ? getPaywall2PlanAnalyticsSnapshot({
      offers: offerings,
      selectedPlanId,
      trialIneligibleProductIds: !trialKey ? [] : trialIneligible?.key === trialKey ? trialIneligible.ids : null,
      trialEligibilityFailed: trialIneligible?.key !== trialKey && trialEligibilityErrorKey === trialKey,
      trialEligibilityProduct: trialTracker.getProduct(selectedPackage?.productIdentifier ?? "", trialKey),
    }) : getPackageAnalyticsSnapshot(selectedPackage)),
  };
  const analyticsRef = useRef({
    paywallProperties, selectedPackage, selectedPlanId, subscriptionOffer, monetizationV2,
    trialIneligible, trialEligibilityErrorKey, track,
  });
  analyticsRef.current = {
    paywallProperties, selectedPackage, selectedPlanId, subscriptionOffer, monetizationV2,
    trialIneligible, trialEligibilityErrorKey, track,
  };
  const [offerTracker] = useState(() => createPaywallOfferTracker({
    viewId,
    getContext: () => {
      const current = analyticsRef.current;
      const offers = useEntitlementStore.getState().revenueCatOfferings;
      const liveTrialKey = offers.filter((item) => item.freeTrialDays).map((item) => item.productIdentifier).join(",");
      const livePackage = selectPaywall2AnalyticsPlan(offers, current.selectedPlanId)?.package;
      return {
        properties: {
          ...current.paywallProperties,
          ...(current.subscriptionOffer ? getPaywall2PlanAnalyticsSnapshot({
            offers, selectedPlanId: current.selectedPlanId,
            trialIneligibleProductIds: !liveTrialKey ? [] : current.trialIneligible?.key === liveTrialKey
              ? current.trialIneligible.ids : null,
            trialEligibilityFailed: current.trialIneligible?.key !== liveTrialKey &&
              current.trialEligibilityErrorKey === liveTrialKey,
            trialEligibilityProduct: trialTracker.getProduct(livePackage?.productIdentifier ?? "", liveTrialKey),
          }) : {}),
        },
        track: current.track,
        sdkConfigured,
        isVisible: mountedRef.current && focusedRef.current,
        selectPackage: (available: RevenueCatPackageSummary[]) => current.subscriptionOffer
          ? selectPaywall2AnalyticsPlan(available, current.selectedPlanId)?.package ?? null
          : selectLifetimePackage(available, current.monetizationV2),
      };
    },
  }));
  const shownAtRef = useRef(Date.now());
  const dismissMethodRef = useRef("navigation");

  useEffect(() => {
    mountedRef.current = true;
    const { paywallProperties: properties, selectedPackage: pkg } = analyticsRef.current;
    track(ANALYTICS_EVENTS.paywallViewed.key, {
      ...getMonetizationContextProperties(),
      ...offerTracker.getProperties(),
      ...properties,
      auth_mode: authMode,
      has_plus_access: readHasPlusAccess(),
      offers_count: useEntitlementStore.getState().revenueCatOfferings.length,
      plus_purchase_enabled: FEATURE_FLAGS.enablePlusPurchase,
      revenuecat_configured: sdkConfigured,
      product_id: pkg?.productIdentifier ?? null,
      price: pkg?.price ?? null,
      currency: pkg?.currencyCode ?? null,
    });
    offerTracker.start(shownAtRef.current);
    return () => {
      mountedRef.current = false;
      offerTracker.stop();
      const checkout = useCheckoutStore.getState().attempt;
      const ownCheckout = checkout?.originViewId === viewId ? checkout : null;
      const accessUnlocked = readHasPlusAccess();
      analyticsRef.current.track(ANALYTICS_EVENTS.paywallDismissed.key, {
        ...getMonetizationContextProperties(),
        ...offerTracker.getProperties(),
        ...analyticsRef.current.paywallProperties,
        purchase_attempt_id: ownCheckout?.id ?? null,
        purchase_status: ownCheckout?.status ?? "idle",
        dismiss_method: dismissMethodRef.current,
        has_plus_access: accessUnlocked,
        is_plus: accessUnlocked,
        time_visible_ms: Math.max(0, Date.now() - shownAtRef.current),
        ...visibleClock.measure(),
      });
    };
    // Exactly one view/dismiss pair per mounted paywall.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    setAnalyticsFocused(true);
    offerTracker.observe();
    return () => {
      focusedRef.current = false;
      setAnalyticsFocused(false);
    };
  }, [offerTracker]));

  const selectPlan = (id: Paywall2PlanId, placement: "offer" | "final") => {
    if (id === selectedPlan?.id) return;
    setSelectedPlanId(id);
    const plan = plans?.find((item) => item.id === id);
    track(ANALYTICS_EVENTS.paywallPlanSelected.key, {
      ...offerTracker.getProperties(),
      ...paywallProperties,
      plan: id,
      previous_plan: selectedPlan?.id ?? null,
      placement,
      trial_days: plan?.trialDays ?? null,
      product_id: plan?.package?.productIdentifier ?? null,
      price: plan?.package?.price ?? null,
      currency: plan?.package?.currencyCode ?? null,
      ...getPaywall2PlanAnalyticsSnapshot({
        offers: offerings,
        selectedPlanId: id,
        trialIneligibleProductIds: !trialKey ? [] : trialIneligible?.key === trialKey ? trialIneligible.ids : null,
        trialEligibilityFailed: trialIneligible?.key !== trialKey && trialEligibilityErrorKey === trialKey,
        trialEligibilityProduct: trialTracker.getProduct(plan?.package?.productIdentifier ?? "", trialKey),
      }),
    });
  };

  const trackCta = (action: "purchase" | "restore",
    blockedReason: CriticalAnalyticsPayloads["paywall_checkout_blocked"]["blocked_reason"] | null) => {
    const properties = {
      ...offerTracker.getProperties(),
      ...paywallProperties,
      action,
      offer_state: offersLoadStatus ?? "idle",
      revenuecat_configured: sdkConfigured,
      ...(action === "purchase" ? { package_available: Boolean(selectedPackage) } : {}),
    };
    track(ANALYTICS_EVENTS.paywallCtaSelected.key, properties);
    if (blockedReason) {
      track(ANALYTICS_EVENTS.paywallCheckoutBlocked.key, { ...properties, blocked_reason: blockedReason });
    }
  };

  const hasOffers = offerings.length > 0;
  useEffect(() => {
    if (!sdkConfigured || hasOffers) return;
    void fetchRevenueCatOfferings(appUserId, "paywall_open").catch((error) => {
      console.warn("Failed to refresh RevenueCat offers on paywall2.", error);
    });
  }, [appUserId, hasOffers, sdkConfigured]);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const continueAfterUnlock = () => {
    dismissMethodRef.current = "access_unlocked";
    if (!returnAfterPaywallUnlock(params)) {
      close();
    }
  };

  const handleUnlock = async () => {
    const blockedReason = hasPlusAccess ? "already_entitled"
      : busy ? "checkout_busy"
      : !FEATURE_FLAGS.enablePlusPurchase ? "purchase_disabled"
      : !sdkConfigured ? "not_configured"
      : !selectedPackage ? "package_unavailable"
      : null;
    trackCta("purchase", blockedReason);
    if (blockedReason) {
      if (blockedReason !== "already_entitled" && blockedReason !== "checkout_busy") {
        console.warn("Purchase is not available in this build.");
      }
      return;
    }
    if (!selectedPackage) return;
    setFeedback(null);
    const planId = selectedPlan?.id ?? null;
    const result = await startCheckoutPurchase({
      appUserId,
      originViewId: viewId,
      selectedPackage,
      selectPackage: (offers) =>
        planId
          ? findPaywall2PlanPackage(offers, planId)
          : selectLifetimePackage(offers, monetizationV2),
      properties: paywallProperties,
      track,
      captureError,
    });
    if (!result || !mountedRef.current) return;
    if (result.status === "succeeded") {
      continueAfterUnlock();
    } else if (result.status === "failed") {
      setFeedback(t(getCheckoutErrorTranslationKey(result.errorKind)));
    } else if (result.status === "awaiting_confirmation" || result.status === "outcome_unknown") {
      setFeedback(t("paywall.purchasePending"));
    }
  };

  const handleRestore = async () => {
    const blockedReason = nativeRequestInFlight || recoveryInFlight ? "checkout_busy"
      : !sdkConfigured ? "not_configured"
      : null;
    trackCta("restore", blockedReason);
    if (blockedReason) {
      if (blockedReason === "not_configured") console.warn("Restore is not available in this build.");
      return;
    }
    setFeedback(null);
    const result = await startCheckoutRestore({
      appUserId,
      originViewId: viewId,
      properties: paywallProperties,
      track,
      captureError,
    });
    if (!result || !mountedRef.current) return;
    if (result.status === "succeeded") {
      continueAfterUnlock();
    } else if (result.status === "empty") {
      setFeedback(t("paywall2.restoreEmpty"));
    } else if (result.status === "failed") {
      setFeedback(t(getCheckoutErrorTranslationKey(result.errorKind)));
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <Paywall2View
        feedback={feedback ?? (offerUnavailable ? t("paywall.directNoOffers") : null)}
        hasPlusAccess={hasPlusAccess}
        onClose={() => {
          dismissMethodRef.current = "close_button";
          close();
        }}
        onContinue={continueAfterUnlock}
        onRestore={() => void handleRestore()}
        offer={offer}
        onUnlock={() => void handleUnlock()}
        purchaseBusy={purchaseBusy}
        purchaseDisabled={busy || (!hasPlusAccess && !selectedPackage)}
        restoreBusy={restoreBusy}
        testID={testID}
      />
    </>
  );
}

function selectLifetimePackage(offers: RevenueCatPackageSummary[], monetizationV2: boolean) {
  return (monetizationV2
    ? offers.find((item) => matchRevenueCatProductId(item) === "lifetime") ??
      offers.find((item) => item.packageType === "LIFETIME")
    : null) ?? pickRecommendedPackage(offers);
}
