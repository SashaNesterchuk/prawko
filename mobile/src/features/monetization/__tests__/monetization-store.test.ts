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
    expect(store.requestSurface("teaser", "after_ad_2")).toBe(true);
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
});
