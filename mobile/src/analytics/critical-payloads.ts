import type { QuestionSessionMode } from "@prawko/config";
import type { CheckoutStage, CheckoutStatus } from "../features/entitlements/checkout";
import type { RevenueCatCheckoutErrorKind } from "../features/entitlements/revenuecat-errors";
import type { RemoteExamSessionStatus, ExamSimulatorMode } from "../features/exam/types";
import type { ExternalEntryEventPayloads, RewardedObservationPayloads } from "./observation-payloads";
import type { AccessStatePayload, ActivityEventPayloads, LearningReadyPayload } from "./activity-payloads";
import type { OperationEventPayloads } from "./operation-payloads";
import type { LearningInteractionPayloads } from "./learning-interaction-payloads";

export const CHECKOUT_ERROR_CATEGORIES = [
  "cancelled", "payment_pending", "store_problem", "operation_in_progress", "already_owned",
  "network", "not_allowed", "invalid_purchase", "configuration", "unavailable",
  "receipt_in_use", "unknown", "local_storage",
] as const satisfies readonly RevenueCatCheckoutErrorKind[];
export const CHECKOUT_STEPS = [
  "get_customer_info", "get_offerings", "persist_checkout", "purchase_package", "restore_purchases",
] as const satisfies readonly CheckoutStage[];
export const CHECKOUT_STATUSES = [
  "purchasing", "restoring", "awaiting_confirmation", "outcome_unknown", "succeeded", "cancelled", "failed", "empty",
] as const satisfies readonly CheckoutStatus[];

export type OfferScope = { paywall_view_id: string; offer_load_id: string };
export type OfferEventPayloads = {
  paywall_offer_load_started: OfferScope;
  paywall_offer_ready: OfferScope & { product_id: string; currency: string; price: number };
  paywall_offer_failed: OfferScope & { failure_reason: "not_configured" | "request_error" | "empty_offerings" };
};
export type MediaScope = { media_load_id: string };
export type MediaEventPayloads = {
  question_media_load_started: MediaScope;
  question_media_ready: MediaScope & { media_load_duration_ms: number };
  question_media_failed: MediaScope & { error_code: string; media_failure_stage: "load" | "playback" };
  question_media_playback_started: MediaScope;
  question_media_playback_ended: MediaScope;
  question_media_buffering: MediaScope & { buffering_duration_ms: number; buffering_completed: boolean };
};
export type CheckoutScope = { purchase_attempt_id: string; checkout_view_id: string };
type CheckoutPackageObservation = {
  // The operational snapshot can be incomplete. Final native-event QA requires a known SKU.
  product_id: string | null;
};
type PurchaseConfirmation = CheckoutScope & CheckoutPackageObservation & {
  transaction_id: string | null; native_purchase_completed: boolean;
  confirmation_source: "purchase_result" | "customer_info";
};
type PurchaseUncertain = CheckoutScope & {
  transaction_id: string | null;
  confirmation_reason: RevenueCatCheckoutErrorKind | "entitlement_not_yet_active";
};
type RecoveryScope = CheckoutScope & {
  recovery_source: "automatic" | "manual" | "before_retry" | "restore" | "startup" | "foreground";
};
type RestoreScope = { restore_attempt_id: string | null; checkout_view_id: string };
export type RestoreResult = {
  entitlement_active: true; restore_outcome: "restored";
} | {
  entitlement_active: false; restore_outcome: "empty";
};

export type CheckoutEventPayloads = {
  purchase_stage_changed: CheckoutScope & { step: CheckoutStage };
  purchase_started: CheckoutScope & CheckoutPackageObservation & { ui: "package" };
  purchase_succeeded: PurchaseConfirmation;
  purchase_access_confirmed: PurchaseConfirmation;
  purchase_cancelled: CheckoutScope & { error_category: RevenueCatCheckoutErrorKind };
  purchase_failed: CheckoutScope & { error_category: RevenueCatCheckoutErrorKind; error_code: string | null };
  purchase_preparation_failed: CheckoutScope & { error_category: RevenueCatCheckoutErrorKind };
  purchase_pending: PurchaseUncertain;
  purchase_outcome_unknown: PurchaseUncertain;
  purchase_attempt_recovered: CheckoutScope & { previous_status: CheckoutStatus | null; resumed_after_restart: boolean };
  purchase_status_check_started: RecoveryScope;
  purchase_status_check_completed: RecoveryScope & { access_active: boolean };
  purchase_status_check_failed: RecoveryScope & { access_active: boolean; error_category: RevenueCatCheckoutErrorKind };
  purchase_restore_started: RestoreScope & { restore_outcome: "started" };
  restore_started: RestoreScope & { restore_outcome: "started" };
  purchase_restore_succeeded: RestoreScope & { entitlement_active: true; restore_outcome: "restored" };
  purchase_restore_empty: RestoreScope & { entitlement_active: false; restore_outcome: "empty" };
  restore_succeeded: RestoreScope & RestoreResult;
  purchase_restore_failed: RestoreScope & { entitlement_active: boolean; restore_outcome: "failed"; error_category: RevenueCatCheckoutErrorKind };
  restore_failed: RestoreScope & { entitlement_active: boolean; restore_outcome: "failed"; error_category: RevenueCatCheckoutErrorKind };
};

export type LearningEventPayloads = {
  training_session_started: { training_session_id: string; mode: QuestionSessionMode; question_total: number };
  training_session_resumed: { training_session_id: string; mode: QuestionSessionMode; question_total: number };
  training_question_viewed: { training_session_id: string; question_id: string };
  training_question_answered: { training_session_id: string; question_id: string; answer_id: string; is_correct: boolean };
  training_session_completed: {
    training_session_id: string; mode: QuestionSessionMode; learning_outcome_rule_version: "learning-v1";
    answered_count: number; accepted_unique_question_count: number; correct_count: number; incorrect_count: number;
    passed: boolean; question_total: number; score_percent: number;
  };
  exam_session_started: { exam_session_id: string; mode: ExamSimulatorMode; question_total: number };
  exam_question_viewed: { exam_session_id: string | null; question_id: string | null };
  exam_question_answered: {
    exam_session_id: string; question_id: string; answer_id: string; answer_revision_id: string;
    answer_action: "create" | "update"; is_correct: boolean;
  };
  exam_session_completed: {
    exam_session_id: string; mode: ExamSimulatorMode; learning_outcome_rule_version: "learning-v1";
    completion_status: RemoteExamSessionStatus; answered_count: number; correct_count: number; wrong_count: number;
    passed: boolean; question_total: number; score_points: number; total_points_target: number;
  };
};

export type ObservationEventPayloads = {
  analytics_identity_observed: {
    app_user_id: string; supabase_user_id: string | null; previous_supabase_user_id: string | null;
    identity_scope: "install"; identity_link_version: 1;
    identity_observation_reason: "initial" | "account_link" | "account_unlink" | "account_switch";
  };
  install_observation_resolved: {
    installation_observation_id: string | null; first_observed_at: string | null;
    observation_detection_method: "first_local_observation" | "storage_recovery" | "memory_only" | "not_resolved";
  };
  onboarding_flow_viewed: {
    onboarding_attempt_id: string; flow_context: "onboarding"; flow_version: "category_schedule_v1";
    onboarding_started_at: string;
  };
  onboarding_flow_completed: {
    onboarding_attempt_id: string | null; flow_context: "onboarding"; onboarding_completed_at: string | null;
    completion_source: "finalize_local"; completion_scope: "local_store_operations_returned"; home_arrival_observed: false;
  };
  onboarding_home_arrived: {
    onboarding_attempt_id: string; onboarding_completed_at: string | null; onboarding_home_observed_at: string | null;
    home_arrival_basis: "foreground_route_observed";
  };
};

export type CriticalAnalyticsPayloads = OfferEventPayloads & MediaEventPayloads & CheckoutEventPayloads
  & LearningEventPayloads & ObservationEventPayloads & ExternalEntryEventPayloads & RewardedObservationPayloads
  & ActivityEventPayloads & OperationEventPayloads & LearningInteractionPayloads & {
    learning_screen_ready: LearningReadyPayload;
    access_state_changed: AccessStatePayload;
    paywall_viewed: { paywall_view_id: string };
    paywall_dismissed: { paywall_view_id: string; time_visible_ms: number };
    paywall_cta_selected: { paywall_view_id: string; action: "purchase" | "retry_purchase" | "restore" };
    paywall_plan_selected: { paywall_view_id: string; plan: "week" | "month" | "quarter" };
    paywall_checkout_blocked: {
      paywall_view_id: string; action: "purchase" | "retry_purchase" | "restore";
      blocked_reason: "checkout_busy" | "already_entitled" | "purchase_disabled" | "not_configured" | "package_unavailable";
    };
  };
