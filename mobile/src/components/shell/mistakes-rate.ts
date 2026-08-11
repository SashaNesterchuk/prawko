export type MistakeRateStatus = "good" | "normal" | "bad";

/** Mistake share of the pool (wrong / total), 0–100. */
export function resolveMistakeRate(wrong: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((wrong / total) * 100)));
}

/**
 * Severity for mistake-rate coloring (Figma mistakes topic rows):
 * high share → red, mid → amber, low → green.
 */
export function resolveMistakeRateStatus(rate: number): MistakeRateStatus {
  if (rate >= 30) {
    return "bad";
  }

  if (rate >= 10) {
    return "normal";
  }

  return "good";
}
