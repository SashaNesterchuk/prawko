import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import { QUESTION_SESSION_MODES } from "@prawko/config";
import {
  ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS, ANALYTICS_PAYLOAD_CONTRACTS,
} from "../payload-contract";
import type {
  InlineReviewScreenViewedPayload, LearningIntentContext, OfflineDownloadFailure, OfflineRemoveFailure, RouteScreenViewedPayload,
} from "../operation-payloads";
import { createLearningIntent, reportLearningOperationFailure } from "../operations";

type AssertNever<T extends never> = T;
type RequiredKeys<T> = { [Key in keyof T]-?: {} extends Pick<T, Key> ? never : Key }[keyof T];
type FailureRules = typeof ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS.offline_pack_download_failed;
type ScreenRules = typeof ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS.screen_viewed;
type Download = AssertNever<Exclude<RequiredKeys<OfflineDownloadFailure>,
  keyof FailureRules["download"] | keyof typeof ANALYTICS_PAYLOAD_CONTRACTS.offline_pack_download_failed>>;
type Remove = AssertNever<Exclude<RequiredKeys<OfflineRemoveFailure>,
  keyof FailureRules["remove"] | keyof typeof ANALYTICS_PAYLOAD_CONTRACTS.offline_pack_download_failed>>;
type Route = AssertNever<Exclude<RequiredKeys<RouteScreenViewedPayload>,
  keyof ScreenRules["route"] | keyof typeof ANALYTICS_PAYLOAD_CONTRACTS.screen_viewed>>;
type Inline = AssertNever<Exclude<RequiredKeys<InlineReviewScreenViewedPayload>,
  keyof ScreenRules["inline_review"] | keyof typeof ANALYTICS_PAYLOAD_CONTRACTS.screen_viewed>>;
type IntentModes = AssertNever<Exclude<NonNullable<LearningIntentContext["mode"]>, typeof QUESTION_SESSION_MODES[number]>>;
export type OperationConditionalCoverage = [Download, Remove, Route, Inline, IntentModes];

void function operationSignatures(track: AnalyticsTrack) {
  track("notification_schedule_resolved", { operation_id: "o", operation: "enable", outcome: "enabled",
    reminder_kind: "study_daily", request_duration_ms: 10, scheduled_count: 1, enabled: true,
    confirmation_scope: "helper_result_not_delivery" });
  track("notification_permission_resolved", { source: "profile", enabled: false, error_code: "network" });
  track("offline_pack_download_failed", { operation_id: "o", category: "B", operation: "remove", error_code: "storage" });
  track("offline_pack_cancel_requested", { operation_id: null, category: "B", source: "stop_button" });
  track("screen_viewed", { screen_observation_scope: "inline_review", route_pattern: "/exam/answers",
    screen_name: "exam_answers", exam_session_id: "e" });
  track("screen_viewed", { screen_observation_scope: "route", route_pattern: "/learn", screen_name: "learn",
    route_entity_id: null, flow_context: "product", onboarding_attempt_id: null,
    onboarding_observation_state: "not_applicable", learning_intent_id: null });
  createLearningIntent({ mode: "learning", source: "roadmap" });
  reportLearningOperationFailure(track, "sync_answer", new Error("private"), { user_visible: false });
  // @ts-expect-error A successful reset is helper acceptance, not proof of a physical wipe.
  track("progress_reset_confirmed", { reset_operation_id: "r", source: "profile", completion_scope: "all_storage_deleted" });
  // @ts-expect-error A reset failure must identify its operation and normalized error.
  track("progress_reset_failed", { source: "profile", error_code: "network" });
  // @ts-expect-error Download completion cannot be replaced by a removal scope.
  track("offline_pack_download_completed", { operation_id: "o", category: "B", operation: "remove" });
  // @ts-expect-error Schedule results do not prove OS delivery.
  track("notification_schedule_resolved", { operation_id: "o", operation: "enable", outcome: "delivered",
    reminder_kind: "study_daily", request_duration_ms: 1, scheduled_count: 1, enabled: true, confirmation_scope: "helper_result_not_delivery" });
  // @ts-expect-error Arbitrary operation names cannot masquerade as known learning failures.
  reportLearningOperationFailure(track, "paid_exam_gate", {}, { user_visible: false });
  // @ts-expect-error User-visible vs background failure remains explicit.
  reportLearningOperationFailure(track, "sync_answer", {}, {});
  // @ts-expect-error An intent has a mode; a source alone is not enough.
  createLearningIntent({ source: "roadmap" });
  // @ts-expect-error Inline review scope cannot be used for an unrelated route.
  track("screen_viewed", { screen_observation_scope: "inline_review", route_pattern: "/learn", screen_name: "learn", exam_session_id: "e" });
};
