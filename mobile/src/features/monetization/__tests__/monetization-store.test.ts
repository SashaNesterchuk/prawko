import {
  canShowMonetizationSurface,
  getMonetizationSessionSnapshot,
  markMonetizationSurfaceShown,
  resetMonetizationSessionForTests,
  useMonetizationStore,
} from "../monetization-store";

describe("monetization session policy", () => {
  beforeEach(() => {
    resetMonetizationSessionForTests();
    useMonetizationStore.getState().resetMonetization();
  });

  it("enforces teaser cooldown and two-show cap", () => {
    const start = 1_000_000;

    expect(canShowMonetizationSurface("teaser", start)).toBe(true);
    markMonetizationSurfaceShown("teaser", start);
    expect(canShowMonetizationSurface("teaser", start + 119_999)).toBe(false);
    expect(canShowMonetizationSurface("teaser", start + 120_000)).toBe(true);

    markMonetizationSurfaceShown("teaser", start + 120_000);
    expect(canShowMonetizationSurface("teaser", start + 500_000)).toBe(false);
  });

  it("enforces paywall cooldown and two-show cap", () => {
    const start = 1_000_000;

    markMonetizationSurfaceShown("paywall", start);
    expect(canShowMonetizationSurface("paywall", start + 299_999)).toBe(false);
    expect(canShowMonetizationSurface("paywall", start + 300_000)).toBe(true);

    markMonetizationSurfaceShown("paywall", start + 300_000);
    expect(canShowMonetizationSurface("paywall", start + 1_000_000)).toBe(false);
  });

  it("keeps only the highest-priority pending moment", () => {
    const store = useMonetizationStore.getState();

    expect(store.requestSurface("teaser", "app_open")).toBe(true);
    expect(store.requestSurface("teaser", "after_ad")).toBe(true);
    expect(store.requestSurface("teaser", "app_open")).toBe(false);
    expect(store.requestSurface("paywall", "after_exam")).toBe(true);

    expect(useMonetizationStore.getState().pendingRequest?.moment).toBe(
      "after_exam"
    );
  });

  it("deduplicates completed sessions while preserving session counters", () => {
    const store = useMonetizationStore.getState();

    expect(store.recordTrainingCompleted("training-1")).toEqual({
      count: 1,
      isNew: true,
    });
    expect(store.recordTrainingCompleted("training-1")).toEqual({
      count: 1,
      isNew: false,
    });
    expect(store.recordTrainingCompleted("training-2")).toEqual({
      count: 2,
      isNew: true,
    });
    expect(store.recordExamCompleted("exam-1", 32)).toEqual({
      count: 1,
      isNew: true,
    });
    expect(store.recordExamCompleted("exam-1", 32)).toEqual({
      count: 1,
      isNew: false,
    });

    expect(useMonetizationStore.getState()).toMatchObject({
      examCompletedLifetime: 1,
      examQuestionsAnsweredLifetime: 32,
      trainingCompletedLifetime: 2,
    });
    expect(getMonetizationSessionSnapshot().trainingCompleted).toBe(2);
  });

  it("lets a manual test teaser bypass session caps", () => {
    const start = 1_000_000;
    markMonetizationSurfaceShown("teaser", start);
    markMonetizationSurfaceShown("teaser", start + 120_000);

    expect(canShowMonetizationSurface("teaser", start + 500_000)).toBe(false);
    expect(
      useMonetizationStore.getState().requestSurface("teaser", "manual_test")
    ).toBe(true);
    expect(useMonetizationStore.getState().pendingRequest?.moment).toBe(
      "manual_test"
    );
  });

  it("requests a teaser after odd dismissed ads, from any placement", () => {
    const store = useMonetizationStore.getState();

    expect(store.recordAdDismissed()).toBe(1);
    expect(useMonetizationStore.getState().pendingRequest).toMatchObject({
      moment: "after_ad",
      surface: "teaser",
    });

    store.closeSurface();
    expect(store.recordAdDismissed()).toBe(2);
    expect(useMonetizationStore.getState().pendingRequest).toBeNull();

    expect(store.recordAdDismissed()).toBe(3);
    expect(useMonetizationStore.getState().pendingRequest).toMatchObject({
      moment: "after_ad",
      surface: "teaser",
    });

    store.closeSurface();
    expect(store.recordAdDismissed()).toBe(4);
    expect(useMonetizationStore.getState().pendingRequest).toBeNull();

    expect(store.recordAdDismissed()).toBe(5);
    expect(useMonetizationStore.getState().pendingRequest).toMatchObject({
      moment: "after_ad",
      surface: "teaser",
    });
  });

  it("lets after-ad teasers bypass the two-show cap after cooldown", () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(1_000_000);
      markMonetizationSurfaceShown("teaser", 1_000_000);
      markMonetizationSurfaceShown("teaser", 1_120_000);
      jest.setSystemTime(1_240_000);

      expect(canShowMonetizationSurface("teaser")).toBe(false);
      expect(canShowMonetizationSurface("teaser", 1_240_000, "app_open")).toBe(
        false
      );
      expect(
        useMonetizationStore.getState().requestSurface("teaser", "app_open")
      ).toBe(false);
      expect(
        useMonetizationStore.getState().requestSurface("teaser", "after_ad")
      ).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("still enforces the two-minute gap for after_ad teasers", () => {
    const start = 1_000_000;
    markMonetizationSurfaceShown("teaser", start);

    expect(
      canShowMonetizationSurface("teaser", start + 119_999, "after_ad")
    ).toBe(false);
    expect(
      canShowMonetizationSurface("teaser", start + 120_000, "after_ad")
    ).toBe(true);
  });
});
