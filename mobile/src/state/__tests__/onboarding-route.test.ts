import {
  canFinalizeOnboarding,
  getNextOnboardingRoute,
} from "../app-shell";

describe("onboarding routes", () => {
  it("sends an unfinished learner to category then exam-schedule, never notifications", () => {
    expect(
      getNextOnboardingRoute({
        onboardingProgress: { categoryDone: false },
      })
    ).toBe("/(onboarding)/category");
    expect(
      getNextOnboardingRoute({
        onboardingProgress: { categoryDone: true },
      })
    ).toBe("/(onboarding)/exam-schedule");
  });

  it("can finalize after category and schedule without a notifications step", () => {
    expect(
      canFinalizeOnboarding({
        onboardingProgress: { categoryDone: true, scheduleDone: true },
        studyPlanSetup: { daysUntilExam: 14 },
      })
    ).toBe(true);
    expect(
      canFinalizeOnboarding({
        onboardingProgress: { categoryDone: true, scheduleDone: false },
        studyPlanSetup: { daysUntilExam: null },
      })
    ).toBe(false);
  });
});

it.each(["PL", "SK", "CZ"] as const)("%s uses the restored date step", (examCountry) => {
  const state = { examCountry, onboardingProgress: { categoryDone: true, scheduleDone: false }, studyPlanSetup: { daysUntilExam: null } };
  expect(getNextOnboardingRoute(state)).toBe("/(onboarding)/exam-schedule");
  expect(canFinalizeOnboarding(state)).toBe(false);
  expect(canFinalizeOnboarding({ ...state, onboardingProgress: { categoryDone: true, scheduleDone: true }, studyPlanSetup: { daysUntilExam: 14 } })).toBe(true);
});
