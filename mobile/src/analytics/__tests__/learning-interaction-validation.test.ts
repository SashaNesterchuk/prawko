import type { AnalyticsProperties } from "../catalog";
import type { LearningInteractionPayloads } from "../learning-interaction-payloads";
import { OFFLINE_BLOCK_REASONS, TRAINING_EMPTY_REASONS } from "../learning-interaction-payloads";
import { ANALYTICS_PAYLOAD_CONTRACTS, validateAnalyticsPayload } from "../payload-contract";
import { LEARNING_INTERACTION_FIXTURES as fixtures } from "../type-tests/learning-interaction-fixtures";

type Event = keyof LearningInteractionPayloads;
const events = Object.keys(fixtures) as Event[];

function expectInvalid(event: Event, changes: AnalyticsProperties, key: string) {
  const result = validateAnalyticsPayload(event, { ...fixtures[event], ...changes });
  expect(result.analytics_payload_contract_status).toBe("invalid");
  expect(result.analytics_payload_valid).toBe(false);
  expect(result.analytics_payload_invalid_keys?.split(",")).toContain(key);
}

describe("learning interaction payload QA", () => {
  it.each(events)("defines the actual observation fields for %s", (event) => {
    expect(validateAnalyticsPayload(event, fixtures[event])).toEqual({
      analytics_payload_contract_version: 2, analytics_payload_contract_status: "valid",
      analytics_payload_valid: true, analytics_payload_invalid_keys: null,
    });
  });

  it.each(events)("requires declared scalar fields without leaking rejected values for %s", (event) => {
    const rules = ANALYTICS_PAYLOAD_CONTRACTS[event];
    for (const [key, rule] of Object.entries(rules)) {
      const wrong = rule.type === "number" ? -1 : rule.type === "boolean" ? "private-value" : "";
      expectInvalid(event, { [key]: wrong }, key);
      if (!("optional" in rule && rule.optional)) {
        const missing: AnalyticsProperties = { ...fixtures[event] };
        delete missing[key];
        expect(validateAnalyticsPayload(event, missing).analytics_payload_invalid_keys?.split(",")).toContain(key);
      }
      if (!("nullable" in rule && rule.nullable)) expectInvalid(event, { [key]: null }, key);
      const result = validateAnalyticsPayload(event, { ...fixtures[event], [key]: "private-value" });
      expect(JSON.stringify(result)).not.toContain("private-value");
    }
  });

  it.each([
    ["training_result_viewed", { answered_count: 6 }, "answered_count"],
    ["training_result_viewed", { correct_count: 6 }, "correct_count"],
    ["training_result_viewed", { incorrect_count: 6 }, "incorrect_count"],
    ["training_result_viewed", { correct_count: 5, incorrect_count: 1 }, "answered_count"],
    ["training_session_abandoned", { exit_reason: "zero_answer_exit" }, "answered_count"],
    ["exam_result_viewed", { wrong_count: 6 }, "wrong_count"],
    ["exam_session_ended", { correct_count: 5, wrong_count: 1 }, "answered_count"],
    ["training_answers_review_question_viewed", { question_index: 0 }, "question_index"],
    ["training_feedback_continued", { question_index: 6 }, "question_index"],
    ["exam_answers_review_closed", { viewed_count: 6 }, "viewed_count"],
    ["exam_answers_review_closed", { question_index: 6 }, "question_index"],
    ["training_answers_review_question_viewed", { was_answered: false }, "is_correct"],
    ["exam_answers_review_question_viewed", { is_correct: null }, "is_correct"],
    ["exam_question_navigation_requested", { target_question_index: 0 }, "target_question_index"],
    ["exam_question_navigation_requested", { target_question_index: 6 }, "target_question_index"],
    ["exam_question_navigation_requested", { target_question_index: 2 }, "target_question_index"],
    ["exam_question_navigation_requested", { navigation_direction: "backward" }, "navigation_direction"],
    ["exam_session_resumed", { resumed_at_question: 6 }, "resumed_at_question"],
    ["exam_empty_exit", { answered_count: 1 }, "answered_count"],
    ["exam_session_ended", { status: "expired" }, "status"],
    ["exam_session_ended", { end_reason: "timer_elapsed" }, "status"],
    ["exam_session_ended", { end_reason: "user_ended_early" }, "status"],
    ["exam_session_ended", { end_reason: "dev_skip" }, "status"],
    ["exam_result_viewed", { status: "active" }, "status"],
    ["exam_result_viewed", { status: "expired" }, "outcome"],
    ["exam_result_viewed", { status: "abandoned" }, "outcome"],
    ["exam_result_viewed", { outcome: "expired" }, "outcome"],
    ["exam_restart_selected", { ad_shown: null }, "ad_shown"],
    ["exam_restart_selected", { choice: "plus" }, "ad_shown"],
    ["learning_access_blocked", { is_online: true }, "is_online"],
    ["learning_access_blocked", { offline_ready: true }, "offline_ready"],
    ["learning_access_blocked", { downloaded_category: null }, "downloaded_category"],
    ["learning_access_blocked", { downloaded_category: "B" }, "downloaded_category"],
    ["learning_access_blocked", { screen_name: "exam_loading" }, "screen_name"],
    ["learning_access_block_action", { feature: "exam" }, "screen_name"],
    ["exam_category_mismatch_viewed", { session_category: "B" }, "session_category"],
    ["exam_category_mismatch_resolved", { resolved_category: "B" }, "resolved_category"],
  ] as const)("rejects inconsistent %s evidence (%s)", (event, changes, key) => {
    expectInvalid(event, changes, key);
  });

  it.each([NaN, Infinity, -1, 0.5])("rejects non-integer review counts %s", (value) => {
    expectInvalid("training_answers_review_closed", { viewed_count: value }, "viewed_count");
  });

  it.each([NaN, Infinity, -1])("rejects invalid foreground duration %s", (value) => {
    expectInvalid("exam_session_ended", { visit_foreground_ms: value }, "visit_foreground_ms");
  });

  it("requires the actual ad show observation without treating it as reward or PAID evidence", () => {
    const { ad_shown: _shown, ...scope } = fixtures.exam_restart_selected;
    expect(validateAnalyticsPayload("exam_restart_selected", scope).analytics_payload_valid).toBe(false);
    for (const ad_shown of [true, false]) {
      expect(validateAnalyticsPayload("exam_restart_selected", { ...scope, ad_shown }).analytics_payload_valid).toBe(true);
    }
    for (const choice of ["plus", "upgrade", "dismiss"]) {
      expect(validateAnalyticsPayload("exam_restart_selected", { ...scope, choice }).analytics_payload_valid).toBe(true);
      expectInvalid("exam_restart_selected", { choice, ad_shown: false }, "ad_shown");
    }
    expectInvalid("exam_restart_gate_shown", { source: "home_daily_cap" }, "source");
  });

  it("keeps observed unknown IDs capturable as invalid QA rather than clean operation evidence", () => {
    expectInvalid("training_result_action", { training_session_id: null, mode: null }, "training_session_id");
    expectInvalid("exam_answers_review_closed", { review_id: null }, "review_id");
    expectInvalid("diagnostic_reminder_shown", { training_session_id: null }, "training_session_id");
    expectInvalid("exam_question_flag_changed", { question_index: null, question_total: null }, "question_index");
  });

  it("preserves missing review content, partial results, stored origins and unmount observations", () => {
    for (const event of ["training_answers_review_question_viewed", "exam_answers_review_question_viewed"] as const) {
      expect(validateAnalyticsPayload(event, {
        ...fixtures[event], view_state: "missing_question", was_answered: false, is_correct: null,
      }).analytics_payload_valid).toBe(true);
    }
    expect(validateAnalyticsPayload("exam_result_viewed", {
      ...fixtures.exam_result_viewed, answered_count: 1, correct_count: 0, wrong_count: 1,
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("training_result_viewed", {
      ...fixtures.training_result_viewed, result_origin: "existing_result", view_reason: "review_return",
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("exam_answers_review_closed", fixtures.exam_answers_review_closed).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("exam_answers_review_opened", {
      ...fixtures.exam_answers_review_opened, source: "route",
    }).analytics_payload_valid).toBe(true);
  });

  it.each([
    ["learner_finish", "completed"], ["timer_elapsed", "expired"], ["user_ended_early", "abandoned"],
    ["dev_skip", "abandoned"], ["unknown", "abandoned"],
  ] as const)("preserves actual terminal end reason %s with status %s", (end_reason, status) => {
    expect(validateAnalyticsPayload("exam_session_ended", {
      ...fixtures.exam_session_ended, end_reason, status,
    }).analytics_payload_valid).toBe(true);
  });

  it.each(["expired", "abandoned"] as const)("retains terminal result status/outcome %s", (status) => {
    expect(validateAnalyticsPayload("exam_result_viewed", {
      ...fixtures.exam_result_viewed, status, outcome: status,
    }).analytics_payload_valid).toBe(true);
  });

  it("retains every current empty/offline reason and nullable launch connectivity", () => {
    for (const empty_reason of TRAINING_EMPTY_REASONS) {
      expect(validateAnalyticsPayload("training_session_empty", {
        ...fixtures.training_session_empty, empty_reason,
      }).analytics_payload_valid).toBe(true);
    }
    for (const blocked_reason of OFFLINE_BLOCK_REASONS) {
      expect(validateAnalyticsPayload("learning_access_blocked", {
        ...fixtures.learning_access_blocked, blocked_reason,
        downloaded_category: blocked_reason === "pack_for_other_category" ? "A1" : null,
      }).analytics_payload_valid).toBe(true);
    }
    expect(validateAnalyticsPayload("exam_start_requested", fixtures.exam_start_requested).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("learning_access_block_action", {
      ...fixtures.learning_access_block_action, feature: "exam", screen_name: "exam_loading",
      mode: "exam", action: "open_offline_mode", destination: "/offline-mode",
    }).analytics_payload_valid).toBe(true);
  });
});
