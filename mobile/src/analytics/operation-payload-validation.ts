import type { AnalyticsEventName, AnalyticsProperties } from "./catalog";

/** Checks observation meanings only, never whether an operation may run. */
export function operationPayloadIssues(event: AnalyticsEventName, p: AnalyticsProperties) {
  const issues: string[] = [];
  const reject = (key: string) => { issues.push(key); };
  if (event === "notification_schedule_resolved") {
    if (p.outcome === "enabled" && p.enabled !== true) reject("enabled");
    if (["disabled", "permission_denied"].includes(String(p.outcome)) && p.enabled !== false) reject("enabled");
    if (p.outcome === "permission_denied" && p.operation !== "enable") reject("operation");
    if (p.operation === "disable" && !["disabled", "failed"].includes(String(p.outcome))) reject("outcome");
    if (p.outcome === "failed" && p.error_code === undefined) reject("error_code");
    if (p.outcome !== "failed" && p.error_code !== undefined) reject("error_code");
  }
  if (event === "notification_permission_resolved") {
    if (p.error_code !== undefined) {
      if (p.enabled !== false) reject("enabled");
      if (p.can_ask_again !== undefined) reject("can_ask_again");
    } else if (p.enabled === true && p.can_ask_again !== null) reject("can_ask_again");
    else if (p.enabled === false && typeof p.can_ask_again !== "boolean") reject("can_ask_again");
  }
  if (event === "screen_viewed" && p.screen_observation_scope === "route") {
    if (p.flow_context === "onboarding") {
      if (!["pending", "resolved"].includes(String(p.onboarding_observation_state))) reject("onboarding_observation_state");
      if (p.onboarding_observation_state === "resolved" && p.onboarding_attempt_id === null) reject("onboarding_attempt_id");
      if (p.onboarding_observation_state === "pending" && p.onboarding_attempt_id !== null) reject("onboarding_attempt_id");
    } else {
      if (p.onboarding_observation_state !== "not_applicable") reject("onboarding_observation_state");
      if (p.onboarding_attempt_id !== null) reject("onboarding_attempt_id");
    }
  }
  if (event === "screen_viewed" && p.screen_observation_scope === "inline_review") {
    if (p.route_pattern !== "/exam/answers") reject("route_pattern");
    if (p.screen_name !== "exam_answers") reject("screen_name");
  }
  if (event === "learning_intent_requested" && p.mode === null && p.feature !== "sign_test") reject("mode");
  if (event === "offline_pack_download_failed" && p.operation !== undefined && p.operation !== "remove") reject("operation");
  return issues;
}
