import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { maybeRequestInAppReview } from "../request-in-app-review";
import type { RequestInAppReviewDeps } from "../request-in-app-review";

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

jest.mock("../../ads/interstitial-controller", () => ({
  isInterstitialShowing: jest.fn(() => false),
}));

function createDeps(
  overrides: Partial<RequestInAppReviewDeps> = {}
): RequestInAppReviewDeps {
  return {
    getLastAdShownAt: () => null,
    isE2ETestMode: false,
    isExamSessionActive: () => false,
    isInterstitialShowing: () => false,
    isReviewAvailable: jest.fn(async () => true),
    markPrompted: jest.fn(),
    now: () => 10_000,
    promptedAt: null,
    requestReview: jest.fn(async () => undefined),
    storeHydrated: true,
    wait: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("maybeRequestInAppReview", () => {
  const track = jest.fn();

  beforeEach(() => {
    track.mockReset();
  });

  it("requests the native sheet after a passed exam and marks prompted", async () => {
    const deps = createDeps();

    await expect(
      maybeRequestInAppReview(
        {
          positiveOutcome: true,
          source: "exam_passed",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: true });

    expect(deps.requestReview).toHaveBeenCalledTimes(1);
    expect(deps.markPrompted).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.appReviewRequested.key,
      { mode: null, source: "exam_passed" }
    );
  });

  it("does not request during a timed training session", async () => {
    const deps = createDeps();

    await expect(
      maybeRequestInAppReview(
        {
          isTimedSession: true,
          mode: "blitz",
          positiveOutcome: true,
          source: "training_good",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: false, reason: "timed_session" });

    expect(deps.requestReview).not.toHaveBeenCalled();
    expect(deps.markPrompted).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.appReviewSkipped.key,
      {
        mode: "blitz",
        reason: "timed_session",
        source: "training_good",
      }
    );
  });

  it("does not request in e2e builds", async () => {
    const deps = createDeps({ isE2ETestMode: true });

    await expect(
      maybeRequestInAppReview(
        {
          positiveOutcome: true,
          source: "training_good",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: false, reason: "e2e" });

    expect(deps.requestReview).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("waits for the ad quiet period before asking", async () => {
    let now = 1_000;
    const wait = jest.fn(async (ms: number) => {
      now += ms;
    });
    const deps = createDeps({
      getLastAdShownAt: () => 1_000,
      now: () => now,
      wait,
    });

    await expect(
      maybeRequestInAppReview(
        {
          positiveOutcome: true,
          source: "exam_passed",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: true });

    expect(wait).toHaveBeenCalled();
    expect(deps.requestReview).toHaveBeenCalledTimes(1);
  });

  it("skips when the native review API is unavailable", async () => {
    const deps = createDeps({
      isReviewAvailable: jest.fn(async () => false),
    });

    await expect(
      maybeRequestInAppReview(
        {
          positiveOutcome: true,
          source: "exam_passed",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: false, reason: "unavailable" });

    expect(deps.markPrompted).not.toHaveBeenCalled();
    expect(deps.requestReview).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.appReviewSkipped.key,
      {
        mode: null,
        reason: "unavailable",
        source: "exam_passed",
      }
    );
  });

  it("tracks a failed native sheet after marking prompted", async () => {
    const deps = createDeps({
      requestReview: jest.fn(async () => {
        throw new Error("sheet failed");
      }),
    });

    await expect(
      maybeRequestInAppReview(
        {
          mode: "exam",
          positiveOutcome: true,
          source: "exam_passed",
          track,
        },
        deps
      )
    ).resolves.toEqual({ allowed: true });

    expect(deps.markPrompted).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.appReviewRequested.key,
      { mode: "exam", source: "exam_passed" }
    );
    expect(track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.appReviewFailed.key,
      {
        mode: "exam",
        reason: "request_failed",
        source: "exam_passed",
      }
    );
  });
});
