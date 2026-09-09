import {
  matchRevenueCatProductId,
  matchesPackageAlias,
} from "../revenuecat";

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("react-native-purchases-ui", () => ({
  PAYWALL_RESULT: {
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
    CANCELLED: "CANCELLED",
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
  },
}));

describe("matchesPackageAlias", () => {
  it("matches dotted product ids without substring false positives", () => {
    expect(matchesPackageAlias("com.prawko.lifetime", "lifetime")).toBe(true);
    expect(matchesPackageAlias("$rc_annual", "$rc_annual")).toBe(true);
    expect(matchesPackageAlias("lifetime_annual_bundle", "yearly")).toBe(false);
    expect(matchesPackageAlias("lifetime_annual_bundle", "annual")).toBe(true);
  });
});

describe("matchRevenueCatProductId", () => {
  it("maps StoreKit-style yearly products", () => {
    expect(
      matchRevenueCatProductId({
        identifier: "$rc_annual",
        packageType: "ANNUAL",
        productIdentifier: "com.prawko.yearly",
      })
    ).toBe("yearly");
  });
});
