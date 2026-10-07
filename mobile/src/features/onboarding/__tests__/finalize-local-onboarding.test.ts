import type { GeneratedStudyPlan } from "@prawko/schemas";

import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { generateLocalStudyPlan } from "../../study-plan/generate-local-study-plan";
import { finalizeLocalOnboarding } from "../finalize-local-onboarding";

jest.mock("../../study-plan/generate-local-study-plan", () => ({
  generateLocalStudyPlan: jest.fn(),
}));

const generateLocalStudyPlanMock = jest.mocked(generateLocalStudyPlan);

const plan = {
  id: "plan-1",
  level: "first_time",
  minutesPerDay: 20,
} as GeneratedStudyPlan;

function createStore(overrides: Record<string, unknown> = {}) {
  return {
    preferredCategory: "B",
    preferredLocale: "pl",
    currentStudyPlan: null,
    onboardingCompleted: false,
    studyPlanSetup: {
      daysUntilExam: 14,
      examDate: "2026-10-01",
      level: null,
      minutesPerDay: null,
      schoolCode: "",
    },
    completeOnboarding: jest.fn(),
    saveCurrentStudyPlan: jest.fn(),
    setLevel: jest.fn(),
    setMinutesPerDay: jest.fn(),
    ...overrides,
  };
}

describe("finalizeLocalOnboarding", () => {
  beforeEach(() => {
    generateLocalStudyPlanMock.mockReturnValue(plan);
  });

  it("tracks study_plan_created when the first local plan is written", () => {
    const track = jest.fn();
    const store = createStore();

    finalizeLocalOnboarding(store as never, track);

    expect(store.saveCurrentStudyPlan).toHaveBeenCalledWith(plan);
    expect(store.completeOnboarding).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(ANALYTICS_EVENTS.studyPlanCreated.key, {
      days_until_exam: 14,
      has_exam_date: true,
      level: "first_time",
      minutes_per_day: 20,
      remote_sync_succeeded: false,
      source: "finalize_local",
    });
  });

  it("does not duplicate plan creation when a plan already exists", () => {
    const track = jest.fn();
    const store = createStore({ currentStudyPlan: plan });

    finalizeLocalOnboarding(store as never, track);

    expect(track.mock.calls.map(([event]) => event)).toEqual([ANALYTICS_EVENTS.onboardingFlowCompleted.key]);
    expect(store.saveCurrentStudyPlan).toHaveBeenCalledWith(plan);
    expect(store.completeOnboarding).toHaveBeenCalled();
  });

  it("does not call a settings revisit a new onboarding completion", () => {
    const track = jest.fn();
    const store = createStore({ currentStudyPlan: plan, onboardingCompleted: true });
    finalizeLocalOnboarding(store as never, track);
    expect(track).not.toHaveBeenCalled();
  });

  it("does not claim completion when local persistence rejects", () => {
    const track = jest.fn();
    const store = createStore({ saveCurrentStudyPlan: jest.fn(() => { throw new Error("save failed"); }) });
    expect(() => finalizeLocalOnboarding(store as never, track)).toThrow("save failed");
    expect(track).not.toHaveBeenCalled();
    expect(store.completeOnboarding).not.toHaveBeenCalled();
  });

  it("isolates new completion telemetry from the accepted product operation", () => {
    const track = jest.fn(() => { throw new Error("observer failed"); });
    const store = createStore({ currentStudyPlan: plan });
    expect(() => finalizeLocalOnboarding(store as never, track)).not.toThrow();
    expect(store.completeOnboarding).toHaveBeenCalledTimes(1);
  });
});
