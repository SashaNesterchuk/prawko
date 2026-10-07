import type { RevenueCatPackageSummary } from "../../../state/entitlements";
import { getPaywall2PlanAnalyticsSnapshot, selectPaywall2AnalyticsPlan } from "../analytics";
import { analyticsOffer } from "../../entitlements/__tests__/offer-fixture";

describe("paywall2 analytics snapshot", () => {
  it("matches the displayed fallback plan from the current offerings", () => {
    const monthly = analyticsOffer("P1M", "MONTHLY");
    expect(selectPaywall2AnalyticsPlan([monthly], "quarter")?.package).toBe(monthly);
    expect(getPaywall2PlanAnalyticsSnapshot({
      offers: [monthly], selectedPlanId: "quarter", trialIneligibleProductIds: [],
      trialEligibilityProduct: {
        productId: monthly.productIdentifier, outcome: "eligible", basis: "revenuecat_ios_status", requestId: "request-a",
      },
    })).toMatchObject({
      plan: "month", default_plan: "quarter", product_id: monthly.productIdentifier,
      subscription_period: "P1M", trial_days: 3, trial_eligibility: "eligible", trial_shown: true,
    });
  });

  it.each([
    ["unknown", null, false], ["error", null, true], ["eligible", [], false],
    ["ineligible", ["premium-P3M"], false],
  ] as const)("distinguishes %s eligibility", (expected, ids, failed) => {
    const snapshot = getPaywall2PlanAnalyticsSnapshot({
      offers: [analyticsOffer()], selectedPlanId: "quarter",
      trialIneligibleProductIds: ids, trialEligibilityFailed: failed,
      trialEligibilityProduct: expected === "eligible" || expected === "ineligible" ? {
        productId: "premium-P3M", outcome: expected, basis: "revenuecat_ios_status", requestId: "request-a",
      } : null,
    });
    expect(snapshot.trial_eligibility).toBe(expected);
    expect(snapshot.trial_shown).toBe(expected === "eligible");
  });

  it("does not treat no intro offer as unknown eligibility", () => {
    expect(getPaywall2PlanAnalyticsSnapshot({
      offers: [{ ...analyticsOffer(), freeTrialDays: null }],
      selectedPlanId: "quarter", trialIneligibleProductIds: null,
    }).trial_eligibility).toBe("no_trial");
  });

  it("does not turn a UI filter into verified eligibility", () => {
    expect(getPaywall2PlanAnalyticsSnapshot({
      offers: [analyticsOffer()], selectedPlanId: "quarter", trialIneligibleProductIds: [],
    })).toMatchObject({
      trial_days: 3, trial_shown: true, trial_eligibility: "unknown",
      trial_eligibility_basis: "legacy_filter_only", trial_eligibility_request_id: null,
    });
  });

  it.each([[], [analyticsOffer("P1Y", "ANNUAL")], [analyticsOffer("", "LIFETIME")]])(
    "never reports an unsupported package as a usable PL subscription", (...offers) => {
      expect(selectPaywall2AnalyticsPlan(offers as RevenueCatPackageSummary[], "quarter")?.package).toBeNull();
    },
  );
});
