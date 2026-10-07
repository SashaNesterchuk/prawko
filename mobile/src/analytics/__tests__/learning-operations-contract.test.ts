import {
  createLearningIntent, readLearningIntentId, reportLearningOperationFailure, withLearningIntent,
} from "../operations";
import { validateAnalyticsPayload } from "../payload-contract";

const mockCapture = jest.fn();
const mockTrack = jest.fn();
let mockSequence = 0;
jest.mock("../activity", () => ({
  analyticsActivity: { capture: (...args: unknown[]) => mockCapture(...args) },
}));
jest.mock("../runtime-context", () => ({
  createAnalyticsId: (prefix: string) => `${prefix}_00000000-0000-4000-8000-${String(++mockSequence).padStart(12, "0")}`,
}));

describe("learning intent and failure producer contracts", () => {
  beforeEach(() => {
    mockSequence = 0;
    mockCapture.mockReset();
    mockTrack.mockReset();
  });

  it("adds only correlation metadata and preserves route parameters and caller context", () => {
    const params = { mode: "learning", questionLimit: "10", roadmapStepId: "step", topic: "topic",
      country: "CZ", sessionKey: "business-session" };
    const original = { ...params };
    const next = withLearningIntent(params, { source: "roadmap" });
    expect(params).toEqual(original);
    expect(next).toEqual({ ...original, analyticsIntentId: "intent_00000000-0000-4000-8000-000000000001" });
    const [event, p] = mockCapture.mock.calls[0];
    expect(event).toBe("learning_intent_requested");
    expect(p).toMatchObject({
      mode: "learning", question_limit: 10, roadmap_step_id: "step", topic_id: "topic",
      learning_intent_id: next.analyticsIntentId,
    });
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(true);
    expect(readLearningIntentId(next.analyticsIntentId)).toBe(next.analyticsIntentId);
  });

  it("keeps sign intent without inventing a question/exam mode", () => {
    const next = withLearningIntent({ limit: "all" }, { feature: "sign_test", question_limit: null });
    const [event, p] = mockCapture.mock.calls[0];
    expect(next.limit).toBe("all");
    expect(p.mode).toBeNull();
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(true);
  });

  it("does not change invalid/unknown business route parameters to satisfy analytics QA", () => {
    const next = withLearningIntent({ mode: "quarter", questionLimit: "all" });
    const [event, p] = mockCapture.mock.calls[0];
    expect(next).toMatchObject({ mode: "quarter", questionLimit: "all" });
    expect(Number.isNaN(p.question_limit)).toBe(true);
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(false);
  });

  it("retains direct intent and normalizes only the failure error, without copying raw text", () => {
    const id = createLearningIntent({ mode: "exam", source: "roadmap" });
    expect(mockCapture.mock.calls[0][1].learning_intent_id).toBe(id);
    reportLearningOperationFailure(mockTrack, "sync_answer", {
      code: "network", message: "private text", receipt: "private receipt",
    }, { training_session_id: "training-1", user_visible: false });
    const [event, p] = mockTrack.mock.calls[0];
    expect(p).toMatchObject({ operation_id_source: "failure_observation", operation: "sync_answer",
      error_code: "network", user_visible: false });
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(true);
    expect(JSON.stringify(p)).not.toContain("private");
  });

  it("keeps an existing operation ID and user-visible failure context", () => {
    reportLearningOperationFailure(mockTrack, "offline_snapshot", null, { operation_id: "offline-1", user_visible: true });
    const [event, p] = mockTrack.mock.calls[0];
    expect(p).toMatchObject({ operation_id: "offline-1", operation_id_source: "existing_operation", error_code: "unknown_error" });
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(true);
  });

  it("keeps nullable operation metadata capturable as invalid evidence", () => {
    reportLearningOperationFailure(mockTrack, "load_snapshot", null, { operation_id: null, user_visible: true });
    const [event, p] = mockTrack.mock.calls[0];
    expect(p.operation_id).toBeNull();
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(false);
  });

  it("contains failure-reporting errors without replacing the original handler", () => {
    mockTrack.mockImplementation(() => { throw new Error("optional capture"); });
    expect(() => reportLearningOperationFailure(mockTrack, "load_review", new Error("original"), { user_visible: true })).not.toThrow();
  });

  it("rejects raw/non-generated intent IDs without modifying route parameters", () => {
    expect(readLearningIntentId("learner@example.com")).toBeNull();
    expect(readLearningIntentId(["intent_00000000-0000-4000-8000-000000000001"])).toBeNull();
  });
});
