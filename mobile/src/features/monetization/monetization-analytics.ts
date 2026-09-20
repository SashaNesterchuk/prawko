import { pickRecommendedPackage } from "../entitlements/revenuecat";
import { useEntitlementStore } from "../../state/entitlements";
import { useQuestionProgressStore } from "../../state/question-progress";
import { getMonetizationAnalyticsSnapshot } from "./monetization-store";

export function getMonetizationOfferSnapshot() {
  const selectedPackage = pickRecommendedPackage(
    useEntitlementStore.getState().revenueCatOfferings
  );

  return {
    currency: selectedPackage?.currencyCode ?? null,
    offering_id: selectedPackage?.offeringIdentifier ?? null,
    price: selectedPackage?.price ?? null,
    price_string: selectedPackage?.priceString ?? null,
    product_id: selectedPackage?.productIdentifier ?? null,
  };
}

export function getMonetizationContextProperties() {
  const questionsAnswered =
    useQuestionProgressStore.getState().attempts.length;

  return {
    ...getMonetizationAnalyticsSnapshot(questionsAnswered),
    ...getMonetizationOfferSnapshot(),
  };
}
