/** Preset sizes offered when the pool is large enough to make them meaningful. */
export const QUESTION_COUNT_PRESETS = [10, 20, 40] as const;

export const DEFAULT_QUESTION_COUNT = 20;

export type QuestionCountSelection = number | "all";

/**
 * Build count choices for a pool of `totalCount` questions.
 * Presets only appear when they are strictly smaller than the full pool
 * (otherwise they duplicate "all"). "all" is always included when there is
 * at least one question.
 */
export function getQuestionCountOptions(
  totalCount: number
): QuestionCountSelection[] {
  if (totalCount <= 0) {
    return [];
  }

  const presets = QUESTION_COUNT_PRESETS.filter(
    (preset) => preset < totalCount
  );

  return [...presets, "all"];
}

/** Prefer the default preset when it is a real choice; otherwise take all. */
export function getDefaultQuestionCount(
  totalCount: number
): QuestionCountSelection {
  const options = getQuestionCountOptions(totalCount);

  if (options.includes(DEFAULT_QUESTION_COUNT)) {
    return DEFAULT_QUESTION_COUNT;
  }

  return "all";
}

/**
 * Show the picker only when the user has more than one meaningful choice
 * (at least one preset plus "all"). For tiny pools, start immediately.
 */
export function shouldShowQuestionCountDialog(totalCount: number): boolean {
  return getQuestionCountOptions(totalCount).length > 1;
}

export function resolveQuestionCountDialog(
  totalCount: number
): {
  shouldShowDialog: boolean;
  defaultCount: QuestionCountSelection;
  options: QuestionCountSelection[];
} {
  const options = getQuestionCountOptions(totalCount);

  return {
    shouldShowDialog: options.length > 1,
    defaultCount: getDefaultQuestionCount(totalCount),
    options,
  };
}

export function toQuestionLimit(
  selectedCount: QuestionCountSelection
): number | null {
  return selectedCount === "all" ? null : selectedCount;
}
