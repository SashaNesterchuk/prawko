import AsyncStorage from "@react-native-async-storage/async-storage";

import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import {
  createEmptyFeatureEntitlements,
  useEntitlementStore,
  type RevenueCatPackageSummary,
} from "../../../state/entitlements";
import {
  hydrateCheckoutJournal,
  reconcileCheckoutAccess,
  resetCheckoutForTests,
  startCheckoutPurchase,
  startCheckoutRestore,
  useCheckoutStore,
} from "../checkout";
import { writeCheckoutJournal, type CheckoutJournalRecord } from "../checkout-journal";
import {
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatSnapshot,
} from "../revenuecat";

jest.mock("../../../identity/app-user-id", () => ({
  createAppUserId: () => "usr_test-checkout",
}));

jest.mock("../revenuecat", () => ({
  purchaseRevenueCatPackage: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
  fetchRevenueCatAccessSnapshot: jest.fn(),
  fetchRevenueCatSnapshot: jest.fn(),
  getRevenueCatDiagnostic: jest.fn(() => ({})),
  getRevenueCatErrorCode: jest.fn((error: { code?: string } | null) => error?.code ?? null),
  getRevenueCatErrorMessage: jest.fn(() => "Could not read purchase recovery state."),
  getRevenueCatWhy: jest.fn(() => "unknown"),
}));

const APP_USER_ID = "user-checkout";
const YEARLY = "com.prawko.yearly";
const YEARLY_PLAN = "com.prawko.yearly:p1y";

function offer(productIdentifier: string): RevenueCatPackageSummary {
  return {
    identifier: "$rc_annual",
    offeringIdentifier: "default",
    productIdentifier,
    packageType: "ANNUAL",
    price: 49.99,
    currencyCode: "PLN",
    title: "Plus",
    description: "Yearly",
    priceString: "49,99 zł",
    pricePerMonthString: null,
    pricePerWeekString: null,
    pricePerYearString: "49,99 zł",
    subscriptionPeriod: "P1Y",
  };
}

function purchasingRecord(productIdentifier: string): CheckoutJournalRecord {
  return {
    attempt: {
      id: "attempt-yearly",
      appUserId: APP_USER_ID,
      kind: "purchase",
      originViewId: "view-1",
      status: "purchasing",
      stage: "purchase_package",
      package: offer(productIdentifier),
      errorKind: null,
      errorCode: null,
      errorMessage: null,
      transactionId: null,
      retryOfAttemptId: null,
    },
    properties: { source: "paywall", surface: "home" },
    startedAt: 1_700_000_000_000,
    savedAt: 1_700_000_000_500,
    nativePurchaseCompleted: false,
    activeMs: 20,
    backgroundMs: 0,
    inactiveMs: 0,
    unobservedMs: 0,
  };
}

function snapshot(
  productIdentifiers: string[],
  access: boolean,
  requestDate: string
): RevenueCatSnapshot {
  return {
    featureEntitlements: {
      ...createEmptyFeatureEntitlements(),
      premium_access: access,
    },
    customerInfoRequestDate: requestDate,
    activeProductIdentifiers: productIdentifiers,
    isConfigured: true,
    offerings: [],
    offeringsError: null,
    purchaseAccess: access
      ? {
          activeEntitlementIds: ["premium"],
          latestExpirationDate: null,
          managementUrl: null,
          originalAppUserId: APP_USER_ID,
        }
      : null,
  };
}

function telemetry() {
  return {
    appUserId: APP_USER_ID,
    originViewId: "view-1",
    properties: { source: "paywall" },
    track: jest.fn(),
    captureError: jest.fn(),
  };
}

async function flushJournalWrites() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("checkout recovery", () => {
  beforeEach(async () => {
    resetCheckoutForTests();
    useEntitlementStore.getState().clearRevenueCatState();
    await AsyncStorage.clear();
    jest.mocked(purchaseRevenueCatPackage).mockReset();
    jest.mocked(restoreRevenueCatPurchases).mockReset();
  });

  it("turns an interrupted journal into an unknown outcome without starting a purchase", async () => {
    const input = telemetry();
    await writeCheckoutJournal(APP_USER_ID, [purchasingRecord(YEARLY)]);

    await hydrateCheckoutJournal(input);

    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().attempt).toMatchObject({
      id: "attempt-yearly",
      status: "outcome_unknown",
      errorCode: "checkout_interrupted",
    });
    expect(input.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchaseAttemptRecovered.key,
      expect.objectContaining({ previous_status: "purchasing" })
    );
  });

  it("does not confirm a purchase when access belongs to a different product", async () => {
    const input = telemetry();
    await writeCheckoutJournal(APP_USER_ID, [purchasingRecord(YEARLY_PLAN)]);
    await hydrateCheckoutJournal(input);

    reconcileCheckoutAccess(
      APP_USER_ID,
      snapshot(["com.prawko.monthly"], true, "2026-10-01T18:00:00.000Z")
    );

    expect(useCheckoutStore.getState().attempt?.status).toBe("outcome_unknown");
    expect(input.track).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchaseAccessConfirmed.key,
      expect.anything()
    );
    expect(input.track).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchaseSucceeded.key,
      expect.anything()
    );
  });

  it("confirms the recovered attempt when the Android base plan matches", async () => {
    const input = telemetry();
    await writeCheckoutJournal(APP_USER_ID, [purchasingRecord(YEARLY_PLAN)]);
    await hydrateCheckoutJournal(input);

    reconcileCheckoutAccess(
      APP_USER_ID,
      snapshot([YEARLY, YEARLY_PLAN], true, "2026-10-01T18:01:00.000Z")
    );
    await flushJournalWrites();

    expect(useCheckoutStore.getState().attempt?.status).toBe("succeeded");
    expect(input.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchaseAccessConfirmed.key,
      expect.objectContaining({
        purchase_attempt_id: "attempt-yearly",
        product_identifier: YEARLY_PLAN,
      })
    );
    expect(input.track).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchaseSucceeded.key,
      expect.anything()
    );
    await expect(readRemaining(APP_USER_ID)).resolves.toEqual([]);
  });

  it("does not report a different product's access as success for the unresolved attempt", async () => {
    const input = telemetry();
    await writeCheckoutJournal(APP_USER_ID, [purchasingRecord(YEARLY_PLAN)]);
    await hydrateCheckoutJournal(input);
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValue(
      snapshot(["com.prawko.monthly"], true, "2026-10-01T18:02:00.000Z")
    );

    const result = await startCheckoutRestore(input);

    expect(result?.status).toBe("outcome_unknown");
    expect(useCheckoutStore.getState().attempt?.status).toBe("outcome_unknown");
    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
  });

  it("blocks a new purchase when the journal cannot be read", async () => {
    await AsyncStorage.setItem(`prawko.checkout.v1:ios:${APP_USER_ID}`, "{");
    const input = telemetry();

    const result = await startCheckoutPurchase({
      ...input,
      selectedPackage: offer(YEARLY),
      selectPackage: () => offer(YEARLY),
    });

    expect(result).toMatchObject({
      status: "failed",
      errorKind: "local_storage",
      errorCode: "checkout_storage_error",
    });
    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
    expect(input.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.purchasePreparationFailed.key,
      expect.objectContaining({ error_category: "local_storage" })
    );
  });
});

function readRemaining(appUserId: string) {
  return import("../checkout-journal").then((journal) => journal.readCheckoutJournal(appUserId));
}
