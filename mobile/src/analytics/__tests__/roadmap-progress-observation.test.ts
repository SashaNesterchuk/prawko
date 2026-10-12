import { observeRoadmapProgress } from "../roadmap-progress-observation";
import { validateAnalyticsPayload } from "../payload-contract";
import type { RoadmapLesson } from "../../features/home/roadmap-progress";

const key = "CZ:B:CZ:0:0";
const lesson = (correctIds: string[], wrongIds: string[] = []): RoadmapLesson => ({ questionIds: ["a", "b"], correctIds, wrongIds, revision: "r" });
const snapshot = (value: RoadmapLesson, hasHydrated = true) => ({ lessons: { [key]: value }, hasHydrated });
const capture = jest.fn();
const session = { id: "training-1", request: { roadmapStepId: "CZ:0:0", currentCategory: "B" }, questionIds: ["a", "b"] };
beforeEach(() => capture.mockClear());

it("observes exact correction and completion/reopening with original step scope", () => {
  observeRoadmapProgress(snapshot(lesson(["a"], ["b"])), snapshot(lesson(["a", "b"])), capture, session);
  expect(capture.mock.calls[0][1]).toMatchObject({ exam_country: "CZ", category: "B", roadmap_step_id: "CZ:0:0", previous_correct_count: 1, previous_wrong_count: 1, correct_count: 2, wrong_count: 0, completion_transition: "completed", training_session_id: "training-1", question_id: "b" });
  expect(validateAnalyticsPayload(capture.mock.calls[0][0], capture.mock.calls[0][1]).analytics_payload_valid).toBe(true);
  observeRoadmapProgress(snapshot(lesson(["a", "b"])), snapshot(lesson(["b"], ["a"])), capture, session);
  expect(capture.mock.calls[1][1]).toMatchObject({ completed: false, correct_percent: 50, wrong_percent: 50, completion_transition: "reopened" });
});
it("does not invent completions from hydration, reset or pool creation", () => {
  observeRoadmapProgress(snapshot(lesson([]), false), snapshot(lesson(["a", "b"])), capture, session);
  observeRoadmapProgress(snapshot(lesson(["a", "b"])), { lessons: {}, hasHydrated: true }, capture, session);
  observeRoadmapProgress({ lessons: {}, hasHydrated: true }, snapshot(lesson(["a", "b"])), capture, session);
  expect(capture).not.toHaveBeenCalled();
});
it("ignores repeat answers and array reordering with unchanged coverage", () => {
  observeRoadmapProgress(snapshot(lesson(["a", "b"])), snapshot(lesson(["b", "a"])), capture, session);
  expect(capture).not.toHaveBeenCalled();
});
it("distinguishes content invalidation from a new wrong answer", () => {
  observeRoadmapProgress(snapshot(lesson(["a", "b"])), snapshot({ ...lesson([]), revision: "new" }), capture, session);
  expect(capture.mock.calls[0][1]).toMatchObject({ change_reason: "content_changed", question_id: null, training_session_id: null, completion_transition: "reopened" });
});
it("validates actions and actual animation exposures", () => {
  expect(validateAnalyticsPayload("home_preparation_action_selected", { source: "home_preparation", action: "mistakes", destination: "paywall", question_total: 3, correct_count: 1, wrong_count: 1, progress_percent: 200 / 3 }).analytics_payload_valid).toBe(true);
  expect(validateAnalyticsPayload("first_step_nudge_shown", { roadmap_step_id: "SK:0:0", category: "B", exam_country: "SK", animation: "double_bounce" }).analytics_payload_valid).toBe(true);
  expect(validateAnalyticsPayload("home_preparation_action_selected", { action: "statistics" }).analytics_payload_valid).toBe(false);
});
