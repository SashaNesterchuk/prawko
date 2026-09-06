import { REVIEW_PROMPT_POLICY } from "@prawko/config";

export type InAppReviewPromptSource = "exam_passed" | "training_good";

export type InAppReviewPromptSkipReason =
  | "already_prompted"
  | "e2e"
  | "exam_active"
  | "timed_session"
  | "blocked_mode"
  | "not_positive"
  | "interstitial_showing"
  | "ad_recent"
  | "not_hydrated"
  | "unavailable";

export type InAppReviewPromptDecision =
  | { allowed: true }
  | { allowed: false; reason: InAppReviewPromptSkipReason };

/** Exam-like or timed drills — never steal focus from a live clock. */
const BLOCKED_TRAINING_MODES = new Set([
  "blitz",
  "mini_test",
  "initial_diagnostic",
  "exam",
  "exam_tomorrow",
]);

export type InAppReviewPromptInput = {
  alreadyPrompted: boolean;
  isE2ETestMode: boolean;
  isExamSessionActive: boolean;
  isInterstitialShowing: boolean;
  isTimedSession: boolean;
  lastAdShownAt: number | null;
  mode?: string | null;
  now?: number;
  positiveOutcome: boolean;
  source: InAppReviewPromptSource;
  storeHydrated: boolean;
};

export function getAdQuietWaitMs(input: {
  lastAdShownAt: number | null;
  now?: number;
}) {
  if (input.lastAdShownAt == null) {
    return 0;
  }

  const elapsed = (input.now ?? Date.now()) - input.lastAdShownAt;
  return Math.max(0, REVIEW_PROMPT_POLICY.adQuietPeriodMs - elapsed);
}

export function shouldRequestInAppReview(
  input: InAppReviewPromptInput
): InAppReviewPromptDecision {
  if (!input.storeHydrated) {
    return { allowed: false, reason: "not_hydrated" };
  }

  if (input.isE2ETestMode) {
    return { allowed: false, reason: "e2e" };
  }

  if (input.alreadyPrompted) {
    return { allowed: false, reason: "already_prompted" };
  }

  if (input.isExamSessionActive) {
    return { allowed: false, reason: "exam_active" };
  }

  if (input.isInterstitialShowing) {
    return { allowed: false, reason: "interstitial_showing" };
  }

  if (getAdQuietWaitMs(input) > 0) {
    return { allowed: false, reason: "ad_recent" };
  }

  if (!input.positiveOutcome) {
    return { allowed: false, reason: "not_positive" };
  }

  if (input.source === "training_good") {
    if (input.isTimedSession) {
      return { allowed: false, reason: "timed_session" };
    }

    if (input.mode && BLOCKED_TRAINING_MODES.has(input.mode)) {
      return { allowed: false, reason: "blocked_mode" };
    }
  }

  return { allowed: true };
}
