import type { DrivingCategory, QuestionSessionMode } from "@prawko/config";
import type { ExamSimulatorMode } from "../features/exam/types";

export const NOTIFICATION_SCHEDULE_OPERATIONS = ["enable", "disable", "sync"] as const;
export const NOTIFICATION_SCHEDULE_OUTCOMES = ["enabled", "disabled", "permission_denied", "failed"] as const;
export const NOTIFICATION_PERMISSION_SOURCES = ["profile", "onboarding", "initial_diagnostic"] as const;
export const OFFLINE_PACK_STATES = [
  "access_blocked", "loading", "downloading", "incomplete", "ready", "other_category", "missing",
] as const;
export const LEARNING_OPERATIONS = [
  "load_snapshot", "submit_answer", "navigate_question", "toggle_flag", "finish_session", "end_session",
  "discard_empty_session", "offline_snapshot", "load_review", "load_result", "open_review", "sync_answer",
] as const;
export type LearningOperationName = typeof LEARNING_OPERATIONS[number];
export type LearningIntentContext = {
  mode: QuestionSessionMode | ExamSimulatorMode | null;
  question_limit?: number | null;
  roadmap_step_id?: string | null;
  topic_id?: string | null;
};
export type LearningFailureContext = { user_visible: boolean; operation_id?: string | null };
export type NotificationSchedulePayload = {
  operation_id: string;
  operation: typeof NOTIFICATION_SCHEDULE_OPERATIONS[number];
  outcome: typeof NOTIFICATION_SCHEDULE_OUTCOMES[number];
  reminder_kind: "study_daily";
  request_duration_ms: number;
  scheduled_count: number;
  enabled: boolean;
  confirmation_scope: "helper_result_not_delivery";
  error_code?: string;
};
type OfflineScope = { operation_id: string; category: DrivingCategory };
export type OfflineDownloadTerminal = OfflineScope & {
  question_count: number;
  operation_duration_ms: number;
  downloaded_asset_count: number | null;
  downloaded_bytes: number | null;
  operation_stage: "download" | "refresh_metadata";
};
export type OfflineDownloadFailure = OfflineDownloadTerminal & {
  // A falsy thrown value is still an observation; final QA requires a normalized error.
  error_code?: string;
};
export type OfflineRemoveFailure = OfflineScope & { operation: "remove"; error_code: string };
type ResetScope = { source: "profile"; reset_operation_id: string };
export type RouteScreenViewedPayload = {
  screen_observation_scope: "route";
  route_pattern: string;
  screen_name: string;
  route_entity_id: string | null;
  flow_context: "onboarding" | "settings" | "product";
  onboarding_attempt_id: string | null;
  onboarding_observation_state: "resolved" | "pending" | "not_applicable";
  learning_intent_id: string | null;
};
export type InlineReviewScreenViewedPayload = {
  screen_observation_scope: "inline_review";
  route_pattern: "/exam/answers";
  screen_name: "exam_answers";
  exam_session_id: string;
};

export type OperationEventPayloads = {
  learning_intent_requested: LearningIntentContext & { learning_intent_id: string };
  learning_operation_failed: LearningFailureContext & {
    operation_id: string | null;
    operation_id_source: "existing_operation" | "failure_observation";
    operation: LearningOperationName;
    error_code: string;
  };
  screen_viewed: RouteScreenViewedPayload | InlineReviewScreenViewedPayload;
  notification_schedule_resolved: NotificationSchedulePayload;
  notification_permission_requested: { source: typeof NOTIFICATION_PERMISSION_SOURCES[number] };
  notification_permission_resolved: {
    source: typeof NOTIFICATION_PERMISSION_SOURCES[number];
    enabled: boolean;
    can_ask_again?: boolean | null;
    error_code?: string;
  };
  offline_pack_state_viewed: {
    pack_state: typeof OFFLINE_PACK_STATES[number];
    category: DrivingCategory;
    downloaded_category: DrivingCategory | null;
    catalog_matches: boolean | null;
    question_count: number | null;
    operation_id: string | null;
  };
  offline_pack_download_started: OfflineScope & { question_count: number; action: "resume" | "update" | "download" };
  offline_pack_download_completed: OfflineDownloadTerminal;
  offline_pack_download_cancelled: OfflineDownloadTerminal;
  offline_pack_download_failed: OfflineDownloadFailure | OfflineRemoveFailure;
  offline_pack_cancel_requested: { operation_id: string | null; category: DrivingCategory; source: "stop_button" };
  offline_pack_removed: OfflineScope;
  progress_reset_started: ResetScope;
  progress_reset_failed: ResetScope & { error_code: string };
  progress_reset_confirmed: ResetScope & { completion_scope: "helper_resolved_best_effort_cleanup" };
};
