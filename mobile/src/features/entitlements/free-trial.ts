import type { PurchasesIntroPrice } from "react-native-purchases";

const TRIAL_UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** Free intro period in days; null for paid intro offers or no intro offer. */
export function getFreeTrialDays(
  introPrice: Pick<PurchasesIntroPrice, "price" | "periodUnit" | "periodNumberOfUnits"> | null
) {
  if (!introPrice || introPrice.price !== 0) return null;
  const unitDays = TRIAL_UNIT_DAYS[introPrice.periodUnit.toUpperCase()];
  return unitDays ? unitDays * introPrice.periodNumberOfUnits : null;
}
