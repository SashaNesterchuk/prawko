import Purchases, { type PurchasesOfferings } from "react-native-purchases";
import { fetchRevenueCatOfferings, resetRevenueCatClientForTests } from "../revenuecat";
import { useEntitlementStore } from "../../../state/entitlements";

jest.mock("../../../config/env", () => ({ mobileEnv: {
  revenueCatAppleApiKey: "synthetic-ios-key", revenueCatGoogleApiKey: "synthetic-android-key",
  revenueCatEnableInDev: true, enableE2ETestMode: false,
} }));
jest.mock("../../../lib/auth-storage", () => ({ secureSessionStorage: {} }));
jest.mock("react-native-purchases-ui", () => ({ PAYWALL_RESULT: {} }));
jest.mock("react-native-purchases", () => ({ __esModule: true, default: {
  configure: jest.fn(), logIn: jest.fn(),
  enableAdServicesAttributionTokenCollection: jest.fn(async () => undefined),
  getOfferings: jest.fn(), syncAttributesAndOfferingsIfNeeded: jest.fn(),
} }));

function offerings(subscription = false): PurchasesOfferings {
  const pkg = {
    identifier: subscription ? "$rc_monthly" : "$rc_lifetime",
    packageType: subscription ? "MONTHLY" : "LIFETIME",
    presentedOfferingContext: { offeringIdentifier: "default" },
    product: {
      identifier: subscription ? "pl.prawko.premium.monthly" : "com.prawko.lifetime",
      subscriptionPeriod: subscription ? "P1M" : null,
      currencyCode: "PLN", description: "", title: "Premium", price: 29.99,
      priceString: "29,99 zł", introPrice: null,
      pricePerMonthString: null, pricePerWeekString: null, pricePerYearString: null,
    },
  };
  const current = { identifier: "default", availablePackages: [pkg] };
  return { current, all: { default: current } } as unknown as PurchasesOfferings;
}
const recovery = { recoverMissingPlans: true };
beforeEach(() => {
  jest.clearAllMocks(); resetRevenueCatClientForTests();
  useEntitlementStore.getState().clearRevenueCatState();
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings());
  jest.mocked(Purchases.syncAttributesAndOfferingsIfNeeded).mockResolvedValue(offerings(true));
});
afterEach(() => { jest.useRealTimers(); });

it("recovers a lifetime-only SDK cache through the fresh SDK response", async () => {
  // Ordinary getOfferings continues returning the old native SDK cache.
  const result = await fetchRevenueCatOfferings("usr_test", "paywall_open", recovery);
  expect(result[0].productIdentifier).toBe("pl.prawko.premium.monthly");
  expect(useEntitlementStore.getState().revenueCatOfferings).toEqual(result);
  expect(useEntitlementStore.getState().revenueCatOfferingsLoad?.status).toBe("ready");
  expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalledTimes(1);
});
it("does not force refresh when a PL subscription is already returned", async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings(true));
  await fetchRevenueCatOfferings("usr_test", "paywall_open", recovery);
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).not.toHaveBeenCalled();
});
it("keeps the ordinary lifetime request unchanged without PL recovery", async () => {
  const result = await fetchRevenueCatOfferings("usr_test", "paywall_open");
  expect(result[0].productIdentifier).toBe("com.prawko.lifetime");
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).not.toHaveBeenCalled();
});
it("does not loop if even the fresh response has no supported plans", async () => {
  jest.mocked(Purchases.syncAttributesAndOfferingsIfNeeded).mockResolvedValue(offerings());
  const result = await fetchRevenueCatOfferings("usr_test", "paywall_open", recovery);
  expect(result[0].subscriptionPeriod).toBeNull();
  expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalledTimes(1);
});
it("upgrades a shared in-flight request to PL recovery without duplicate requests", async () => {
  let resolveCached!: (value: PurchasesOfferings) => void;
  jest.mocked(Purchases.getOfferings).mockReturnValue(new Promise((resolve) => { resolveCached = resolve; }));
  const plain = fetchRevenueCatOfferings("usr_test", "paywall_open");
  const plans = fetchRevenueCatOfferings("usr_test", "paywall_open", recovery);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  resolveCached(offerings());
  const [first, second] = await Promise.all([plain, plans]);
  expect(first).toEqual(second);
  expect(second[0].subscriptionPeriod).toBe("P1M");
  expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalledTimes(1);
});
it("bounds cached and fresh loading by the existing total timeout", async () => {
  jest.useFakeTimers();
  jest.mocked(Purchases.syncAttributesAndOfferingsIfNeeded).mockReturnValue(new Promise(() => {}));
  const pending = fetchRevenueCatOfferings("usr_test", "paywall_open", recovery);
  const rejection = expect(pending).rejects.toMatchObject({ code: "store_request_timeout" });
  await jest.advanceTimersByTimeAsync(20_001);
  await rejection;
  expect(useEntitlementStore.getState().revenueCatOfferingsLoad?.status).toBe("failed");
  expect(Purchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalledTimes(1);
});
