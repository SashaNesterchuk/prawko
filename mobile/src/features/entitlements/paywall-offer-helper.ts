export type PaywallOfferHelperKind =
  | "purchase_unavailable"
  | "purchase_loading"
  | "offers_loading"
  | "missing_config"
  | "hydration_failed"
  | "no_offers";

type PaywallOfferHelperInput = {
  hasPlusAccess: boolean;
  hydrationError: string | null;
  isPurchasing: boolean;
  offeringsCount: number;
  plusPurchaseEnabled: boolean;
  revenueCatStatus: "idle" | "loading" | "ready";
  sdkConfigured: boolean;
};

export function getPaywallOfferHelperKind(
  input: PaywallOfferHelperInput
): PaywallOfferHelperKind | null {
  if (input.hasPlusAccess) {
    return null;
  }

  if (!input.plusPurchaseEnabled) {
    return "purchase_unavailable";
  }

  if (input.isPurchasing) {
    return "purchase_loading";
  }

  if (!input.sdkConfigured) {
    return "missing_config";
  }

  if (input.offeringsCount > 0) {
    return null;
  }

  if (input.revenueCatStatus === "loading" || input.revenueCatStatus === "idle") {
    return "offers_loading";
  }

  if (input.hydrationError) {
    return "hydration_failed";
  }

  return "no_offers";
}
