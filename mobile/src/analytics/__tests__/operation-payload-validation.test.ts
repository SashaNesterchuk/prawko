import { validateAnalyticsPayload } from "../payload-contract";

const offline = { operation_id: "offline-1", category: "B" };
const terminal = { ...offline, question_count: 10, operation_duration_ms: 100,
  downloaded_asset_count: null, downloaded_bytes: null, operation_stage: "download" };
const schedule = { operation_id: "notification-1", operation: "enable", outcome: "enabled",
  reminder_kind: "study_daily", request_duration_ms: 10, scheduled_count: 1, enabled: true,
  confirmation_scope: "helper_result_not_delivery" };
const reset = { reset_operation_id: "reset-1", source: "profile" };
const route = { screen_observation_scope: "route", route_pattern: "/learn", screen_name: "learn",
  route_entity_id: null, flow_context: "product", onboarding_attempt_id: null,
  onboarding_observation_state: "not_applicable", learning_intent_id: null };

describe("operation payload QA", () => {
  it.each([
    ["learning_intent_requested", { learning_intent_id: "intent-1", mode: "learning" }],
    ["learning_operation_failed", { operation_id: "op-1", operation_id_source: "existing_operation",
      operation: "sync_answer", error_code: "network", user_visible: false }],
    ["screen_viewed", route],
    ["notification_schedule_resolved", schedule],
    ["notification_permission_requested", { source: "profile" }],
    ["notification_permission_resolved", { source: "profile", enabled: true, can_ask_again: null }],
    ["offline_pack_state_viewed", { ...offline, pack_state: "loading", downloaded_category: null, catalog_matches: null, question_count: null }],
    ["offline_pack_download_started", { ...offline, question_count: 10, action: "resume" }],
    ["offline_pack_download_completed", terminal],
    ["offline_pack_download_cancelled", terminal],
    ["offline_pack_download_failed", { ...terminal, error_code: "storage" }],
    ["offline_pack_cancel_requested", { ...offline, operation_id: null, source: "stop_button" }],
    ["offline_pack_removed", offline],
    ["progress_reset_started", reset],
    ["progress_reset_failed", { ...reset, error_code: "storage" }],
    ["progress_reset_confirmed", { ...reset, completion_scope: "helper_resolved_best_effort_cleanup" }],
  ] as const)("defines the actual fields of %s", (event, p) => {
    expect(validateAnalyticsPayload(event, p)).toMatchObject({
      analytics_payload_valid: true, analytics_payload_contract_status: "valid", analytics_payload_contract_version: 2,
    });
  });

  it.each([
    ["operation", "schedule"], ["outcome", "delivered"], ["enabled", false], ["scheduled_count", 0.5],
    ["request_duration_ms", -1], ["confirmation_scope", "os_delivered"], ["error_code", "private-error"],
  ] as const)("rejects an inconsistent schedule %s", (key, value) => {
    const result = validateAnalyticsPayload("notification_schedule_resolved", { ...schedule, [key]: value });
    expect(result.analytics_payload_valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-error");
  });

  it("preserves sync/disabled and failed-with-existing-schedule without inventing permission or delivery", () => {
    expect(validateAnalyticsPayload("notification_schedule_resolved", {
      ...schedule, operation: "sync", outcome: "disabled", enabled: false, scheduled_count: 1,
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("notification_schedule_resolved", {
      ...schedule, operation: "sync", outcome: "permission_denied", enabled: false,
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("notification_schedule_resolved", {
      ...schedule, outcome: "failed", error_code: "network",
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("notification_schedule_resolved", {
      ...schedule, outcome: "failed",
    }).analytics_payload_valid).toBe(false);
  });

  it("validates permission fields only when present and keeps success/denial/error distinct", () => {
    expect(validateAnalyticsPayload("notification_permission_resolved", { source: "onboarding", enabled: false, can_ask_again: false })
      .analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("notification_permission_resolved", { source: "initial_diagnostic", enabled: false, error_code: "network" })
      .analytics_payload_valid).toBe(true);
    for (const p of [
      { source: "profile", enabled: true, can_ask_again: "private" },
      { source: "profile", enabled: false }, { source: "profile", enabled: true, error_code: "network" },
      { source: "profile", enabled: false, error_code: null }, { source: "profile", enabled: false, can_ask_again: null },
    ]) expect(validateAnalyticsPayload("notification_permission_resolved", p).analytics_payload_valid).toBe(false);
  });

  it("accepts remove failure without fabricating transfer duration or counts", () => {
    const p = { ...offline, operation: "remove", error_code: "storage" };
    expect(validateAnalyticsPayload("offline_pack_download_failed", p).analytics_payload_valid).toBe(true);
    expect(p).not.toHaveProperty("operation_duration_ms");
    expect(validateAnalyticsPayload("offline_pack_download_failed", { ...p, operation: "other" }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("offline_pack_download_completed", p).analytics_payload_valid).toBe(false);
  });

  it.each([
    ["question_count", 1.5], ["operation_duration_ms", -1], ["downloaded_asset_count", 0.1],
    ["downloaded_bytes", Infinity], ["operation_stage", "deleted"], ["category", "paid"],
  ] as const)("rejects invalid download terminal %s", (key, value) => {
    expect(validateAnalyticsPayload("offline_pack_download_completed", { ...terminal, [key]: value }).analytics_payload_valid).toBe(false);
  });

  it("does not treat a cancellation request with an unknown operation ID as a cancellation outcome", () => {
    expect(validateAnalyticsPayload("offline_pack_cancel_requested", {
      operation_id: null, category: "B", source: "stop_button",
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("offline_pack_download_cancelled", {
      ...terminal, operation_id: null,
    }).analytics_payload_valid).toBe(false);
  });

  it("retains nullable pack observations and limits reset completion to the actual helper scope", () => {
    expect(validateAnalyticsPayload("offline_pack_state_viewed", {
      category: "B", pack_state: "loading", operation_id: null,
      downloaded_category: null, catalog_matches: null, question_count: null,
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("progress_reset_confirmed", {
      ...reset, completion_scope: "all_storage_deleted",
    }).analytics_payload_valid).toBe(false);
  });

  it("requires mode-specific intent evidence and checks optional route metadata without changing it", () => {
    const intent = { learning_intent_id: "i", mode: "learning" };
    expect(validateAnalyticsPayload("learning_intent_requested", {
      ...intent, question_limit: null, roadmap_step_id: null, topic_id: null,
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("learning_intent_requested", {
      ...intent, mode: null, feature: "sign_test",
    }).analytics_payload_valid).toBe(true);
    for (const p of [
      { ...intent, mode: null }, { ...intent, mode: "quarter" },
      { ...intent, question_limit: NaN }, { ...intent, question_limit: 0.5 }, { ...intent, roadmap_step_id: false },
    ]) expect(validateAnalyticsPayload("learning_intent_requested", p).analytics_payload_valid).toBe(false);
  });

  it("keeps pending onboarding screens distinct from resolved attempts", () => {
    const p = { ...route, flow_context: "onboarding", onboarding_observation_state: "pending" };
    expect(validateAnalyticsPayload("screen_viewed", p).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, onboarding_observation_state: "resolved" }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, onboarding_observation_state: "resolved", onboarding_attempt_id: "a" })
      .analytics_payload_valid).toBe(true);
  });

  it("does not require or inherit route/onboarding proof for an inline exam review", () => {
    const p = { screen_observation_scope: "inline_review", route_pattern: "/exam/answers", screen_name: "exam_answers", exam_session_id: "e" };
    expect(validateAnalyticsPayload("screen_viewed", p).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, flow_context: "product", route_entity_id: "old-route" })
      .analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, exam_session_id: null }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, route_pattern: "/learn" }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("screen_viewed", { ...p, screen_name: "learn" }).analytics_payload_valid).toBe(false);
  });
});
