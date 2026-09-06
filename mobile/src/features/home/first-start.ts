export const FIRST_START_QUESTION_COUNT = 10;

export type FirstStartCtaSource = "spotlight" | "card" | "today";

export function shouldShowHomeStartSpotlight(input: {
  isReadinessEmpty: boolean;
  isReadinessLoading: boolean;
  spotlightDismissed: boolean;
  unlockHomeChrome: boolean;
}) {
  if (
    input.unlockHomeChrome ||
    input.isReadinessLoading ||
    input.spotlightDismissed ||
    !input.isReadinessEmpty
  ) {
    return false;
  }

  return true;
}
