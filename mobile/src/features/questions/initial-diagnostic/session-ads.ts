import type { QuestionSessionMode } from "@prawko/config";

/**
 * Auto interstitial after the last answer or on early exit.
 * Continue on the diagnostic result still requests the ad itself.
 */
export function shouldAutoShowPracticeSessionCompleteAd(
  mode: QuestionSessionMode
) {
  return mode !== "initial_diagnostic";
}
