import type { RevenueCatPackageSummary } from "../../../state/entitlements";
import { getFreeTrialDays } from "../../entitlements/free-trial";
import { findPaywall2PlanPackage, pickPaywall2Plan, resolvePaywall2Plans } from "../plans";

function pkg(overrides: Partial<RevenueCatPackageSummary>): RevenueCatPackageSummary {
  return {
    currencyCode: "PLN",
    description: "",
    identifier: "$rc_custom",
    offeringIdentifier: "default",
    packageType: "CUSTOM",
    price: 0,
    pricePerMonthString: null,
    pricePerWeekString: null,
    pricePerYearString: null,
    priceString: "",
    productIdentifier: "prawko.custom",
    subscriptionPeriod: null,
    title: "",
    ...overrides,
  };
}

const week = pkg({ identifier: "$rc_weekly", packageType: "WEEKLY", priceString: "14,99 zł", subscriptionPeriod: "P1W" });
const month = pkg({ identifier: "$rc_monthly", productIdentifier: "prawko.month", packageType: "MONTHLY", priceString: "29,99 zł", subscriptionPeriod: "P1M", freeTrialDays: 3 });
const quarter = pkg({ identifier: "three_month", productIdentifier: "prawko.quarter", packageType: "CUSTOM", priceString: "49,99 zł", subscriptionPeriod: "P3M", freeTrialDays: 3 });
const lifetime = pkg({ identifier: "$rc_lifetime", packageType: "LIFETIME", priceString: "24,99 zł" });

describe("paywall2 plans", () => {
  it("matches store packages by subscription period", () => {
    const offers = [lifetime, quarter, month, week];
    expect(findPaywall2PlanPackage(offers, "week")).toBe(week);
    expect(findPaywall2PlanPackage(offers, "month")).toBe(month);
    expect(findPaywall2PlanPackage(offers, "quarter")).toBe(quarter);
  });

  const release = { preview: false, offersLoaded: true, trialIneligibleProductIds: [] };

  function plansOf(offer: ReturnType<typeof resolvePaywall2Plans>) {
    if (offer.kind !== "plans") throw new Error("expected plans");
    return offer.plans.map((plan) => [plan.id, plan.price, plan.trialDays]);
  }

  it("uses store price and trial, never the lifetime package", () => {
    expect(plansOf(resolvePaywall2Plans([lifetime, quarter, month, week], release))).toEqual([
      ["week", "14,99 zł", 0],
      ["month", "29,99 zł", 3],
      ["quarter", "49,99 zł", 3],
    ]);
  });

  it("shows only the plans the offering contains", () => {
    expect(plansOf(resolvePaywall2Plans([lifetime, month], release))).toEqual([["month", "29,99 zł", 3]]);
  });

  it("falls back to lifetime when the loaded offering has no plans", () => {
    expect(resolvePaywall2Plans([lifetime], release)).toEqual({ kind: "lifetime" });
  });

  it("keeps price placeholders while the store is loading", () => {
    const offer = resolvePaywall2Plans([], { ...release, offersLoaded: false });
    expect(offer.kind === "plans" && offer.plans.every((plan) => plan.price === null)).toBe(true);
  });

  it("hides trials the user is not eligible for or that are not confirmed yet", () => {
    const offers = [quarter, month];
    expect(plansOf(resolvePaywall2Plans(offers, { ...release, trialIneligibleProductIds: [month.productIdentifier] })))
      .toEqual([["month", "29,99 zł", 0], ["quarter", "49,99 zł", 3]]);
    expect(plansOf(resolvePaywall2Plans(offers, { ...release, trialIneligibleProductIds: null })))
      .toEqual([["month", "29,99 zł", 0], ["quarter", "49,99 zł", 0]]);
  });

  it("selects the 90-day plan by default and the closest one when it is missing", () => {
    const all = resolvePaywall2Plans([quarter, month, week], release);
    const partial = resolvePaywall2Plans([month, week], release);
    if (all.kind !== "plans" || partial.kind !== "plans") throw new Error("expected plans");
    expect(pickPaywall2Plan(all.plans, "quarter")?.id).toBe("quarter");
    expect(pickPaywall2Plan(all.plans, "week")?.id).toBe("week");
    expect(pickPaywall2Plan(partial.plans, "quarter")?.id).toBe("month");
  });
});

describe("getFreeTrialDays", () => {
  it("reads free intro periods and ignores paid intro offers", () => {
    expect(getFreeTrialDays({ price: 0, periodUnit: "DAY", periodNumberOfUnits: 3 })).toBe(3);
    expect(getFreeTrialDays({ price: 0, periodUnit: "WEEK", periodNumberOfUnits: 1 })).toBe(7);
    expect(getFreeTrialDays({ price: 4.99, periodUnit: "DAY", periodNumberOfUnits: 3 })).toBeNull();
    expect(getFreeTrialDays(null)).toBeNull();
  });
});
