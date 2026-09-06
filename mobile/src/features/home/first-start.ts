import { INITIAL_DIAGNOSTIC_QUESTION_COUNT } from "../questions/initial-diagnostic/mix";

export const FIRST_START_QUESTION_COUNT = INITIAL_DIAGNOSTIC_QUESTION_COUNT;

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
