import type { AnalyticsProperties } from "../catalog";
import { validateAnalyticsPayload } from "../payload-contract";

const visit = { app_visit_id: "visit", app_visibility: "active" };
const screen = { ...visit, screen_visit_id: "screen", route_pattern: "/learn", screen_name: "learn", view_state: "question" };
const durations = {
  foreground_ms: 100, inactive_ms: 10, interaction_engaged_ms: 50, wall_duration_ms: 120,
  duration_scope: "observed_foreground", engagement_policy: "interaction_idle_60s_v1",
};
const checkpoint = { ...visit, ...durations, checkpoint_index: 1, checkpoint_reason: "interval" };
const ready = {
  feature: "training", question_id: "q", training_session_id: "t",
  ready_foreground_ms: 10, ready_wall_ms: 20, ready_reason: "focused_ready",
  ready_duration_scope: "current_focus_entry", media_readiness: "not_measured",
};
const access = {
  is_plus: true, access_source: "purchase", previous_is_plus: null, previous_access_source: null,
  observation_reason: "initial_snapshot",
};

describe("activity, readiness and access payload QA", () => {
  it.each([
    ["app_visit_started", { ...visit, start_reason: "runtime_start", previous_visibility: "unknown" }],
    ["app_visit_checkpoint", checkpoint],
    ["app_visit_ended", { ...checkpoint, app_visibility: "background", end_reason: "background", last_screen_visit_id: null }],
    ["screen_visit_started", { ...screen, start_reason: "navigation" }],
    ["screen_visit_checkpoint", { ...screen, ...durations, checkpoint_index: 2, checkpoint_reason: "observer_unmount" }],
    ["screen_visit_ended", { ...screen, ...durations, end_reason: "navigation" }],
    ["screen_state_viewed", screen],
    ["learning_screen_ready", ready],
    ["access_state_changed", access],
  ] as const)("defines meaningful fields for %s", (event, p) => {
    expect(validateAnalyticsPayload(event, p)).toMatchObject({
      analytics_payload_contract_version: 2, analytics_payload_contract_status: "valid", analytics_payload_valid: true,
    });
  });

  it.each([
    ["app_visit_id", null], ["checkpoint_index", 0], ["checkpoint_index", 1.5], ["checkpoint_reason", "private-free-text"],
    ["foreground_ms", -1], ["inactive_ms", Infinity], ["interaction_engaged_ms", 101],
    ["duration_scope", "study_time"], ["engagement_policy", "guessed"], ["app_visibility", "background"],
  ] as const)("rejects invalid checkpoint %s without echoing rejected values", (key, value) => {
    const result = validateAnalyticsPayload("app_visit_checkpoint", { ...checkpoint, [key]: value });
    expect(result.analytics_payload_valid).toBe(false);
    expect(result.analytics_payload_invalid_keys?.split(",")).toContain(key);
    expect(JSON.stringify(result)).not.toContain("private-free-text");
  });

  it("requires route/state/screen IDs and the declared background terminal", () => {
    expect(validateAnalyticsPayload("screen_state_viewed", {
      ...screen, screen_visit_id: null, route_pattern: null, screen_name: "", view_state: null,
    }).analytics_payload_invalid_keys).toBe("screen_visit_id,route_pattern,screen_name,view_state");
    expect(validateAnalyticsPayload("app_visit_ended", {
      ...checkpoint, last_screen_visit_id: null, end_reason: "background",
    }).analytics_payload_invalid_keys).toBe("app_visibility");
  });

  it.each([
    ["feature", "paid"], ["training_session_id", null], ["question_id", null],
    ["ready_foreground_ms", 21], ["ready_wall_ms", NaN], ["ready_duration_scope", "foreground_observation"],
    ["ready_reason", "rendered_media"], ["media_readiness", "ready"],
  ] as const)("rejects incomplete or misinterpreted readiness %s", (key, value) => {
    expect(validateAnalyticsPayload("learning_screen_ready", { ...ready, [key]: value }).analytics_payload_valid).toBe(false);
  });

  it.each([
    ["training", "training_session_id"], ["exam", "exam_session_id"],
    ["sign_test", "sign_test_session_id"], ["sign_practice", "sign_test_session_id"],
  ] as const)("requires the actual session key for %s, not a different feature's session", (feature, sessionKey) => {
    const p: AnalyticsProperties = { ...ready, feature, [sessionKey]: "session" };
    expect(validateAnalyticsPayload("learning_screen_ready", p).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("learning_screen_ready", { ...p, [sessionKey]: null }).analytics_payload_valid).toBe(false);
  });

  it("keeps foreground-return readiness scoped separately", () => {
    expect(validateAnalyticsPayload("learning_screen_ready", {
      ...ready, ready_reason: "foreground_return", ready_duration_scope: "foreground_observation",
    }).analytics_payload_valid).toBe(true);
  });

  it.each([
    ["access_source", "paid"], ["access_source", "none"], ["previous_is_plus", false], ["previous_access_source", "none"],
  ] as const)("rejects inconsistent access snapshot %s", (key, value) => {
    expect(validateAnalyticsPayload("access_state_changed", { ...access, [key]: value }).analytics_payload_valid).toBe(false);
  });

  it("requires an actual previous snapshot for a state-change observation", () => {
    expect(validateAnalyticsPayload("access_state_changed", {
      ...access, observation_reason: "state_change",
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("access_state_changed", {
      ...access, observation_reason: "state_change", previous_is_plus: false, previous_access_source: "none",
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("access_state_changed", {
      ...access, observation_reason: "state_change", previous_is_plus: true, previous_access_source: "none",
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("access_state_changed", {
      ...access, is_plus: false, access_source: "none",
    }).analytics_payload_valid).toBe(true);
  });
});
