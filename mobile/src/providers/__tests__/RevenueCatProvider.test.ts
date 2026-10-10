import { AppState } from "react-native";
import { RevenueCatProvider } from "../RevenueCatProvider";
import { fetchRevenueCatAccessSnapshot, fetchRevenueCatSnapshot } from "../../features/entitlements/revenuecat";
import { createEmptyFeatureEntitlements, useEntitlementStore, type RevenueCatPackageSummary } from "../../state/entitlements";

const mockEffects: Array<() => void | (() => void)> = [];
let mockExamCountry = "PL";
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useEffect: (effect: () => void) => mockEffects.push(effect),
  useRef: (value: unknown) => ({ current: value }),
}));
jest.mock("../../countries/use-country", () => ({ useCountryConfig: () => jest.requireActual("@prawko/config").getCountryConfig(mockExamCountry) }));
jest.mock("../../identity/AppIdentityProvider", () => ({ useAppUserId: () => "usr_test" }));
jest.mock("../../hooks/useAnalytics", () => ({ useAnalytics: () => ({ track: jest.fn() }) }));
jest.mock("../ErrorLoggingProvider", () => ({ useErrorLogger: () => ({ captureError: jest.fn() }) }));
jest.mock("../../state/app-shell", () => ({
  useHasHydrated: () => true,
  useAppShellStore: (select: (state: unknown) => unknown) => select({ sessionResolved: true, supabaseUser: null }),
}));
jest.mock("../../state/entitlements", () => {
  const actual = jest.requireActual("../../state/entitlements");
  const store = actual.useEntitlementStore;
  return { ...actual, useEntitlementStore: Object.assign((select: (state: unknown) => unknown) => select(store.getState()), { getState: store.getState }) };
});
jest.mock("../../features/entitlements/checkout", () => ({
  hydrateCheckoutJournal: jest.fn(async () => {}), refreshCheckoutAccess: jest.fn(async () => {}),
  observeCheckoutAppState: jest.fn(), reconcileCheckoutAccess: jest.fn(),
}));
jest.mock("../../features/entitlements/revenuecat", () => ({
  fetchRevenueCatSnapshot: jest.fn(), fetchRevenueCatAccessSnapshot: jest.fn(),
  isRevenueCatConfiguredForCurrentPlatform: () => true,
  subscribeToRevenueCatCustomerInfo: jest.fn(async () => () => {}),
  syncRevenueCatSubscriberAttributes: jest.fn(async () => {}),
  getRevenueCatDiagnostic: jest.fn(), getRevenueCatErrorCode: () => "unknown", getRevenueCatWhy: () => "unknown",
}));

const lifetime: RevenueCatPackageSummary = {
  identifier: "$rc_lifetime", productIdentifier: "com.prawko.lifetime", packageType: "LIFETIME",
  offeringIdentifier: "default", subscriptionPeriod: null, price: 24.99, priceString: "24,99 zł",
  currencyCode: "PLN", title: "Lifetime", description: "", pricePerMonthString: null,
  pricePerWeekString: null, pricePerYearString: null,
};
const monthly = { ...lifetime, identifier: "$rc_monthly", packageType: "MONTHLY", subscriptionPeriod: "P1M" };
const snapshot = (offerings: RevenueCatPackageSummary[]) => ({
  isConfigured: true, featureEntitlements: createEmptyFeatureEntitlements(),
  offerings, offeringsError: null, purchaseAccess: null,
});
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let cleanups: Array<() => void> = [];
async function mount(offers: RevenueCatPackageSummary[]) {
  jest.mocked(fetchRevenueCatSnapshot).mockResolvedValue(snapshot(offers));
  jest.mocked(fetchRevenueCatAccessSnapshot).mockResolvedValue(snapshot(offers));
  RevenueCatProvider({ children: null });
  cleanups = mockEffects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
  await flush();
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockEffects.length = 0; mockExamCountry = "PL";
  useEntitlementStore.getState().clearRevenueCatState();
  (AppState as unknown as { __reset(): void }).__reset();
});
afterEach(() => { cleanups.forEach((cleanup) => cleanup()); cleanups = []; jest.useRealTimers(); });

it("refreshes PL offerings on foreground even with a lifetime-only cache", async () => {
  await mount([lifetime]);
  jest.mocked(fetchRevenueCatSnapshot).mockResolvedValue(snapshot([lifetime, monthly]));
  (AppState as unknown as { __emit(state: string): void }).__emit("active");
  await flush();
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledTimes(2);
  expect(fetchRevenueCatAccessSnapshot).not.toHaveBeenCalled();
  expect(fetchRevenueCatSnapshot).toHaveBeenLastCalledWith("usr_test", {
    forceRefresh: true, recoverMissingPlans: true,
  });
  expect(useEntitlementStore.getState().revenueCatOfferings).toContainEqual(monthly);
});
it("does not poll a successful but unsupported PL response", async () => {
  await mount([lifetime]);
  await jest.advanceTimersByTimeAsync(2_000); await flush();
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(60_000); await flush();
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledTimes(1);
});
it("keeps foreground access-only when a supported PL plan is ready", async () => {
  await mount([lifetime, monthly]);
  (AppState as unknown as { __emit(state: string): void }).__emit("active"); await flush();
  await jest.advanceTimersByTimeAsync(2_000);
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledTimes(1);
  expect(fetchRevenueCatAccessSnapshot).toHaveBeenCalledTimes(1);
});
it.each(["CZ", "SK"])("preserves %s lifetime-only readiness and foreground behavior", async (country) => {
  mockExamCountry = country;
  await mount([lifetime]);
  (AppState as unknown as { __emit(state: string): void }).__emit("active"); await flush();
  await jest.advanceTimersByTimeAsync(2_000);
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledTimes(1);
  expect(fetchRevenueCatSnapshot).toHaveBeenCalledWith("usr_test", {
    forceRefresh: false, recoverMissingPlans: false,
  });
  expect(fetchRevenueCatAccessSnapshot).toHaveBeenCalledTimes(1);
  expect(useEntitlementStore.getState().revenueCatOfferings).toEqual([lifetime]);
});
