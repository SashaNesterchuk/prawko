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
export function resolveSignsSummaryDisplay({
  correct,
  wrong,
  seen,
  total,
}: SignsSummaryDisplayInput): SignsSummaryDisplay {
  const safeSeen = Math.max(seen, correct + wrong, 0);
  const safeTotal = Math.max(total, 0);
  const learnedPercent =
    safeTotal > 0 ? Math.round((safeSeen / safeTotal) * 100) : 0;

  return {
    learnedPercent: Math.min(learnedPercent, 100),
    coverageLabel: `${safeSeen} / ${safeTotal}`,
    correctAnswersLabel: `${Math.max(correct, 0)} / ${safeSeen}`,
  };
}
