const mockIsAdMobEnabled = jest.fn(() => true);
const mockIsInterstitialLoaded = jest.fn(() => false);
const mockEnsureInterstitialReady = jest.fn(async () => false);
const mockShowPreloadedInterstitial = jest.fn(async () => false);

const mockShouldShow = jest.fn(() => ({
  allowed: true as boolean,
  reason: null as string | null,
}));
const mockRecordAdShown = jest.fn();
const mockSuppressAppResumeAds = jest.fn();
const mockClearAppBackgroundMark = jest.fn();
const mockIsExamSessionActive = jest.fn(() => false);

jest.mock("../admob-config", () => ({
  isAdMobEnabled: () => mockIsAdMobEnabled(),
}));

jest.mock("../interstitial-controller", () => ({
  isInterstitialLoaded: () => mockIsInterstitialLoaded(),
  ensureInterstitialReady: (...args: unknown[]) =>
    mockEnsureInterstitialReady(...args),
  showPreloadedInterstitial: () => mockShowPreloadedInterstitial(),
}));

jest.mock("../ad-session-policy", () => ({
  shouldShowInterstitialForTrigger: (...args: unknown[]) =>
    mockShouldShow(...args),
  recordAdShown: () => mockRecordAdShown(),
  suppressAppResumeAds: (...args: unknown[]) =>
    mockSuppressAppResumeAds(...args),
  clearAppBackgroundMark: () => mockClearAppBackgroundMark(),
  isExamSessionActive: () => mockIsExamSessionActive(),
}));

jest.mock("@prawko/config", () => ({
  FEATURE_FLAGS: {
    enableAds: true,
  },
}));

jest.mock("../../../providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: jest.fn() }),
}));

jest.mock("../../../state/entitlements", () => ({
  useHasPlusAccess: () => false,
}));

import { FEATURE_FLAGS } from "@prawko/config";
import {
  INTERSTITIAL_ENSURE_OPTIONS,
  isAdRouteBlocked,
  maybeShowInterstitial,
  showInterstitialForUnlockGate,
  showInterstitialIfAllowed,
} from "../show-interstitial";

const featureFlags = FEATURE_FLAGS as { enableAds: boolean };

describe("show-interstitial", () => {
  const track = jest.fn();

  beforeEach(() => {
    track.mockReset();
    mockIsAdMobEnabled.mockReturnValue(true);
    mockIsInterstitialLoaded.mockReturnValue(false);
    mockEnsureInterstitialReady.mockResolvedValue(false);
    mockShowPreloadedInterstitial.mockResolvedValue(false);
    mockShouldShow.mockReturnValue({ allowed: true, reason: null });
    mockRecordAdShown.mockReset();
    mockSuppressAppResumeAds.mockReset();
    mockClearAppBackgroundMark.mockReset();
    mockIsExamSessionActive.mockReturnValue(false);
    featureFlags.enableAds = true;
  });

  describe("isAdRouteBlocked", () => {
    it("blocks known modal and onboarding routes only", () => {
      expect(isAdRouteBlocked("/paywall")).toBe(true);
      expect(isAdRouteBlocked("/modals/access-center")).toBe(true);
      expect(isAdRouteBlocked("/modals/ai-chat")).toBe(true);
      expect(isAdRouteBlocked("/(onboarding)/lang")).toBe(true);
      expect(isAdRouteBlocked("/exam/result")).toBe(false);
      expect(isAdRouteBlocked("/(tabs)/profile")).toBe(false);
    });
  });

  describe("INTERSTITIAL_ENSURE_OPTIONS", () => {
    it("keeps a short fail-open budget", () => {
      expect(INTERSTITIAL_ENSURE_OPTIONS).toEqual({
        attempts: 2,
        timeoutMs: 5_000,
      });
    });
  });

  describe("showInterstitialIfAllowed", () => {
    it("skips without tracking for trigger_not_ready", async () => {
      mockShouldShow.mockReturnValue({
        allowed: false,
        reason: "trigger_not_ready",
      });

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_question_answer",
        })
      ).resolves.toBe(false);

      expect(track).not.toHaveBeenCalled();
    });

    it("tracks skip for policy denials other than trigger_not_ready", async () => {
      mockShouldShow.mockReturnValue({
        allowed: false,
        reason: "plus_user",
      });

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: true,
          track,
          trigger: "after_exam_complete",
        })
      ).resolves.toBe(false);

      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "plus_user" })
      );
    });

    it("skips when feature flag disabled after policy allows", async () => {
      featureFlags.enableAds = false;

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_exam_complete",
        })
      ).resolves.toBe(false);

      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "disabled" })
      );
    });

    it("does not wait for load when waitForLoad is false", async () => {
      mockIsInterstitialLoaded.mockReturnValue(false);

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "app_resume",
          waitForLoad: false,
        })
      ).resolves.toBe(false);

      expect(mockEnsureInterstitialReady).not.toHaveBeenCalled();
      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "not_loaded" })
      );
    });

    it("waits for load then skips when ensure fails", async () => {
      mockEnsureInterstitialReady.mockResolvedValue(false);

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_exam_complete",
          waitForLoad: true,
        })
      ).resolves.toBe(false);

      expect(mockEnsureInterstitialReady).toHaveBeenCalledWith(
        INTERSTITIAL_ENSURE_OPTIONS
      );
      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "not_loaded" })
      );
    });

    it("shows on first attempt and records analytics", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial.mockResolvedValue(true);

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_exam_complete",
          waitForLoad: true,
        })
      ).resolves.toBe(true);

      expect(mockSuppressAppResumeAds).toHaveBeenCalled();
      expect(mockClearAppBackgroundMark).toHaveBeenCalled();
      expect(mockRecordAdShown).toHaveBeenCalled();
      expect(track).toHaveBeenCalledWith(
        "ad_shown",
        expect.objectContaining({
          trigger: "after_exam_complete",
          type: "exam_result",
        })
      );
      expect(track).toHaveBeenCalledWith(
        "ad_interstitial_dismissed",
        expect.objectContaining({ trigger: "after_exam_complete" })
      );
    });

    it("retries once after failed show then succeeds", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockEnsureInterstitialReady.mockResolvedValue(true);

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_exam_complete",
          waitForLoad: true,
        })
      ).resolves.toBe(true);

      expect(mockShowPreloadedInterstitial).toHaveBeenCalledTimes(2);
      expect(mockEnsureInterstitialReady).toHaveBeenCalledWith({
        attempts: 1,
        timeoutMs: 3_000,
      });
      expect(track).toHaveBeenCalledWith(
        "ad_shown",
        expect.objectContaining({ retried: true })
      );
    });

    it("retries once after failed show then skips", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial.mockResolvedValue(false);
      mockEnsureInterstitialReady.mockResolvedValue(true);

      await expect(
        showInterstitialIfAllowed({
          hasPlusAccess: false,
          track,
          trigger: "after_exam_complete",
          waitForLoad: true,
        })
      ).resolves.toBe(false);

      expect(mockShowPreloadedInterstitial).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenCalledWith(
        "ad_failed",
        expect.objectContaining({ reason: "show_returned_false" })
      );
    });

    it("passes blocked routes into policy via pathname", async () => {
      mockShouldShow.mockReturnValue({
        allowed: false,
        reason: "blocked_route",
      });

      await showInterstitialIfAllowed({
        hasPlusAccess: false,
        pathname: "/paywall",
        track,
        trigger: "after_exam_complete",
      });

      expect(mockShouldShow).toHaveBeenCalledWith(
        "after_exam_complete",
        expect.objectContaining({ routeBlocked: true })
      );
    });
  });

  describe("showInterstitialForUnlockGate", () => {
    it("skips plus users and disabled ads without showing", async () => {
      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: true,
          track,
        })
      ).resolves.toBe(false);

      mockIsAdMobEnabled.mockReturnValue(false);
      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          track,
        })
      ).resolves.toBe(false);

      expect(mockShowPreloadedInterstitial).not.toHaveBeenCalled();
    });

    it("skips blocked routes and active exam", async () => {
      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          pathname: "/modals/ai-chat",
          track,
        })
      ).resolves.toBe(false);

      mockIsExamSessionActive.mockReturnValue(true);
      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          pathname: "/exam/result",
          track,
        })
      ).resolves.toBe(false);

      expect(mockShowPreloadedInterstitial).not.toHaveBeenCalled();
    });

    it("shows after ensure when not loaded", async () => {
      mockIsInterstitialLoaded.mockReturnValue(false);
      mockEnsureInterstitialReady.mockResolvedValue(true);
      mockShowPreloadedInterstitial.mockResolvedValue(true);

      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          track,
        })
      ).resolves.toBe(true);

      expect(mockEnsureInterstitialReady).toHaveBeenCalledWith(
        INTERSTITIAL_ENSURE_OPTIONS
      );
      expect(mockRecordAdShown).toHaveBeenCalled();
    });

    it("skips when ensure cannot warm a creative", async () => {
      mockIsInterstitialLoaded.mockReturnValue(false);
      mockEnsureInterstitialReady.mockResolvedValue(false);

      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          track,
        })
      ).resolves.toBe(false);

      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "not_loaded" })
      );
    });

    it("retries unlock show once and succeeds", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockEnsureInterstitialReady.mockResolvedValue(true);

      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          track,
        })
      ).resolves.toBe(true);

      expect(mockShowPreloadedInterstitial).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenCalledWith(
        "ad_shown",
        expect.objectContaining({
          trigger: "exam_restart",
          type: "exam_restart_gate",
          retried: true,
        })
      );
    });

    it("retries unlock show once then fails open", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial.mockResolvedValue(false);
      mockEnsureInterstitialReady.mockResolvedValue(false);

      await expect(
        showInterstitialForUnlockGate({
          hasPlusAccess: false,
          track,
        })
      ).resolves.toBe(false);

      expect(track).toHaveBeenCalledWith(
        "ad_failed",
        expect.objectContaining({ reason: "show_returned_false" })
      );
    });
  });

  describe("opportunity type mapping", () => {
    it("maps practice, streak, and resume triggers in analytics", async () => {
      mockIsInterstitialLoaded.mockReturnValue(true);
      mockShowPreloadedInterstitial.mockResolvedValue(true);

      await showInterstitialIfAllowed({
        hasPlusAccess: false,
        practiceAnsweredCount: 3,
        track,
        trigger: "after_practice_session_complete",
        waitForLoad: true,
      });

      expect(track).toHaveBeenCalledWith(
        "ad_opportunity",
        expect.objectContaining({ type: "practice_session_end" })
      );

      track.mockClear();
      await showInterstitialIfAllowed({
        hasPlusAccess: false,
        track,
        trigger: "app_resume",
        waitForLoad: true,
      });

      expect(track).toHaveBeenCalledWith(
        "ad_opportunity",
        expect.objectContaining({ type: "app_resume" })
      );

      track.mockClear();
      await showInterstitialIfAllowed({
        hasPlusAccess: false,
        track,
        trigger: "after_question_answer",
        waitForLoad: true,
      });

      expect(track).toHaveBeenCalledWith(
        "ad_opportunity",
        expect.objectContaining({ type: "practice_streak" })
      );
    });
  });

  describe("maybeShowInterstitial", () => {
    it("fires waitForLoad:false path without awaiting", async () => {
      mockIsInterstitialLoaded.mockReturnValue(false);

      maybeShowInterstitial("after_question_answer", {
        hasPlusAccess: false,
        track,
      });

      await Promise.resolve();

      expect(mockEnsureInterstitialReady).not.toHaveBeenCalled();
      expect(track).toHaveBeenCalledWith(
        "ad_skipped",
        expect.objectContaining({ reason: "not_loaded" })
      );
    });
  });
});
