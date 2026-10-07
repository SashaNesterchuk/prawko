import { analyticsActivity } from "../activity";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { ActivityEventPayloads, AccessStatePayload, LearningReadyPayload } from "../activity-payloads";
import { APP_VISIBILITIES, ACCESS_SOURCES } from "../activity-payloads";
import { ANALYTICS_PAYLOAD_CONTRACTS } from "../payload-contract";

type AssertNever<T extends never> = T;
type Payloads = ActivityEventPayloads & {
  learning_screen_ready: LearningReadyPayload; access_state_changed: AccessStatePayload;
};
type Names = AssertNever<Exclude<keyof Payloads, keyof typeof ANALYTICS_PAYLOAD_CONTRACTS>>;
type ReadySessionContract = AssertNever<Exclude<LearningReadyPayload["feature"], "training" | "exam" | "sign_test" | "sign_practice">>;
export type ActivityContractCoverage = [Names, ReadySessionContract];

void function activityCaptureSignatures(track: AnalyticsTrack) {
  track("app_visit_started", { app_visit_id: "v", app_visibility: "active", start_reason: "runtime_start", previous_visibility: "unknown" });
  track("screen_state_viewed", { app_visit_id: "v", screen_visit_id: "s", route_pattern: "/learn",
    screen_name: "learn", view_state: "loading", app_visibility: "active" });
  track("learning_screen_ready", { feature: "training", training_session_id: null, question_id: null,
    ready_foreground_ms: 0, ready_wall_ms: 0, ready_reason: "focused_ready",
    ready_duration_scope: "current_focus_entry", media_readiness: "not_measured" });
  track("access_state_changed", { observation_reason: "initial_snapshot", previous_is_plus: null,
    previous_access_source: null, is_plus: true, access_source: "school" });
  // @ts-expect-error Activity capture cannot bypass required scoped payloads.
  analyticsActivity.capture("app_visit_started", {});
  // @ts-expect-error The screen must carry its own screen visit, route and state.
  track("screen_state_viewed", { app_visit_id: "v", app_visibility: "active" });
  // @ts-expect-error Checkpoint counters and clock policy cannot be omitted.
  track("app_visit_checkpoint", { app_visit_id: "v", app_visibility: "active", checkpoint_index: 1 });
  // @ts-expect-error Readiness needs the corresponding training session, not an exam ID.
  track("learning_screen_ready", { feature: "training", exam_session_id: "e", question_id: "q",
    ready_foreground_ms: 0, ready_wall_ms: 0, ready_reason: "focused_ready",
    ready_duration_scope: "current_focus_entry", media_readiness: "not_measured" });
  track("access_state_changed", { observation_reason: "initial_snapshot", previous_is_plus: null,
    // @ts-expect-error Access observation is not a charge or trial.
    previous_access_source: null, is_plus: true, access_source: "paid" });
  for (const visibility of APP_VISIBILITIES) {
    track("app_visit_started", { app_visit_id: "v", app_visibility: "active", start_reason: "runtime_start", previous_visibility: visibility });
  }
  for (const source of ACCESS_SOURCES) {
    track("access_state_changed", { observation_reason: "state_change", previous_is_plus: false,
      previous_access_source: "none", is_plus: true, access_source: source });
  }
};
