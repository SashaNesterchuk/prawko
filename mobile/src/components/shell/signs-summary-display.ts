export type SignsSummaryDisplayInput = {
  correct: number;
  wrong: number;
  seen: number;
  total: number;
};

export type SignsSummaryDisplay = {
  learnedPercent: number;
  coverageLabel: string;
  correctAnswersLabel: string;
};

/**
 * Display values for the Signs summary card.
 * - Signs home (`learned`): gray bar + coverage in the footer.
 * - Statistics (`split`): dual-color bar + correct/seen in the footer.
 */
export function resolveCoveragePercent(seen: number, total: number) {
  const safeSeen = Math.max(seen, 0);
  const safeTotal = Math.max(total, 0);

  if (safeSeen <= 0 || safeTotal <= 0) {
    return 0;
  }

  // Sub-1% coverage still reads as progress, not an empty 0%.
  return Math.min(100, Math.max(1, Math.round((safeSeen / safeTotal) * 100)));
}

export function resolveSignsSummaryDisplay({
  correct,
  wrong,
  seen,
  total,
}: SignsSummaryDisplayInput): SignsSummaryDisplay {
  const safeSeen = Math.max(seen, correct + wrong, 0);
  const safeTotal = Math.max(total, 0);

  return {
    learnedPercent: resolveCoveragePercent(safeSeen, safeTotal),
    coverageLabel: `${safeSeen} / ${safeTotal}`,
    correctAnswersLabel: `${Math.max(correct, 0)} / ${safeSeen}`,
  };
}
