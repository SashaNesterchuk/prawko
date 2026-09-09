import { getPaywallOfferHelperKind } from "../paywall-offer-helper";

describe("getPaywallOfferHelperKind", () => {
  const base = {
    hasPlusAccess: false,
    hydrationError: null as string | null,
    isPurchasing: false,
    offeringsCount: 0,
    plusPurchaseEnabled: true,
    revenueCatStatus: "ready" as const,
    sdkConfigured: true,
  };

  it("does not treat a fetch failure as a missing SDK config", () => {
    expect(
      getPaywallOfferHelperKind({
        ...base,
        hydrationError: "35",
      })
    ).toBe("hydration_failed");
  });

  it("keeps missing-config for builds without an API key", () => {
    expect(
      getPaywallOfferHelperKind({
        ...base,
        sdkConfigured: false,
      })
    ).toBe("missing_config");
  });

  it("shows loading while a retry is in flight", () => {
    expect(
      getPaywallOfferHelperKind({
        ...base,
        hydrationError: "35",
        revenueCatStatus: "loading",
      })
    ).toBe("offers_loading");
  });

  it("shows no-offers when hydration succeeded with an empty catalog", () => {
    expect(getPaywallOfferHelperKind(base)).toBe("no_offers");
  });
});
