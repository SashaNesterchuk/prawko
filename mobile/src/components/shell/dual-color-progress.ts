export type DualColorProgressInput = {
  correct: number;
  wrong: number;
  total: number;
};

export type DualColorProgressSegments = {
  wrongPercent: number;
  correctPercent: number;
  filledPercent: number;
  accessibilityText: string;
};

export function resolveDualColorProgressSegments({
  correct,
  wrong,
  total,
}: DualColorProgressInput): DualColorProgressSegments {
  const safeTotal = Math.max(total, 0);
  const wrongPercent =
    safeTotal > 0 ? Math.min((Math.max(wrong, 0) / safeTotal) * 100, 100) : 0;
  const correctPercent =
    safeTotal > 0
      ? Math.min((Math.max(correct, 0) / safeTotal) * 100, 100 - wrongPercent)
      : 0;
  const filledPercent = Math.min(wrongPercent + correctPercent, 100);

  return {
    wrongPercent,
    correctPercent,
    filledPercent,
    accessibilityText: `${Math.round(correctPercent)}% correct, ${Math.round(wrongPercent)}% wrong`,
  };
}
