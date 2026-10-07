import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppShellStore } from "../../../state/app-shell";
import { createEmptyFeatureEntitlements, useEntitlementStore } from "../../../state/entitlements";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";
import { createPaywallOriginSnapshot } from "../offer-origin";
import { getPackageAnalyticsSnapshot } from "../offer-snapshot";
import { getPaywall2PlanAnalyticsSnapshot } from "../../paywall2/analytics";
import { readCheckoutJournal, writeCheckoutJournal, type CheckoutJournalRecord } from "../checkout-journal";
import {
  hydrateCheckoutJournal, reconcileCheckoutAccess, refreshCheckoutAccess, resetCheckoutForTests,
  startCheckoutPurchase, startCheckoutRestore, useCheckoutStore,
} from "../checkout";
import {
  fetchRevenueCatAccessSnapshot, purchaseRevenueCatPackage, restoreRevenueCatPurchases,
  type RevenueCatSnapshot,
} from "../revenuecat";
import { analyticsOffer } from "./offer-fixture";

jest.mock("../../../identity/app-user-id", () => {
  let sequence = 0;
  return { createAppUserId: () => `usr_golden_${++sequence}` };
});
jest.mock("../revenuecat", () => ({
  purchaseRevenueCatPackage: jest.fn(), restoreRevenueCatPurchases: jest.fn(),
  fetchRevenueCatAccessSnapshot: jest.fn(), fetchRevenueCatSnapshot: jest.fn(),
  getRevenueCatDiagnostic: jest.fn(() => ({})),
  getRevenueCatErrorCode: jest.fn((error: { code?: string } | null) => error?.code ?? null),
  getRevenueCatErrorMessage: jest.fn(() => "Controlled checkout error."),
  getRevenueCatWhy: jest.fn(() => "unknown"),
}));

const APP_USER_ID = "install-golden";
function snapshot(active = false, product = "premium-P3M"): RevenueCatSnapshot {
  return {
    featureEntitlements: { ...createEmptyFeatureEntitlements(), premium_access: active },
    customerInfoRequestDate: active ? "2026-10-07T10:02:00Z" : "2026-10-07T10:00:00Z",
    activeProductIdentifiers: active ? [product] : [], isConfigured: true, offerings: [], offeringsError: null,
    purchaseAccess: active ? {
      activeEntitlementIds: ["premium"], latestExpirationDate: null,
      managementUrl: null, originalAppUserId: APP_USER_ID,
    } : null,
  };
}
function input(plan: "quarter" | "month" = "quarter", viewId = "view-a") {
  const offer = analyticsOffer(plan === "quarter" ? "P3M" : "P1M", plan === "quarter" ? "THREE_MONTH" : "MONTHLY");
  return {
    appUserId: APP_USER_ID, originViewId: viewId, selectedPackage: offer,
    selectPackage: () => offer, track: jest.fn(), captureError: jest.fn(),
    properties: {
      ...createPaywallOriginSnapshot({
        variant: "paywall2", offer: "plans", default_plan: "quarter", config_version: 1,
        country: "PL", category: "B", locale: "pl", monetization_version: 2,
        presentation: "modal", source: "paywall", surface: "home",
      }),
      ...getPaywall2PlanAnalyticsSnapshot({
        offers: [offer], selectedPlanId: plan, trialIneligibleProductIds: [],
        trialEligibilityProduct: { productId: offer.productIdentifier, outcome: "eligible",
          basis: "revenuecat_ios_status", requestId: "eligibility-a" },
      }),
      source: "paywall", surface: "home", paywall_variant: "paywall2", paywall_offer: "plans",
    },
  };
}
async function nativeUnknown() {
  const original = input();
  const nativeOffer = { ...original.selectedPackage, price: 59.99, productIdentifier: "premium-P3M-v2" };
  jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (request) => {
    await request.onStage?.("get_offerings");
    await request.onStage?.("purchase_package", nativeOffer);
    request.onNativePurchaseStart?.();
    throw { code: "2" };
  });
  const attempt = await startCheckoutPurchase(original);
  expect(attempt?.status).toBe("outcome_unknown");
  return { original, nativeOffer, attempt: attempt! };
}

describe("controlled checkout origin golden traces", () => {
  beforeEach(async () => {
    await new Promise((done) => setTimeout(done, 0));
    resetCheckoutForTests();
    useEntitlementStore.getState().clearRevenueCatState();
    await AsyncStorage.clear();
    useAppShellStore.setState({ examCountry: "PL", preferredCategory: "B", preferredLocale: "pl" });
    jest.mocked(purchaseRevenueCatPackage).mockReset();
    jest.mocked(restoreRevenueCatPurchases).mockReset();
    jest.mocked(fetchRevenueCatAccessSnapshot).mockReset().mockResolvedValue(snapshot());
  });

  it("retains CTA/config origins through refreshed native package, restart and access confirmation", async () => {
    const { original, nativeOffer, attempt } = await nativeUnknown();
    const [saved] = await readCheckoutJournal(APP_USER_ID);
    expect(saved.attempt.package.price).toBe(59.99);
    expect(saved.properties).toMatchObject({
      checkout_origin_price: 49.99, checkout_origin_product_id: "premium-P3M",
      checkout_origin_plan: "quarter", checkout_origin_trial_eligibility: "eligible",
      checkout_origin_trial_eligibility_request_id: "eligibility-a",
      paywall_origin_country: "PL", paywall_origin_offer: "plans", paywall_origin_default_plan: "quarter",
    });
    const nativeStart = original.track.mock.calls.find(([name]) => name === "purchase_started")?.[1];
    expect(nativeStart).toMatchObject({ price: 59.99, product_id: nativeOffer.productIdentifier, checkout_origin_price: 49.99 });
    expect(original.track.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining([
      "purchase_stage_changed", "purchase_started", "purchase_outcome_unknown",
      "purchase_status_check_started", "purchase_status_check_completed",
    ]));
    for (const [name, payload] of original.track.mock.calls) {
      expect(validateAnalyticsPayload(name, payload).analytics_payload_valid).toBe(true);
    }

    resetCheckoutForTests();
    useAppShellStore.setState({ examCountry: "CZ", preferredCategory: "A", preferredLocale: "en" });
    const resumed = { appUserId: APP_USER_ID, track: jest.fn(), captureError: jest.fn() };
    await hydrateCheckoutJournal(resumed);
    const recovered = resumed.track.mock.calls.find(([name]) => name === "purchase_attempt_recovered")?.[1];
    expect(recovered).toMatchObject({
      purchase_attempt_id: attempt.id, checkout_view_id: "view-a", resumed_after_restart: true,
      checkout_origin_exam_country: "PL", checkout_origin_plan: "quarter",
      paywall_origin_country: "PL", paywall_origin_offer: "plans", price: 59.99,
    });
    reconcileCheckoutAccess(APP_USER_ID, snapshot(true, nativeOffer.productIdentifier));
    const confirmed = resumed.track.mock.calls.find(([name]) => name === "purchase_access_confirmed")?.[1];
    expect(confirmed).toMatchObject({ checkout_origin_price: 49.99, paywall_origin_country: "PL", price: 59.99 });
    expect(resumed.track.mock.calls.some(([name]) => name === "purchase_succeeded")).toBe(false);
    expect(PurchasesCalled()).toBe(1);
    await expect(readCheckoutJournal(APP_USER_ID)).resolves.toEqual([]);
  });

  it("gives a retry its own origin and never overwrites the original uncertain attempt after cancellation", async () => {
    const { attempt } = await nativeUnknown();
    await refreshCheckoutAccess(APP_USER_ID, "manual");
    const retry = input("month", "view-b");
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (request) => {
      await request.onStage?.("purchase_package", retry.selectedPackage);
      request.onNativePurchaseStart?.();
      throw { code: "1" };
    });
    const result = await startCheckoutPurchase({ ...retry, confirmedRetryAttemptId: attempt.id });
    expect(result?.status).toBe("cancelled");
    expect(useCheckoutStore.getState().attempt?.id).toBe(attempt.id);
    expect(retry.track.mock.calls.find(([name]) => name === "purchase_cancelled")?.[1]).toMatchObject({
      retry_of_attempt_id: attempt.id, checkout_view_id: "view-b",
      checkout_origin_plan: "month", checkout_origin_subscription_period: "P1M",
    });
    const [saved] = await readCheckoutJournal(APP_USER_ID);
    expect(saved.attempt.id).toBe(attempt.id);
    expect(saved.properties.checkout_origin_plan).toBe("quarter");
    expect(PurchasesCalled()).toBe(2);
  });

  it("does not invent origins for an old v1 journal using current configuration", async () => {
    const legacy: CheckoutJournalRecord = {
      attempt: {
        id: "legacy-attempt", appUserId: APP_USER_ID, kind: "purchase", originViewId: "old-view",
        status: "outcome_unknown", stage: "purchase_package", package: analyticsOffer(),
        errorKind: "unknown", errorCode: null, errorMessage: null, transactionId: null, retryOfAttemptId: null,
      },
      properties: { source: "paywall" }, startedAt: Date.now() - 1000, savedAt: Date.now(),
      nativePurchaseCompleted: false, activeMs: 0, backgroundMs: 0, inactiveMs: 0, unobservedMs: 0,
    };
    await writeCheckoutJournal(APP_USER_ID, [legacy]);
    const resumed = { appUserId: APP_USER_ID, track: jest.fn(), captureError: jest.fn() };
    await hydrateCheckoutJournal(resumed);
    const recovered = resumed.track.mock.calls[0][1];
    expect(recovered.checkout_origin_version).toBeUndefined();
    expect(recovered.paywall_origin_version).toBeUndefined();
    expect(PurchasesCalled()).toBe(0);
  });

  it.each(["CZ", "SK"] as const)("preserves %s lifetime origin through journal recovery after country switch", async (country) => {
    useAppShellStore.setState({ examCountry: country, preferredLocale: country === "CZ" ? "cs" : "sk" });
    const lifetime = {
      ...analyticsOffer(), identifier: "$rc_lifetime", productIdentifier: "premium-lifetime",
      packageType: "LIFETIME", subscriptionPeriod: null, freeTrialDays: null,
    };
    const original = {
      ...input(), selectedPackage: lifetime, selectPackage: () => lifetime,
      properties: {
        ...createPaywallOriginSnapshot({
          variant: "legacy", offer: "lifetime", default_plan: null, config_version: 1,
          country, category: "B", locale: country === "CZ" ? "cs" : "sk",
          monetization_version: 2, presentation: "modal",
        }),
        ...getPackageAnalyticsSnapshot(lifetime), source: "profile",
      },
    };
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (request) => {
      await request.onStage?.("purchase_package", lifetime);
      request.onNativePurchaseStart?.();
      throw { code: "2" };
    });
    const attempt = await startCheckoutPurchase(original);
    expect(attempt?.status).toBe("outcome_unknown");
    const [saved] = await readCheckoutJournal(APP_USER_ID);
    expect(saved.properties).toMatchObject({
      paywall_origin_offer: "lifetime", paywall_origin_country: country,
      checkout_origin_exam_country: country, checkout_origin_product_id: "premium-lifetime",
      checkout_origin_subscription_period: null, checkout_origin_plan: null,
    });
    resetCheckoutForTests();
    useAppShellStore.setState({ examCountry: "PL", preferredLocale: "pl" });
    const resumed = { appUserId: APP_USER_ID, track: jest.fn(), captureError: jest.fn() };
    await hydrateCheckoutJournal(resumed);
    const recovered = resumed.track.mock.calls.find(([name]) => name === "purchase_attempt_recovered")?.[1];
    expect(recovered).toMatchObject({
      purchase_attempt_id: attempt?.id, paywall_origin_offer: "lifetime", paywall_origin_country: country,
      checkout_origin_exam_country: country, subscription_period: null, product_id: "premium-lifetime",
    });
    expect(PurchasesCalled()).toBe(1);
    for (const [name, payload] of [...original.track.mock.calls, ...resumed.track.mock.calls]) {
      expect(validateAnalyticsPayload(name, payload).analytics_payload_valid).toBe(true);
    }
  });

  it("observes restore input without inventing a selected purchase or paywall view", async () => {
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValue(snapshot(true, "existing-lifetime"));
    const track = jest.fn();
    const attempt = await startCheckoutRestore({
      appUserId: APP_USER_ID, originViewId: "access-view", track, captureError: jest.fn(),
      properties: { source: "access_center" },
    });
    expect(attempt?.status).toBe("succeeded");
    const restored = track.mock.calls.find(([name]) => name === "purchase_restore_succeeded")?.[1];
    expect(restored).toMatchObject({
      checkout_origin_basis: "checkout_input_without_selected_package",
      checkout_origin_source: "access_center", checkout_origin_product_id: null,
      checkout_view_id: "access-view", paywall_view_id: null,
    });
    expect(restored.paywall_origin_version).toBeUndefined();
    expect(restoreRevenueCatPurchases).toHaveBeenCalledTimes(1);
    expect(PurchasesCalled()).toBe(0);
    expect(track.mock.calls.some(([name]) => name === "purchase_succeeded")).toBe(false);
    for (const [name, payload] of track.mock.calls) {
      expect(validateAnalyticsPayload(name, payload).analytics_payload_valid).toBe(true);
    }
  });
});

function PurchasesCalled() {
  return jest.mocked(purchaseRevenueCatPackage).mock.calls.length;
}
