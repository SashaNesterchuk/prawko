import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RevenueCatPackageSummary } from "../../../state/entitlements";
import {
  isCheckoutJournalStorageKey,
  journalContext,
  readCheckoutJournal,
  writeCheckoutJournal,
  type CheckoutJournalRecord,
} from "../checkout-journal";

const APP_USER_ID = "user-journal";

function offer(productIdentifier = "com.prawko.yearly"): RevenueCatPackageSummary {
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

function record(productIdentifier = "com.prawko.yearly"): CheckoutJournalRecord {
  return {
    attempt: {
      id: "attempt-1",
      appUserId: APP_USER_ID,
      kind: "purchase",
      originViewId: "view-1",
      status: "purchasing",
      stage: "purchase_package",
      package: offer(productIdentifier),
      errorKind: null,
      errorCode: null,
      errorMessage: "must not survive a restart",
      transactionId: null,
      retryOfAttemptId: null,
    },
    properties: {
      source: "paywall",
      surface: "home",
      receipt: "secret-receipt",
      note: "x".repeat(1025),
    },
    startedAt: 1_700_000_000_000,
    savedAt: 1_700_000_000_500,
    nativePurchaseCompleted: false,
    activeMs: 10,
    backgroundMs: 0,
    inactiveMs: 0,
    unobservedMs: 0,
  };
}

describe("checkout journal", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("round-trips an unresolved purchase and drops receipts and error text", async () => {
    await writeCheckoutJournal(APP_USER_ID, [record()]);

    const [restored] = await readCheckoutJournal(APP_USER_ID);

    expect(restored?.attempt.id).toBe("attempt-1");
    expect(restored?.attempt.package.productIdentifier).toBe("com.prawko.yearly");
    expect(restored?.attempt.package.title).toBe("");
    expect(restored?.attempt.errorMessage).toBeNull();
    expect(restored?.properties).toEqual({ source: "paywall", surface: "home" });
  });

  it("treats a missing journal as empty", async () => {
    await expect(readCheckoutJournal(APP_USER_ID)).resolves.toEqual([]);
  });

  it("refuses a corrupt journal instead of treating it as no purchase", async () => {
    await AsyncStorage.setItem(`prawko.checkout.v1:ios:${APP_USER_ID}`, "{");

    await expect(readCheckoutJournal(APP_USER_ID)).rejects.toThrow();
  });

  it("refuses an unsupported journal version", async () => {
    await AsyncStorage.setItem(
      `prawko.checkout.v1:ios:${APP_USER_ID}`,
      JSON.stringify({ version: 2, appUserId: APP_USER_ID, attempts: [] })
    );

    await expect(readCheckoutJournal(APP_USER_ID)).rejects.toThrow(
      "Unsupported or mismatched checkout journal."
    );
  });

  it("refuses duplicate attempt ids", async () => {
    const first = record();
    await writeCheckoutJournal(APP_USER_ID, [first, { ...first, savedAt: first.savedAt + 1 }]);

    await expect(readCheckoutJournal(APP_USER_ID)).rejects.toThrow(
      "Duplicate attempt in checkout journal."
    );
  });

  it("keeps only short scalar paywall context", () => {
    expect(journalContext(record().properties)).toEqual({
      source: "paywall",
      surface: "home",
    });
    expect(isCheckoutJournalStorageKey("prawko.checkout.v1:ios:user")).toBe(true);
    expect(isCheckoutJournalStorageKey("prawko.question-progress")).toBe(false);
  });

  it("preserves the immutable billing model and period for recovery", async () => {
    const saved = record();
    saved.properties = {
      ...saved.properties, plan: "quarter", paywall_variant: "paywall2",
      paywall_offer: "plans", trial_days: 3, trial_eligibility: "eligible", trial_shown: true,
    };
    saved.attempt.package.subscriptionPeriod = "P3M";
    saved.attempt.package.freeTrialDays = 3;
    await writeCheckoutJournal(APP_USER_ID, [saved]);
    const [restored] = await readCheckoutJournal(APP_USER_ID);
    expect(restored.properties).toMatchObject({
      plan: "quarter", paywall_offer: "plans", trial_days: 3, trial_eligibility: "eligible",
    });
    expect(restored.attempt.package.subscriptionPeriod).toBe("P3M");
    expect(restored.attempt.package.freeTrialDays).toBe(3);
  });

  it("still reads older v1 journals without optional analytics metadata", async () => {
    const saved = record();
    const { subscriptionPeriod: _period, freeTrialDays: _trial, ...legacyPackage } = saved.attempt.package;
    await AsyncStorage.setItem(`prawko.checkout.v1:ios:${APP_USER_ID}`, JSON.stringify({
      version: 1, appUserId: APP_USER_ID,
      attempts: [{ ...saved, attempt: { ...saved.attempt, package: legacyPackage } }],
    }));
    const [restored] = await readCheckoutJournal(APP_USER_ID);
    expect(restored.attempt.package.subscriptionPeriod).toBeNull();
    expect(restored.attempt.package.freeTrialDays).toBeNull();
  });
});
