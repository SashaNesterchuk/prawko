/**
 * RevenueCat dashboard mapping for Prawko.
 *
 * Entitlement identifier (source of truth for Plus):
 *   customerInfo.entitlements.active["premium"]
 *
 * Lifetime store product (example): com.prawko.lifetime
 * Buying lifetime activates the `premium` entitlement permanently.
 *
 * Optional subscription products on the current offering:
 * - yearly / monthly (same `premium` entitlement while active)
 *
 * Attach products → entitlement `premium` → current offering → Paywall / Customer Center.
 */
export const REVENUECAT_PRO_ENTITLEMENT_ID = "premium";

/** Normalized aliases checked against CustomerInfo.entitlements.active keys. */
export const REVENUECAT_PRO_ENTITLEMENT_ALIASES = [
  "premium",
  "premium_access",
  "plus",
  "pro",
  "full_access",
  "prawko_plus",
  "prawko plus",
  "prawko_pro",
  "prawko-pro",
  "prawko: prawo jazdy pro",
] as const;

export const REVENUECAT_PRODUCT_IDS = {
  lifetime: "lifetime",
  yearly: "yearly",
  monthly: "monthly",
} as const;

export type RevenueCatProductId =
  (typeof REVENUECAT_PRODUCT_IDS)[keyof typeof REVENUECAT_PRODUCT_IDS];

export const REVENUECAT_PACKAGE_ALIASES: Record<
  RevenueCatProductId,
  readonly string[]
> = {
  lifetime: [
    "lifetime",
    "com.prawko.lifetime",
    "$rc_lifetime",
    "LIFETIME",
  ],
  yearly: ["yearly", "annual", "$rc_annual", "ANNUAL"],
  monthly: ["monthly", "$rc_monthly", "MONTHLY"],
};

/**
 * Local and E2E runs share the production RevenueCat project. Purchases stay
 * off in dev builds until someone opts in with EXPO_PUBLIC_REVENUECAT_ENABLE_IN_DEV.
 */
export function isRevenueCatEnabledForBuild(input: {
  enableInDevBuilds: boolean;
  isDevBuild: boolean;
  isE2ETestMode: boolean;
}) {
  if (input.isE2ETestMode) {
    return false;
  }

  if (input.isDevBuild) {
    return input.enableInDevBuilds;
  }

  return true;
}

export type RevenueCatPaywallOutcome =
  | "purchased"
  | "restored"
  | "cancelled"
  | "not_presented"
  | "error";
