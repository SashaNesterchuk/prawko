import {
  createEmptyFeatureEntitlements,
  hasGrantedPlusAccess,
  useEntitlementStore,
} from "../entitlements";

describe("RevenueCat entitlement store", () => {
  beforeEach(() => {
    useEntitlementStore.getState().clearRevenueCatState();
  });

  it("does not mark the SDK unconfigured after a hydration failure", () => {
    const store = useEntitlementStore.getState();

    store.beginRevenueCatHydration();
    store.markRevenueCatHydrationFailed("35");

    const next = useEntitlementStore.getState();

    expect(next.revenueCatConfigured).toBe(true);
    expect(next.revenueCatHydrationError).toBe("35");
    expect(next.revenueCatStatus).toBe("ready");
    expect(next.revenueCatOfferings).toEqual([]);
  });

  it("keeps previously loaded offerings if a later refresh fails", () => {
    const offering = {
      description: "Yearly",
      identifier: "$rc_annual",
      offeringIdentifier: "default",
      packageType: "ANNUAL",
      price: 24.99,
      pricePerMonthString: "2,08 zł",
      pricePerWeekString: null,
      pricePerYearString: "24,99 zł",
      priceString: "24,99 zł",
      productIdentifier: "prawko_plus_yearly",
      subscriptionPeriod: "P1Y",
      title: "Yearly",
    };

    useEntitlementStore.getState().hydrateRevenueCatSnapshot({
      featureEntitlements: createEmptyFeatureEntitlements(),
      isConfigured: true,
      offerings: [offering],
      purchaseAccess: null,
    });

    useEntitlementStore.getState().beginRevenueCatHydration();
    useEntitlementStore.getState().markRevenueCatHydrationFailed("35");

    const next = useEntitlementStore.getState();

    expect(next.revenueCatConfigured).toBe(true);
    expect(next.revenueCatOfferings).toEqual([offering]);
    expect(next.revenueCatHydrationError).toBe("35");
  });

  it("keeps Plus entitlements when a snapshot has an offerings error", () => {
    const entitlements = createEmptyFeatureEntitlements();
    entitlements.premium_access = true;

    useEntitlementStore.getState().hydrateRevenueCatSnapshot({
      featureEntitlements: entitlements,
      isConfigured: true,
      offerings: [],
      offeringsError: "35",
      purchaseAccess: {
        activeEntitlementIds: ["premium"],
        latestExpirationDate: null,
        managementUrl: null,
        originalAppUserId: "usr_test",
      },
    });

    const next = useEntitlementStore.getState();

    expect(next.revenueCatConfigured).toBe(true);
    expect(next.revenueCatHydrationError).toBe("35");
    expect(next.revenueCatFeatureEntitlements.premium_access).toBe(true);
    expect(next.purchaseAccess?.activeEntitlementIds).toEqual(["premium"]);
  });

  it("clears hydration errors after a successful snapshot", () => {
    useEntitlementStore.getState().markRevenueCatHydrationFailed("35");
    useEntitlementStore.getState().hydrateRevenueCatSnapshot({
      featureEntitlements: createEmptyFeatureEntitlements(),
      isConfigured: true,
      offerings: [],
      purchaseAccess: null,
    });

    expect(useEntitlementStore.getState().revenueCatHydrationError).toBeNull();
  });
});

describe("hasGrantedPlusAccess", () => {
  it("counts a school or remote premium grant as Plus", () => {
    const empty = createEmptyFeatureEntitlements();
    const remote = { ...empty, premium_access: true };

    expect(hasGrantedPlusAccess(empty, remote)).toBe(true);
    expect(hasGrantedPlusAccess(empty, empty)).toBe(false);
  });
});
