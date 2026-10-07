import type { RevenueCatPackageSummary } from "../../state/entitlements";

export type Paywall2PlanId = "week" | "month" | "quarter";

export type Paywall2Plan = {
  id: Paywall2PlanId;
  /** Localized store price; null until the store offering has loaded. */
  price: string | null;
  trialDays: number;
  package: RevenueCatPackageSummary | null;
};

export const PAYWALL2_PLAN_ORDER: readonly Paywall2PlanId[] = ["week", "month", "quarter"];
export const PAYWALL2_DEFAULT_PLAN: Paywall2PlanId = "quarter";

const PLAN_STORE_MATCH: Record<Paywall2PlanId, { period: string; packageType: string }> = {
  week: { period: "P1W", packageType: "WEEKLY" },
  month: { period: "P1M", packageType: "MONTHLY" },
  quarter: { period: "P3M", packageType: "THREE_MONTH" },
};

// Dev builds run without RevenueCat; these only preview the layout.
const DEV_PREVIEW: Record<Paywall2PlanId, { price: string; trialDays: number }> = {
  week: { price: "14,99 zł", trialDays: 0 },
  month: { price: "29,99 zł", trialDays: 3 },
  quarter: { price: "49,99 zł", trialDays: 3 },
};

export function findPaywall2PlanPackage(
  offers: RevenueCatPackageSummary[],
  id: Paywall2PlanId
): RevenueCatPackageSummary | null {
  const match = PLAN_STORE_MATCH[id];
  return (
    offers.find((item) => item.subscriptionPeriod === match.period) ??
    offers.find((item) => item.packageType === match.packageType) ??
    null
  );
}

export type Paywall2PlanOffer = { kind: "plans"; plans: Paywall2Plan[] };

/**
 * PL is subscription-only: show supported store plans, or unavailable price
 * placeholders. Empty, lifetime-only and annual-only offerings never change
 * the billing model. Other countries use the legacy lifetime paywall.
 */
export function resolvePaywall2Plans(
  offers: RevenueCatPackageSummary[],
  options: {
    preview: boolean;
    /** null while eligibility is unknown; trials stay hidden until confirmed. */
    trialIneligibleProductIds: readonly string[] | null;
  }
): Paywall2PlanOffer {
  const storePlans = PAYWALL2_PLAN_ORDER.flatMap((id): Paywall2Plan[] => {
    const pkg = findPaywall2PlanPackage(offers, id);
    if (!pkg) return [];
    const ineligible = options.trialIneligibleProductIds?.includes(pkg.productIdentifier) ?? true;
    return [{ id, package: pkg, price: pkg.priceString, trialDays: ineligible ? 0 : pkg.freeTrialDays ?? 0 }];
  });
  if (storePlans.length > 0) return { kind: "plans", plans: storePlans };
  if (options.preview && offers.length === 0) {
    return { kind: "plans", plans: PAYWALL2_PLAN_ORDER.map((id) => ({ id, package: null, ...DEV_PREVIEW[id] })) };
  }
  return {
    kind: "plans",
    plans: PAYWALL2_PLAN_ORDER.map((id) => ({ id, package: null, price: null, trialDays: 0 })),
  };
}

export function pickPaywall2Plan(plans: Paywall2Plan[], selected: Paywall2PlanId): Paywall2Plan | null {
  return (
    plans.find((plan) => plan.id === selected) ??
    plans.find((plan) => plan.id === PAYWALL2_DEFAULT_PLAN) ??
    plans[plans.length - 1] ??
    null
  );
}
