import type { AnalyticsEventName, AnalyticsProperties } from "./catalog";
import { operationPayloadIssues } from "./operation-payload-validation";
import { learningInteractionIssues } from "./learning-interaction-validation";

export function analyticsTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const parsed = Date.parse(value);
  if (!match || !Number.isFinite(parsed) || Number(value.slice(0, 4)) < 1
    || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const date = new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? parsed : null;
}

/** Semantic observation QA never participates in product state or capture eligibility. */
export function criticalPayloadIssues(event: AnalyticsEventName, p: AnalyticsProperties) {
  const issues = new Set<string>([...operationPayloadIssues(event, p), ...learningInteractionIssues(event, p)]);
  const reject = (key: string) => { issues.add(key); };
  const boolMismatch = (key: string, expected: boolean) => { if (p[key] !== expected) reject(key); };
  const occurred = analyticsTimestamp(p.client_occurred_at);
  const clock = (key: string) => {
    const value = analyticsTimestamp(p[key]);
    if (value === null || (occurred !== null && value > occurred)) reject(key);
    return value;
  };
  const maxCount = (key: string, ceiling: string) => {
    if (typeof p[key] === "number" && typeof p[ceiling] === "number" && p[key] > p[ceiling]) reject(key);
  };
  if (["app_visit_started", "app_visit_checkpoint", "screen_visit_checkpoint", "screen_state_viewed"].includes(event)) {
    if (p.app_visibility !== "active") reject("app_visibility");
  }
  if (event === "screen_visit_started" && p.start_reason === "foreground" && p.app_visibility !== "active") {
    reject("app_visibility");
  }
  if (event === "app_visit_ended" || (event === "screen_visit_ended" && p.end_reason === "background")) {
    if (p.app_visibility !== "background") reject("app_visibility");
  }
  if (event.startsWith("app_visit_") || event.startsWith("screen_visit_")) {
    maxCount("interaction_engaged_ms", "foreground_ms");
    if (typeof p.checkpoint_index === "number" && p.checkpoint_index < 1) reject("checkpoint_index");
    // Lifecycle wall and foreground clocks differ; wall-clock jumps are not impossible foreground evidence.
  }
  if (event === "learning_screen_ready") {
    maxCount("ready_foreground_ms", "ready_wall_ms");
    const expectedScope = p.ready_reason === "foreground_return" ? "foreground_observation" : "current_focus_entry";
    if (p.ready_duration_scope !== expectedScope) reject("ready_duration_scope");
  }
  if (event === "access_state_changed") {
    if ((p.access_source === "none") !== (p.is_plus === false)) reject("access_source");
    if (p.observation_reason === "initial_snapshot") {
      if (p.previous_is_plus !== null) reject("previous_is_plus");
      if (p.previous_access_source !== null) reject("previous_access_source");
    } else if (p.observation_reason === "state_change") {
      if (typeof p.previous_is_plus !== "boolean") reject("previous_is_plus");
      if (p.previous_access_source === null) reject("previous_access_source");
      else if ((p.previous_access_source === "none") !== (p.previous_is_plus === false)) reject("previous_access_source");
    }
  }
  if (event === "purchase_succeeded") boolMismatch("native_purchase_completed", true);
  if (event === "purchase_started" && p.step !== "purchase_package") reject("step");
  if (event === "purchase_attempt_recovered") boolMismatch("resumed_after_restart", true);
  if (event === "purchase_pending" && !["payment_pending", "already_owned", "entitlement_not_yet_active"].includes(String(p.confirmation_reason))) {
    reject("confirmation_reason");
  }
  if (event === "purchase_outcome_unknown" && !["store_problem", "network", "unknown"].includes(String(p.confirmation_reason))) {
    reject("confirmation_reason");
  }
  if (["purchase_restore_succeeded", "purchase_restore_empty", "restore_succeeded"].includes(event)) {
    if (p.restore_outcome === "restored") boolMismatch("entitlement_active", true);
    else if (p.restore_outcome === "empty") boolMismatch("entitlement_active", false);
  }
  if (event.startsWith("paywall_trial_eligibility_")) {
    maxCount("eligibility_distinct_product_count", "eligibility_requested_product_count");
    if ((p.eligibility_requested_product_count === 0) !== (p.eligibility_distinct_product_count === 0)) {
      reject("eligibility_distinct_product_count");
    }
    if (p.eligibility_view_visible === true) boolMismatch("eligibility_observer_active", true);
    const ios = p.eligibility_platform === "ios";
    if (p.eligibility_native_query_invoked === true && !ios) reject("eligibility_native_query_invoked");
    if (event.endsWith("_started")) clock("eligibility_started_at");
    if (event.endsWith("_resolved")) {
      const basis = p.eligibility_basis;
      if (p.eligibility_distinct_product_count === 0) reject("eligibility_distinct_product_count");
      if (basis === "request_error") {
        if (p.eligibility_outcome !== "error") reject("eligibility_outcome");
        if (p.eligibility_error_category === null) reject("eligibility_error_category");
        if (!ios) reject("eligibility_platform");
      } else {
        if (p.eligibility_error_category !== null) reject("eligibility_error_category");
        if (basis === "revenuecat_ios_status") {
          if (!["eligible", "ineligible", "no_intro_offer"].includes(String(p.eligibility_outcome))) reject("eligibility_outcome");
          boolMismatch("eligibility_native_query_invoked", true);
          if (!ios) reject("eligibility_platform");
        } else if (["sdk_status_unknown", "missing_product_response"].includes(String(basis))) {
          if (p.eligibility_outcome !== "unknown") reject("eligibility_outcome");
          boolMismatch("eligibility_native_query_invoked", true);
          if (!ios) reject("eligibility_platform");
        } else if (basis === "unsupported_platform" || basis === "not_configured") {
          if (p.eligibility_outcome !== "unknown") reject("eligibility_outcome");
          boolMismatch("eligibility_native_query_invoked", false);
          if ((basis === "not_configured") !== ios) reject("eligibility_platform");
        }
      }
    }
    if (event.endsWith("_completed")) {
      if (p.eligibility_resolved_product_count !== p.eligibility_distinct_product_count) reject("eligibility_resolved_product_count");
      const outcome = p.eligibility_request_outcome;
      if (outcome === "no_products") {
        if (p.eligibility_distinct_product_count !== 0) reject("eligibility_distinct_product_count");
        boolMismatch("eligibility_native_query_invoked", false);
      } else if (p.eligibility_distinct_product_count === 0) reject("eligibility_distinct_product_count");
      if (outcome === "error") {
        if (p.eligibility_error_category === null) reject("eligibility_error_category");
        if (!ios) reject("eligibility_platform");
      } else {
        if (p.eligibility_error_category !== null) reject("eligibility_error_category");
        if (outcome === "resolved") {
          boolMismatch("eligibility_native_query_invoked", true);
          if (!ios) reject("eligibility_platform");
        } else if (outcome === "unsupported" || outcome === "not_configured") {
          boolMismatch("eligibility_native_query_invoked", false);
          if ((outcome === "not_configured") !== ios) reject("eligibility_platform");
        }
      }
    }
  }
  if (event === "training_session_completed" || event === "exam_session_completed") {
    maxCount("answered_count", "question_total");
    maxCount("correct_count", "answered_count");
    maxCount("accepted_unique_question_count", "question_total");
    maxCount("accepted_unique_question_count", "answered_count");
    const wrong = event === "training_session_completed" ? "incorrect_count" : "wrong_count";
    maxCount(wrong, "answered_count");
    if (typeof p.correct_count === "number" && typeof p[wrong] === "number" && typeof p.answered_count === "number"
      && p.correct_count + p[wrong] > p.answered_count) reject("answered_count");
    if (typeof p.score_percent === "number" && p.score_percent > 100) reject("score_percent");
    maxCount("score_points", "total_points_target");
  }
  if (p.onboarding_observation_version !== undefined) {
    const started = clock("onboarding_started_at");
    const completed = p.onboarding_completed_at === null ? null : clock("onboarding_completed_at");
    const home = p.onboarding_home_observed_at === null ? null : clock("onboarding_home_observed_at");
    if (started !== null && completed !== null && completed < started) reject("onboarding_completed_at");
    if (home !== null && (completed === null || home < completed)) reject("onboarding_home_observed_at");
  }
  if (event === "onboarding_flow_completed") clock("onboarding_completed_at");
  if (event === "onboarding_home_arrived") {
    const completed = clock("onboarding_completed_at"), home = clock("onboarding_home_observed_at");
    if (completed !== null && home !== null && home < completed) reject("onboarding_home_observed_at");
  }
  if (event === "install_observation_resolved") clock("first_observed_at");
  for (const namespace of ["paywall_origin", "checkout_origin"]) {
    if (p[`${namespace}_status`] === "observed") clock(`${namespace}_at`);
  }
  return [...issues];
}
