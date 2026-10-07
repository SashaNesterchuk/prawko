import type { AnalyticsEventName, AnalyticsProperties } from "../catalog";
import { analyticsTimestamp } from "../critical-payload-validation";
import { validateAnalyticsPayload } from "../payload-contract";

function validate(event: AnalyticsEventName, properties: AnalyticsProperties) {
  return validateAnalyticsPayload(event, properties);
}
const checkout = { purchase_attempt_id: "purchase-one", checkout_view_id: "view-one" };
const restore = { restore_attempt_id: "restore-one", checkout_view_id: "view-one" };
const eligible = {
  paywall_view_id: "view-one", eligibility_request_id: "request-one", trial_eligibility_observation_version: 1,
  eligibility_scope: "request_not_display", eligibility_requested_product_count: 1,
  eligibility_distinct_product_count: 1, eligibility_observer_active: true, eligibility_view_visible: true,
  eligibility_platform: "ios", eligibility_product_id: "sku-one",
  eligibility_outcome: "eligible", eligibility_basis: "revenuecat_ios_status",
  eligibility_native_query_invoked: true, eligibility_error_category: null,
};
const training = {
  training_session_id: "training-one", mode: "learning", learning_outcome_rule_version: "learning-v1",
  answered_count: 5, accepted_unique_question_count: 5, correct_count: 4, incorrect_count: 1,
  passed: true, question_total: 5, score_percent: 80,
};
const exam = {
  exam_session_id: "exam-one", mode: "exam", learning_outcome_rule_version: "learning-v1",
  completion_status: "completed", answered_count: 32, correct_count: 30, wrong_count: 2,
  passed: true, question_total: 32, score_points: 70, total_points_target: 74,
};

describe("critical payload acceptance v2", () => {
  it("requires complete native/confirmation metadata without inventing money", () => {
    expect(validate("purchase_started", { ...checkout, product_id: "sku", ui: "package", step: "purchase_package" }))
      .toMatchObject({ analytics_payload_contract_version: 2, analytics_payload_valid: true });
    expect(validate("purchase_succeeded", {
      ...checkout, product_id: "sku", transaction_id: null, confirmation_source: "purchase_result",
      native_purchase_completed: true,
    }).analytics_payload_valid).toBe(true);
    expect(validate("purchase_access_confirmed", {
      ...checkout, product_id: "sku", transaction_id: null, confirmation_source: "customer_info",
      native_purchase_completed: false,
    }).analytics_payload_valid).toBe(true);
  });

  it.each([
    ["purchase_started", { ...checkout, product_id: null, ui: "package", step: "purchase_package" }],
    ["purchase_started", { ...checkout, product_id: "sku", ui: "package", step: "persist_checkout" }],
    ["purchase_succeeded", { ...checkout, product_id: "sku", transaction_id: null,
      confirmation_source: "purchase_result", native_purchase_completed: false }],
    ["purchase_pending", { ...checkout, transaction_id: null, confirmation_reason: "network" }],
    ["purchase_outcome_unknown", { ...checkout, transaction_id: null, confirmation_reason: "payment_pending" }],
    ["purchase_attempt_recovered", { ...checkout, previous_status: "purchasing", resumed_after_restart: false }],
    ["purchase_preparation_failed", { ...checkout, error_category: "private-store-error" }],
  ] as const)("rejects inconsistent %s while retaining only contract keys", (event, properties) => {
    const result = validate(event, properties);
    expect(result.analytics_payload_valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-store-error");
  });

  it.each([
    ["purchase_restore_started", { ...restore, restore_outcome: "started" }],
    ["purchase_restore_succeeded", { ...restore, restore_outcome: "restored", entitlement_active: true }],
    ["purchase_restore_empty", { ...restore, restore_outcome: "empty", entitlement_active: false }],
    ["restore_succeeded", { ...restore, restore_outcome: "empty", entitlement_active: false }],
    ["purchase_restore_failed", { ...restore, restore_outcome: "failed", entitlement_active: true, error_category: "network" }],
  ] as const)("preserves independent restore meaning for %s", (event, properties) => {
    expect(validate(event, properties).analytics_payload_valid).toBe(true);
  });

  it.each([
    ["purchase_restore_succeeded", { ...restore, restore_outcome: "empty", entitlement_active: false }],
    ["purchase_restore_empty", { ...restore, restore_outcome: "restored", entitlement_active: true }],
    ["restore_succeeded", { ...restore, restore_outcome: "empty", entitlement_active: true }],
    ["restore_failed", { ...restore, restore_outcome: "failed", entitlement_active: null, error_category: "network" }],
  ] as const)("rejects conflicting restore scope/outcome for %s", (event, properties) => {
    expect(validate(event, properties).analytics_payload_valid).toBe(false);
  });

  it.each([
    ["eligibility_outcome", "unknown"], ["eligibility_error_category", "network"],
    ["eligibility_platform", "android"], ["eligibility_native_query_invoked", false],
    ["eligibility_basis", "pending"], ["eligibility_distinct_product_count", 1.5],
    ["eligibility_requested_product_count", 0], ["eligibility_observer_active", false],
  ] as const)("rejects malformed SDK outcome evidence: %s", (key, value) => {
    expect(validate("paywall_trial_eligibility_resolved", { ...eligible, [key]: value }).analytics_payload_valid).toBe(false);
  });

  it("keeps unknown Android eligibility independent of shown-trial metadata", () => {
    expect(validate("paywall_trial_eligibility_resolved", {
      ...eligible, eligibility_platform: "android", eligibility_native_query_invoked: false,
      eligibility_outcome: "unknown", eligibility_basis: "unsupported_platform", trial_shown: true,
    }).analytics_payload_valid).toBe(true);
  });

  it("does not let nullable rewarded diagnostics weaken actual load/impression IDs", () => {
    const scope = {
      ad_observation_version: 1, ad_format: "rewarded", ad_request_id: "request-one",
      ad_impression_id: "impression-one", ad_unit_basis: "test_unit",
      ad_native_load_observed: true, ad_opened_observed: false, placement: "exam_unlock",
    };
    expect(validate("ad_native_request_started", {
      ...scope, ad_request_basis: "sdk_load_invoked",
    }).analytics_payload_valid).toBe(true);
    expect(validate("ad_native_request_started", {
      ...scope, ad_request_id: null, ad_request_basis: "sdk_load_invoked",
    }).analytics_payload_valid).toBe(false);
    expect(validate("ad_impression_observed", {
      ...scope, ad_impression_id: null, ad_impression_basis: "sdk_paid_callback", ad_native_terminal_observed: false,
    }).analytics_payload_valid).toBe(false);
    expect(validate("ad_observation_failed", {
      ...scope, ad_request_id: null, ad_impression_id: null,
      observation_stage: "paid_payload", why: "observation_failed",
    }).analytics_payload_valid).toBe(true);
  });

  it("does not turn empty/skipped queries or mismatched terminal counts into native resolution", () => {
    const terminal = {
      ...eligible, eligibility_request_outcome: "resolved", eligibility_resolved_product_count: 1,
      eligibility_duration_ms: 2,
    };
    expect(validate("paywall_trial_eligibility_completed", terminal).analytics_payload_valid).toBe(true);
    expect(validate("paywall_trial_eligibility_completed", {
      ...terminal, eligibility_resolved_product_count: 0,
    }).analytics_payload_valid).toBe(false);
    expect(validate("paywall_trial_eligibility_completed", {
      ...terminal, eligibility_request_outcome: "no_products",
    }).analytics_payload_valid).toBe(false);
    expect(validate("paywall_trial_eligibility_completed", {
      ...terminal, eligibility_request_outcome: "no_products", eligibility_native_query_invoked: false,
      eligibility_resolved_product_count: 0, eligibility_distinct_product_count: 0, eligibility_requested_product_count: 0,
    }).analytics_payload_valid).toBe(true);
  });

  it("requires logical answer/revision meaning, not merely a correctness boolean", () => {
    expect(validate("exam_question_answered", {
      exam_session_id: "exam-one", question_id: "question-one", answer_id: "slot-one",
      answer_revision_id: "revision-one", answer_action: "update", is_correct: false,
    }).analytics_payload_valid).toBe(true);
    expect(validate("exam_question_answered", {
      exam_session_id: "exam-one", question_id: "question-one", is_correct: false,
    }).analytics_payload_valid).toBe(false);
  });

  it.each([
    ["answered_count", 6], ["accepted_unique_question_count", 6], ["correct_count", 6],
    ["incorrect_count", 6], ["score_percent", 101], ["question_total", 4.5],
    ["learning_outcome_rule_version", "guessed-rule"], ["mode", "raw-mode"],
  ] as const)("checks completion counters/rules: %s", (key, value) => {
    expect(validate("training_session_completed", { ...training, [key]: value }).analytics_payload_valid).toBe(false);
  });

  it("retains nonmeaningful but structurally valid outcomes instead of changing the learning rule", () => {
    expect(validate("training_session_completed", { ...training, accepted_unique_question_count: 4 }).analytics_payload_valid).toBe(true);
    expect(validate("exam_session_completed", { ...exam, completion_status: "expired" }).analytics_payload_valid).toBe(true);
    expect(validate("exam_session_completed", { ...exam, answered_count: 31, correct_count: 29 }).analytics_payload_valid).toBe(true);
    expect(validate("exam_session_completed", { ...exam, score_points: 75 }).analytics_payload_valid).toBe(false);
  });

  it.each([
    "2026-02-30T10:00:00Z", "2026-10-07T24:00:00Z", "2026-10-07T10:00:00",
    "October 7, 2026", "2026-10-07T10:60:00Z", "0000-10-07T10:00:00Z",
  ])("rejects ambiguous/normalized observation clock %s", (value) => {
    expect(analyticsTimestamp(value)).toBeNull();
  });

  it("orders declared onboarding clocks against each other and explicit occurrence only", () => {
    const home = {
      onboarding_attempt_id: "onboarding-one", onboarding_completed_at: "2026-10-07T10:01:00Z",
      onboarding_home_observed_at: "2026-10-07T10:02:00Z", home_arrival_basis: "foreground_route_observed",
      client_occurred_at: "2026-10-07T10:03:00Z",
    };
    expect(validate("onboarding_home_arrived", home).analytics_payload_valid).toBe(true);
    expect(validate("onboarding_home_arrived", {
      ...home, onboarding_home_observed_at: "2026-10-07T10:00:00Z",
    }).analytics_payload_valid).toBe(false);
    expect(validate("onboarding_home_arrived", {
      ...home, client_occurred_at: "2026-10-07T10:01:30Z",
    }).analytics_payload_valid).toBe(false);
  });
});
