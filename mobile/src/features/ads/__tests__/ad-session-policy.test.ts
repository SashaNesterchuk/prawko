import { AD_POLICY } from "@prawko/config";

import {
  clearAppBackgroundMark,
  createFreshSessionState,
  getLastAdShownAt,
  isAppResumeAdsSuppressed,
  isExamSessionActive,
  markAppBackgrounded,
  recordAdShown,
  recordQuestionAnsweredForAds,
  resetAdSessionStateForTests,
  setExamSessionActive,
  shouldShowInterstitialForTrigger,
  suppressAppResumeAds,
  touchAdSessionActivity,
} from "../ad-session-policy";

describe("ad-session-policy", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
    resetAdSessionStateForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createFreshSessionState", () => {
    it("starts with zero ads and activity timestamps at now", () => {
      const state = createFreshSessionState();

      expect(state.adsShownThisSession).toBe(0);
      expect(state.lastAdShownAt).toBeNull();
      expect(getLastAdShownAt()).toBeNull();
      expect(state.questionsAnsweredSinceLastAd).toBe(0);
      expect(state.lastActivityAt).toBe(Date.now());
      expect(state.sessionStartedAt).toBe(Date.now());
    });
  });

  describe("touchAdSessionActivity", () => {
    it("resets session after long inactivity", () => {
      recordAdShown();
      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        }).allowed
      ).toBe(true);

      // Fill cap so next show would be blocked unless session resets.
      for (let i = 0; i < AD_POLICY.maxAdsPerSession; i += 1) {
        recordAdShown();
      }

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "cap" });

      jest.advanceTimersByTime(
        AD_POLICY.sessionInactivityResetMinutes * 60 * 1000
      );
      touchAdSessionActivity();

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: true, reason: null });
    });

    it("only bumps lastActivityAt when still within inactivity window", () => {
      recordAdShown();
      jest.advanceTimersByTime(60_000);
      touchAdSessionActivity();

      expect(
        shouldShowInterstitialForTrigger("after_practice_session_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
          practiceAnsweredCount: 3,
        })
      ).toEqual({ allowed: false, reason: "cooldown" });
    });
  });

  describe("recordQuestionAnsweredForAds / after_question_answer", () => {
    it("blocks until enough answers since last ad", () => {
      expect(
        shouldShowInterstitialForTrigger("after_question_answer", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      for (let i = 0; i < AD_POLICY.questionsBetweenInterstitials - 1; i += 1) {
        recordQuestionAnsweredForAds();
      }

      expect(
        shouldShowInterstitialForTrigger("after_question_answer", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      recordQuestionAnsweredForAds();

      expect(
        shouldShowInterstitialForTrigger("after_question_answer", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: true, reason: null });
    });

    it("resets question streak after an ad is shown", () => {
      for (let i = 0; i < AD_POLICY.questionsBetweenInterstitials; i += 1) {
        recordQuestionAnsweredForAds();
      }

      recordAdShown();
      jest.advanceTimersByTime(AD_POLICY.minSecondsBetweenAds * 1000);

      expect(
        shouldShowInterstitialForTrigger("after_question_answer", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });
    });
  });

  describe("after_practice_session_complete", () => {
    it("requires at least one answer and below streak threshold", () => {
      expect(
        shouldShowInterstitialForTrigger("after_practice_session_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
          practiceAnsweredCount: 0,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      expect(
        shouldShowInterstitialForTrigger("after_practice_session_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
          practiceAnsweredCount: AD_POLICY.questionsBetweenInterstitials,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      expect(
        shouldShowInterstitialForTrigger("after_practice_session_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
          practiceAnsweredCount: 3,
        })
      ).toEqual({ allowed: true, reason: null });
    });
  });

  describe("app_resume", () => {
    it("requires a long enough background mark", () => {
      expect(
        shouldShowInterstitialForTrigger("app_resume", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      markAppBackgrounded();
      expect(
        shouldShowInterstitialForTrigger("app_resume", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });

      jest.advanceTimersByTime(
        AD_POLICY.appResumeBackgroundMinutes * 60 * 1000
      );

      expect(
        shouldShowInterstitialForTrigger("app_resume", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: true, reason: null });
    });

    it("clears background mark so resume is not ready again", () => {
      markAppBackgrounded();
      jest.advanceTimersByTime(
        AD_POLICY.appResumeBackgroundMinutes * 60 * 1000
      );
      clearAppBackgroundMark();

      expect(
        shouldShowInterstitialForTrigger("app_resume", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "trigger_not_ready" });
    });
  });

  describe("guards", () => {
    it("skips when ads disabled, plus user, blocked route, or exam active", () => {
      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: false,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "disabled" });

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: true,
        })
      ).toEqual({ allowed: false, reason: "plus_user" });

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
          routeBlocked: true,
        })
      ).toEqual({ allowed: false, reason: "blocked_route" });

      setExamSessionActive(true);
      expect(isExamSessionActive()).toBe(true);
      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "exam_active" });
      setExamSessionActive(false);
    });

    it("enforces session cap", () => {
      for (let i = 0; i < AD_POLICY.maxAdsPerSession; i += 1) {
        recordAdShown();
        jest.advanceTimersByTime(AD_POLICY.minSecondsBetweenAds * 1000);
      }

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "cap" });
    });

    it("enforces cooldown except for after_exam_complete", () => {
      recordAdShown();

      expect(
        shouldShowInterstitialForTrigger("exam_restart", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: false, reason: "cooldown" });

      expect(
        shouldShowInterstitialForTrigger("after_exam_complete", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: true, reason: null });

      jest.advanceTimersByTime(AD_POLICY.minSecondsBetweenAds * 1000);

      expect(
        shouldShowInterstitialForTrigger("exam_restart", {
          adsEnabled: true,
          hasPlusAccess: false,
        })
      ).toEqual({ allowed: true, reason: null });
    });
  });

  describe("suppressAppResumeAds", () => {
    it("suppresses for the configured window then expires", () => {
      suppressAppResumeAds(5_000);
      expect(isAppResumeAdsSuppressed()).toBe(true);

      jest.advanceTimersByTime(4_999);
      expect(isAppResumeAdsSuppressed()).toBe(true);

      jest.advanceTimersByTime(1);
      expect(isAppResumeAdsSuppressed()).toBe(false);
    });
  });
});
