import type { RevenueCatPackageSummary } from "../../../state/entitlements";

export function analyticsOffer(period = "P3M", type = "THREE_MONTH"): RevenueCatPackageSummary {
  return {
    identifier: `pkg-${period}`, offeringIdentifier: "default", productIdentifier: `premium-${period}`,
    packageType: type, subscriptionPeriod: period, price: 49.99, priceString: "49.99 PLN",
    currencyCode: "PLN", title: "", description: "", freeTrialDays: 3,
    pricePerMonthString: null, pricePerWeekString: null, pricePerYearString: null,
  };
}
