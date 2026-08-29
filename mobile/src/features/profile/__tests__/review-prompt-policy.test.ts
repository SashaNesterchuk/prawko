import { REVIEW_PROMPT_POLICY } from "@prawko/config";

import {
  getAdQuietWaitMs,
  shouldRequestInAppReview,
  type InAppReviewPromptInput,
} from "../review-prompt-policy";

function baseInput(
  overrides: Partial<InAppReviewPromptInput> = {}
): InAppReviewPromptInput {
  return {
    alreadyPrompted: false,
    isE2ETestMode: false,
    isExamSessionActive: false,
    isInterstitialShowing: false,
    isTimedSession: false,
    lastAdShownAt: null,
    mode: "learning",
    now: 1_000_000,
    positiveOutcome: true,
    source: "exam_passed",
    storeHydrated: true,
    ...overrides,
  };
}

describe("shouldRequestInAppReview", () => {
  it("allows a passed mini-test exam result after the session has ended", () => {
    expect(
      shouldRequestInAppReview(
        baseInput({
          mode: "mini_test",
          source: "exam_passed",
        })
      )
    ).toEqual({ allowed: true });
  });

  it("allows a strong untimed training result", () => {
    expect(
      shouldRequestInAppReview(
        baseInput({
          mode: "wrong_answers",
          source: "training_good",
        })
      )
    ).toEqual({ allowed: true });
  });

  it("never asks during an exam session", () => {
    expect(
      shouldRequestInAppReview(baseInput({ isExamSessionActive: true }))
    ).toEqual({ allowed: false, reason: "exam_active" });
  });

  it("never asks during or after a timed blitz", () => {
    expect(
      shouldRequestInAppReview(
        baseInput({
          isTimedSession: true,
          mode: "blitz",
          source: "training_good",
        })
      )
    ).toEqual({ allowed: false, reason: "timed_session" });
  });

  it("skips readiness / exam-like training modes", () => {
    expect(
      shouldRequestInAppReview(
        baseInput({
          mode: "mini_test",
          source: "training_good",
        })
      )
    ).toEqual({ allowed: false, reason: "blocked_mode" });
  });

  it("skips a failed or weak result", () => {
    expect(
      shouldRequestInAppReview(baseInput({ positiveOutcome: false }))
    ).toEqual({ allowed: false, reason: "not_positive" });
  });

  it("asks at most once per install", () => {
    expect(
      shouldRequestInAppReview(baseInput({ alreadyPrompted: true }))
    ).toEqual({ allowed: false, reason: "already_prompted" });
  });

  it("does not open a native sheet on top of an interstitial", () => {
    expect(
      shouldRequestInAppReview(baseInput({ isInterstitialShowing: true }))
    ).toEqual({ allowed: false, reason: "interstitial_showing" });
  });

  it("waits through the ad quiet period", () => {
    expect(
      shouldRequestInAppReview(
        baseInput({
          lastAdShownAt: 1_000_000 - 200,
          now: 1_000_000,
        })
      )
    ).toEqual({ allowed: false, reason: "ad_recent" });
  });

  it("skips Maestro / e2e builds so a system sheet cannot steal the result screen", () => {
    expect(
      shouldRequestInAppReview(baseInput({ isE2ETestMode: true }))
    ).toEqual({ allowed: false, reason: "e2e" });
  });
});

describe("getAdQuietWaitMs", () => {
  it("is zero when no ad has shown", () => {
    expect(getAdQuietWaitMs({ lastAdShownAt: null, now: 50 })).toBe(0);
  });

  it("returns remaining quiet time after an interstitial", () => {
    expect(
      getAdQuietWaitMs({
        lastAdShownAt: 0,
        now: 500,
      })
    ).toBe(REVIEW_PROMPT_POLICY.adQuietPeriodMs - 500);
  });
});
