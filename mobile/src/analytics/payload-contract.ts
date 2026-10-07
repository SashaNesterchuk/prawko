import type { AnalyticsEventName, AnalyticsProperties, AnalyticsValue } from "./catalog";
import { ACTIVE_CATEGORIES, QUESTION_SESSION_MODES } from "@prawko/config";
import { CHECKOUT_ERROR_CATEGORIES, CHECKOUT_STATUSES, CHECKOUT_STEPS } from "./critical-payloads";
import { criticalPayloadIssues } from "./critical-payload-validation";
import { ENTRY_END_REASONS } from "./observation-payloads";
import { ACCESS_SOURCES, APP_VISIBILITIES } from "./activity-payloads";
import {
  LEARNING_OPERATIONS, NOTIFICATION_PERMISSION_SOURCES, NOTIFICATION_SCHEDULE_OPERATIONS,
  NOTIFICATION_SCHEDULE_OUTCOMES, OFFLINE_PACK_STATES,
} from "./operation-payloads";
import { EXAM_END_REASONS, EXAM_LAUNCH_STEPS, OFFLINE_BLOCK_REASONS, TRAINING_EMPTY_REASONS } from "./learning-interaction-payloads";

type Rule = {
  type: "string" | "number" | "boolean";
  nullable?: boolean;
  optional?: boolean;
  values?: readonly AnalyticsValue[];
  integer?: boolean;
};
const id: Rule = { type: "string" };
const optionalId: Rule = { ...id, nullable: true };
const count: Rule = { type: "number" };
const integer: Rule = { ...count, integer: true };
const bool: Rule = { type: "boolean" };
const category: Rule = {
  type: "string", values: ACTIVE_CATEGORIES,
};
const offlineScope = { operation_id: id, category };
const offlineTerminal = {
  ...offlineScope, question_count: integer, operation_duration_ms: count,
  downloaded_asset_count: { ...integer, nullable: true }, downloaded_bytes: { ...integer, nullable: true },
  operation_stage: { type: "string", values: ["download", "refresh_metadata"] },
} as const satisfies Record<string, Rule>;
const resetScope = { source: { type: "string", values: ["profile"] }, reset_operation_id: id } as const;
const trainingScope = { training_session_id: id, mode: { type: "string", values: QUESTION_SESSION_MODES } } as const;
const examScope = { exam_session_id: id, mode: { type: "string", values: ["exam", "mini_test", "exam_tomorrow"] } } as const;
const trainingCounts = { answered_count: integer, correct_count: integer, incorrect_count: integer, question_total: integer };
const examCounts = { answered_count: integer, correct_count: integer, wrong_count: integer, question_total: integer };
const reviewPosition = { question_index: integer, question_total: integer };
const reviewItem = {
  ...reviewPosition, question_id: id, view_state: { type: "string", values: ["question", "missing_question"] },
  was_answered: bool, is_correct: { ...bool, nullable: true },
} as const satisfies Record<string, Rule>;
const reviewClose = { ...reviewPosition, viewed_count: integer, review_foreground_ms: count };
const trainingReview = { ...trainingScope, review_id: id };
const examReview = { exam_session_id: id, review_id: id };
const visitDuration = { visit_foreground_ms: count, duration_scope: { type: "string", values: ["current_component_visit"] } } as const;
const offlineBlock = {
  block_id: id, feature: { type: "string", values: ["training", "exam"] },
  screen_name: { type: "string", values: ["question_training", "exam_loading", "exam_session"] },
  requested_category: category, mode: { ...optionalId, values: QUESTION_SESSION_MODES },
  blocked_reason: { type: "string", values: OFFLINE_BLOCK_REASONS },
  is_online: bool, offline_ready: bool, downloaded_category: { ...category, nullable: true },
} as const satisfies Record<string, Rule>;
const categoryMismatch = {
  mismatch_id: id, exam_session_id: id,
  screen_name: { type: "string", values: ["exam_loading", "exam_session", "exam_result", "exam_answers"] },
  current_category: category, session_category: category,
} as const satisfies Record<string, Rule>;
export const ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS = {
  offline_pack_download_failed: {
    download: offlineTerminal,
    remove: { ...offlineScope, operation: { type: "string", values: ["remove"] } },
  },
  screen_viewed: {
    route: {
      route_entity_id: optionalId, flow_context: { type: "string", values: ["onboarding", "settings", "product"] },
      onboarding_attempt_id: optionalId,
      onboarding_observation_state: { type: "string", values: ["resolved", "pending", "not_applicable"] },
      learning_intent_id: optionalId,
    },
    inline_review: {
      exam_session_id: id, route_pattern: { type: "string", values: ["/exam/answers"] },
      screen_name: { type: "string", values: ["exam_answers"] },
    },
  },
} as const satisfies Record<string, Record<string, Record<string, Rule>>>;
const appVisit = {
  app_visit_id: id, app_visibility: { type: "string", values: APP_VISIBILITIES },
} as const satisfies Record<string, Rule>;
const screenVisit = {
  ...appVisit, screen_visit_id: id, route_pattern: id, screen_name: id, view_state: id,
};
const activityDurations = {
  foreground_ms: count, inactive_ms: count, interaction_engaged_ms: count, wall_duration_ms: count,
  engagement_policy: { type: "string", values: ["interaction_idle_60s_v1"] },
  duration_scope: { type: "string", values: ["observed_foreground"] },
} as const satisfies Record<string, Rule>;
const checkpoint = {
  ...activityDurations, checkpoint_index: integer,
  checkpoint_reason: { type: "string", values: ["interval", "observer_unmount"] },
} as const satisfies Record<string, Rule>;
const media = { media_load_id: id };
const offer = { paywall_view_id: id, offer_load_id: id };
const purchase = { purchase_attempt_id: id, checkout_view_id: id };
const restore = { restore_attempt_id: id, checkout_view_id: id };
const recovery = {
  ...purchase, recovery_source: { type: "string", values: ["automatic", "manual", "before_retry", "restore", "startup", "foreground"] } as Rule,
};
const failure = { error_category: { type: "string", values: CHECKOUT_ERROR_CATEGORIES } as Rule };
const confirmation = {
  ...purchase, product_id: id, transaction_id: optionalId, native_purchase_completed: bool,
  confirmation_source: { type: "string", values: ["purchase_result", "customer_info"] } as Rule,
};
const uncertain = {
  ...purchase, transaction_id: optionalId,
  confirmation_reason: { type: "string", values: [...CHECKOUT_ERROR_CATEGORIES, "entitlement_not_yet_active"] } as Rule,
};
const eligibility = {
  paywall_view_id: id, eligibility_request_id: id,
  trial_eligibility_observation_version: { type: "number", values: [1] },
  eligibility_scope: { type: "string", values: ["request_not_display"] },
  eligibility_requested_product_count: integer, eligibility_distinct_product_count: integer,
  eligibility_observer_active: bool, eligibility_view_visible: bool, eligibility_platform: id,
} as const satisfies Record<string, Rule>;
const paywallOrigin: Record<string, Rule> = {
  paywall_origin_version: { type: "number", values: [1] },
  paywall_origin_status: { type: "string", values: ["observed", "observation_failed"] },
};
const checkoutOrigin: Record<string, Rule> = {
  checkout_origin_version: { type: "number", values: [1] },
  checkout_origin_status: { type: "string", values: ["observed", "observation_failed"] },
};
const observedPaywallOrigin: Record<string, Rule> = {
  paywall_origin_at: id,
  paywall_origin_basis: { type: "string", values: ["local_screen_config_not_remote_revision"] },
  paywall_origin_variant: { type: "string", values: ["paywall2", "legacy"] },
  paywall_origin_offer: { type: "string", values: ["plans", "lifetime"] },
  paywall_origin_default_plan: { ...optionalId, values: ["week", "month", "quarter"] },
  paywall_origin_config_version: integer,
  paywall_origin_country: { type: "string", values: ["PL", "CZ", "SK"] },
  paywall_origin_category: optionalId, paywall_origin_locale: optionalId,
  paywall_origin_monetization_version: { type: "number", values: [1, 2] },
  paywall_origin_presentation: id, paywall_origin_source: optionalId, paywall_origin_surface: optionalId,
};
const observedCheckoutOrigin: Record<string, Rule> = {
  checkout_origin_at: id,
  checkout_origin_basis: { type: "string", values: ["checkout_input_and_selected_package", "checkout_input_without_selected_package"] },
  checkout_origin_source: optionalId, checkout_origin_surface: optionalId,
  checkout_origin_exam_country: { type: "string", nullable: true, values: ["PL", "CZ", "SK"] },
  checkout_origin_category: optionalId, checkout_origin_locale: optionalId,
  checkout_origin_paywall_variant: optionalId, checkout_origin_paywall_offer: optionalId,
  checkout_origin_plan: optionalId, checkout_origin_default_plan: optionalId,
  checkout_origin_paywall_config_version: { ...integer, nullable: true },
  checkout_origin_product_id: optionalId, checkout_origin_package_id: optionalId,
  checkout_origin_offering_id: optionalId, checkout_origin_package_type: optionalId,
  checkout_origin_subscription_period: optionalId, checkout_origin_price: { ...count, nullable: true },
  checkout_origin_currency: optionalId, checkout_origin_trial_days: { ...integer, nullable: true },
  checkout_origin_trial_eligibility: { ...optionalId, values: ["eligible", "ineligible", "unknown", "error", "no_trial"] },
  checkout_origin_trial_eligibility_basis: optionalId, checkout_origin_trial_eligibility_request_id: optionalId,
  checkout_origin_trial_shown: { ...bool, nullable: true },
};

const accessObservation: Record<string, Rule> = {
  access_observation_version: { type: "number", values: [1] },
  access_rule_version: { type: "string", values: ["plus-feature-observation-v1"] },
  access_observed_feature: id,
  access_expected: { type: "string", values: ["allowed", "blocked", "not_evaluated"] },
  access_observed: {
    type: "string", values: ["blocked", "available", "premium_mark", "upsell", "non_entitlement_block", "ambiguous_gate"],
  },
  access_comparison: {
    type: "string", values: ["consistent", "blocked_despite_plus", "premium_content_without_plus", "not_comparable"],
  },
  access_expected_is_plus: bool,
  access_expected_source: { type: "string", values: ["none", "purchase", "school", "other", "runtime_override"] },
  access_customer_info_at: optionalId,
  access_customer_info_age_ms: { ...count, nullable: true },
  access_customer_info_clock_order: { type: "string", values: ["ordered", "future", "not_recorded"] },
};

const sourceLocale: Rule = { type: "string", nullable: true, values: ["pl", "ua", "en", "de", "cs", "el", "sk"] };
const sourceKind: Rule = { type: "string", nullable: true, values: ["question_content", "ai_explanation", "legacy_explanation"] };
const sourceBasis: Rule = {
  type: "string", values: ["no_text", "not_recorded", "mapper_fallback_provenance",
    "provenance_revision_mismatch", "unverified_mapper_output", "observation_failed"],
};
const contentProvenance: Record<string, Rule> = {
  content_provenance_version: { type: "number", values: [1] },
  content_observation_status: { type: "string", values: ["observed", "failed"] },
  content_text_field: sourceLocale,
  content_source_language: sourceLocale, content_source_kind: sourceKind, content_source_language_basis: sourceBasis,
  explanation_text_field: sourceLocale,
  explanation_source_language: sourceLocale, explanation_source_kind: sourceKind, explanation_source_language_basis: sourceBasis,
  choice_source_languages: optionalId, choice_unknown_source_count: { ...count, nullable: true },
};
const explanationDisplay: Record<string, Rule> = {
  explanation_display_observation_version: { type: "number", values: [1] },
  explanation_display_variant: { type: "string", values: ["full", "free_topic_marked", "locked"] },
  explanation_rendered_state: { type: "string", values: ["text", "empty", "locked", "not_observed"] },
  explanation_display_revision: optionalId,
  explanation_display_revision_basis: { type: "string", values: ["rendered_text_value", "observation_failed"] },
  explanation_display_matches_selected_field: { ...bool, nullable: true },
};
const examRules: Record<string, Rule> = {
  exam_rules_observation_version: { type: "number", values: [1] },
  exam_session_rules_revision: optionalId,
  exam_session_rules_revision_basis: { type: "string", values: ["persisted_session_parameters", "unavailable"] },
  exam_session_rules_status: { type: "string", values: ["observed", "invalid_parameters", "snapshot_not_cached", "observation_failed"] },
  exam_origin_profile_revision: optionalId,
  exam_origin_profile_basis: { type: "string", values: ["persisted_creation_profile", "not_recorded", "origin_parameters_unverified"] },
};
const observedExamParameters: Record<string, Rule> = {
  exam_origin_country: { type: "string", nullable: true, values: ["PL", "CZ", "SK"] },
  exam_origin_category: { type: "string", values: ["AM", "A1", "A2", "A", "B1", "B", "C1", "C", "D1", "D", "T"] },
  exam_origin_mode: { type: "string", values: ["exam", "mini_test", "exam_tomorrow"] },
  exam_origin_question_total: count, exam_origin_total_points: count, exam_origin_pass_points: count,
  exam_origin_duration_seconds: { ...count, nullable: true },
  exam_origin_navigation: { type: "string", nullable: true, values: ["forward_only", "free"] },
};
const rewardedObservation = {
  ad_observation_version: { type: "number", values: [1] },
  ad_format: { type: "string", values: ["rewarded"] },
  ad_request_id: optionalId, ad_impression_id: optionalId,
  ad_unit_basis: { type: "string", values: ["test_unit", "configured_unit", "not_resolved"] },
  ad_native_load_observed: bool, ad_opened_observed: bool,
  placement: { type: "string", values: ["exam_unlock"] },
} as const satisfies Record<string, Rule>;
const rewardedPaid: Record<string, Rule> = {
  ad_request_id: id, ad_impression_id: id, revenue: count, currency: id,
  ad_paid_callback_sequence: count, ad_paid_basis: { type: "string", values: ["sdk_paid_value"] },
  ad_native_terminal_observed: bool,
};
const rewardedFailure: Record<string, Rule> = {
  ad_failure_category: {
    type: "string", values: ["disabled", "missing_unit_id", "no_fill", "network", "invalid_request", "internal", "sdk_unspecified"],
  },
  ad_failure_stage: { type: "string", values: ["policy", "configuration", "sdk_event", "load_invocation"] },
};
const externalEntry = {
  entry_observation_version: { type: "number", values: [1] },
  entry_observation_id: id, entry_kind: { type: "string", values: ["deep_link", "notification"] },
  entry_signal_origin: { type: "string", values: ["initial_url", "live_url", "live_os_response", "cached_os_response"] },
  entry_signal_received_at: id, entry_observed_at: id,
  entry_observation_time_basis: { type: "string", values: ["client_signal_processing_not_tap"] },
  entry_scope_status: {
    type: "string", values: ["bound_visit", "awaiting_foreground", "cached_unattributed", "processing_visit_changed",
      "signal_horizon_elapsed", "observation_clock_invalid"],
  },
  entry_bound_app_visit_id: optionalId,
  entry_target_route_pattern: optionalId, entry_target_screen_name: optionalId,
  entry_target_entity_revision: optionalId, entry_target_entity_required: bool,
  entry_target_basis: {
    type: "string", values: ["normalized_static_route", "normalized_entity_id", "entity_unverified",
      "conflicting_entity_ids", "root_redirect", "unknown_route", "malformed_url", "notification_target_unspecified"],
  },
  entry_destination_horizon_seconds: { type: "number", values: [60] },
  entry_association_horizon_seconds: { type: "number", values: [3600] },
  notification_response_revision: optionalId,
} as const satisfies Record<string, Rule>;

/** Critical event contracts are observation QA, never product preconditions. */
export const ANALYTICS_PAYLOAD_CONTRACTS = {
  training_feedback_continued: {
    ...trainingScope, ...reviewPosition, question_id: id, feedback_foreground_ms: count, is_correct: bool,
    action: { type: "string", values: ["next", "finish"] },
  },
  training_result_viewed: {
    ...trainingScope, ...trainingCounts, result_origin: { type: "string", values: ["new_completion", "existing_result"] },
    view_reason: { type: "string", values: ["initial", "review_return"] },
  },
  training_result_action: {
    ...trainingScope, action: { type: "string", values: ["close", "finish", "work_on_mistakes", "new_attempt", "answers", "upgrade"] },
  },
  training_answers_review_opened: { ...trainingReview, question_total: integer },
  training_answers_review_question_viewed: { ...trainingReview, ...reviewItem },
  training_answers_review_closed: { ...trainingReview, ...reviewClose, close_reason: { type: "string", values: ["finished", "back"] } },
  training_session_abandoned: {
    ...trainingScope, ...trainingCounts, ...visitDuration, exit_reason: { type: "string", values: ["empty_pool", "zero_answer_exit", "explicit_exit"] },
  },
  training_session_empty: { ...trainingScope, empty_reason: { type: "string", values: TRAINING_EMPTY_REASONS } },
  exam_session_resumed: { ...examScope, launch_attempt_id: id, question_total: integer, resumed_at_question: integer },
  exam_session_ended: {
    ...examScope, ...examCounts, ...visitDuration, status: { type: "string", values: ["completed", "abandoned", "expired"] },
    end_reason: { type: "string", values: EXAM_END_REASONS },
  },
  exam_empty_exit: { ...examScope, answered_count: { ...integer, values: [0] }, question_total: integer },
  exam_result_viewed: {
    ...examScope, ...examCounts, result_origin: { type: "string", values: ["just_finished", "existing_result"] },
    status: { type: "string", values: ["active", "completed", "abandoned", "expired"] },
    outcome: { type: "string", values: ["passed", "failed", "abandoned", "expired"] },
  },
  exam_result_action: { ...examScope, action: { type: "string", values: ["home", "answers", "work_on_mistakes", "new_attempt"] } },
  exam_answers_review_opened: { ...examScope, ...examReview, question_total: integer, source: { type: "string", values: ["result", "route"] } },
  exam_answers_review_question_viewed: { ...examReview, ...reviewItem },
  exam_answers_review_closed: { ...examReview, ...reviewClose, close_reason: { type: "string", values: ["finished", "back", "view_unmounted"] } },
  exam_question_navigation_requested: {
    exam_session_id: id, question_id: id, ...reviewPosition, target_question_index: integer,
    navigation_direction: { type: "string", values: ["forward", "backward"] },
  },
  exam_question_flag_changed: { exam_session_id: id, question_id: id, ...reviewPosition, is_flagged: bool },
  exam_restart_gate_shown: { exam_session_id: id, source: { type: "string", values: ["exam_result"] } },
  exam_restart_selected: {
    exam_session_id: id, source: { type: "string", values: ["exam_result"] },
    choice: { type: "string", values: ["watch_ad", "upgrade", "dismiss", "plus"] }, ad_shown: { ...bool, optional: true },
  },
  answer_explanation_viewed: {
    ...trainingScope, question_id: id, is_correct: bool,
    access_method: { type: "string", values: ["premium", "free_topic"] }, free_explanations_remaining: integer,
  },
  diagnostic_result_action: { ...trainingScope, action: { type: "string", values: ["continue", "close", "answers", "mistakes"] } },
  diagnostic_reminder_shown: { training_session_id: id, has_exam_date: bool },
  diagnostic_reminder_resolved: { training_session_id: id, action: { type: "string", values: ["enable", "later", "dismiss"] } },
  exam_start_requested: {
    launch_attempt_id: id, mode: examScope.mode, question_total: integer, is_online: { ...bool, nullable: true },
    offline_ready: bool, source: { type: "string", values: ["study_plan", "manual"] },
  },
  exam_start_failed: { launch_attempt_id: id, mode: examScope.mode, launch_step: { type: "string", values: EXAM_LAUNCH_STEPS }, error_code: id },
  learning_access_blocked: offlineBlock,
  learning_access_block_action: {
    ...offlineBlock, action: { type: "string", values: ["retry", "open_offline_mode", "close"] }, destination: optionalId,
  },
  exam_category_mismatch_viewed: categoryMismatch,
  exam_category_mismatch_resolved: { ...categoryMismatch, resolved_category: category },
  exam_category_mismatch_action: { ...categoryMismatch, action: { type: "string", values: ["switch_category", "close"] } },
  learning_intent_requested: {
    learning_intent_id: id,
    mode: { ...optionalId, values: QUESTION_SESSION_MODES },
    question_limit: { ...integer, optional: true, nullable: true },
    roadmap_step_id: { ...optionalId, optional: true }, topic_id: { ...optionalId, optional: true },
    feature: { type: "string", optional: true, values: ["sign_test"] },
  },
  learning_operation_failed: {
    operation_id: id, operation_id_source: { type: "string", values: ["existing_operation", "failure_observation"] },
    operation: { type: "string", values: LEARNING_OPERATIONS }, error_code: id, user_visible: bool,
  },
  screen_viewed: {
    route_pattern: id, screen_name: id,
    screen_observation_scope: { type: "string", values: ["route", "inline_review"] },
  },
  notification_schedule_resolved: {
    operation_id: id, operation: { type: "string", values: NOTIFICATION_SCHEDULE_OPERATIONS },
    outcome: { type: "string", values: NOTIFICATION_SCHEDULE_OUTCOMES },
    reminder_kind: { type: "string", values: ["study_daily"] }, request_duration_ms: count,
    scheduled_count: integer, enabled: bool, confirmation_scope: { type: "string", values: ["helper_result_not_delivery"] },
    error_code: { ...id, optional: true },
  },
  notification_permission_requested: { source: { type: "string", values: NOTIFICATION_PERMISSION_SOURCES } },
  notification_permission_resolved: {
    source: { type: "string", values: NOTIFICATION_PERMISSION_SOURCES }, enabled: bool,
    can_ask_again: { ...bool, optional: true, nullable: true }, error_code: { ...id, optional: true },
  },
  offline_pack_state_viewed: {
    pack_state: { type: "string", values: OFFLINE_PACK_STATES }, category,
    downloaded_category: { ...category, nullable: true },
    catalog_matches: { ...bool, nullable: true }, question_count: { ...integer, nullable: true },
    operation_id: optionalId,
  },
  offline_pack_download_started: {
    ...offlineScope, question_count: integer, action: { type: "string", values: ["resume", "update", "download"] },
  },
  offline_pack_download_completed: offlineTerminal,
  offline_pack_download_cancelled: offlineTerminal,
  offline_pack_download_failed: { ...offlineScope, error_code: id },
  offline_pack_cancel_requested: {
    operation_id: optionalId, category, source: { type: "string", values: ["stop_button"] },
  },
  offline_pack_removed: offlineScope,
  progress_reset_started: resetScope,
  progress_reset_failed: { ...resetScope, error_code: id },
  progress_reset_confirmed: { ...resetScope, completion_scope: { type: "string", values: ["helper_resolved_best_effort_cleanup"] } },
  app_visit_started: {
    ...appVisit, start_reason: { type: "string", values: ["runtime_start", "foreground_resume"] },
    previous_visibility: { type: "string", values: APP_VISIBILITIES },
  },
  app_visit_checkpoint: { ...appVisit, ...checkpoint },
  app_visit_ended: {
    ...appVisit, ...activityDurations, end_reason: { type: "string", values: ["background"] },
    last_screen_visit_id: optionalId, checkpoint_index: integer,
  },
  screen_visit_started: { ...screenVisit, start_reason: { type: "string", values: ["navigation", "foreground"] } },
  screen_visit_checkpoint: { ...screenVisit, ...checkpoint },
  screen_visit_ended: {
    ...screenVisit, ...activityDurations, end_reason: { type: "string", values: ["navigation", "background"] },
  },
  screen_state_viewed: screenVisit,
  learning_screen_ready: {
    feature: { type: "string", values: ["training", "exam", "sign_test", "sign_practice"] },
    question_id: id,
    ready_foreground_ms: count, ready_wall_ms: count,
    ready_duration_scope: { type: "string", values: ["current_focus_entry", "foreground_observation"] },
    ready_reason: { type: "string", values: ["focused_ready", "foreground_return"] },
    media_readiness: { type: "string", values: ["not_measured"] },
  },
  access_state_changed: {
    observation_reason: { type: "string", values: ["initial_snapshot", "state_change"] },
    previous_is_plus: { ...bool, nullable: true },
    previous_access_source: { ...optionalId, values: ACCESS_SOURCES },
    is_plus: bool, access_source: { type: "string", values: ACCESS_SOURCES },
  },
  paywall_viewed: { paywall_view_id: id },
  paywall_dismissed: { paywall_view_id: id, time_visible_ms: count },
  paywall_offer_load_started: offer,
  paywall_offer_ready: { ...offer, product_id: id, currency: id, price: count },
  paywall_offer_failed: { ...offer, failure_reason: { type: "string", values: ["not_configured", "request_error", "empty_offerings"] } },
  paywall_trial_eligibility_started: { ...eligibility, eligibility_started_at: id },
  paywall_trial_eligibility_resolved: {
    ...eligibility, eligibility_product_id: id, eligibility_native_query_invoked: bool,
    eligibility_outcome: { type: "string", values: ["eligible", "ineligible", "unknown", "no_intro_offer", "error"] },
    eligibility_basis: { type: "string", values: [
      "revenuecat_ios_status", "sdk_status_unknown", "missing_product_response", "unsupported_platform",
      "not_configured", "request_error",
    ] },
    eligibility_error_category: { ...optionalId, values: CHECKOUT_ERROR_CATEGORIES },
  },
  paywall_trial_eligibility_completed: {
    ...eligibility, eligibility_native_query_invoked: bool,
    eligibility_error_category: { ...optionalId, values: CHECKOUT_ERROR_CATEGORIES },
    eligibility_resolved_product_count: integer, eligibility_duration_ms: count,
    eligibility_request_outcome: { type: "string", values: ["resolved", "unsupported", "not_configured", "no_products", "error"] },
  },
  paywall_cta_selected: { paywall_view_id: id, action: { type: "string", values: ["purchase", "retry_purchase", "restore"] } },
  paywall_plan_selected: { paywall_view_id: id, plan: { type: "string", values: ["week", "month", "quarter"] } },
  paywall_checkout_blocked: {
    paywall_view_id: id, action: { type: "string", values: ["purchase", "retry_purchase", "restore"] },
    blocked_reason: { type: "string", values: ["checkout_busy", "already_entitled", "purchase_disabled", "not_configured", "package_unavailable"] },
  },
  purchase_stage_changed: { ...purchase, step: { type: "string", values: CHECKOUT_STEPS } },
  purchase_started: { ...purchase, product_id: id, ui: { type: "string", values: ["package"] }, step: { type: "string", values: ["purchase_package"] } },
  purchase_succeeded: confirmation,
  purchase_access_confirmed: confirmation,
  purchase_pending: uncertain,
  purchase_outcome_unknown: uncertain,
  purchase_cancelled: { ...purchase, ...failure },
  purchase_failed: { ...purchase, ...failure, error_code: optionalId },
  purchase_preparation_failed: { ...purchase, ...failure },
  purchase_attempt_recovered: {
    ...purchase, previous_status: { ...optionalId, values: CHECKOUT_STATUSES }, resumed_after_restart: bool,
  },
  purchase_status_check_started: recovery,
  purchase_status_check_completed: { ...recovery, access_active: bool },
  purchase_status_check_failed: { ...recovery, access_active: bool, ...failure },
  purchase_restore_started: { ...restore, restore_outcome: { type: "string", values: ["started"] } },
  restore_started: { ...restore, restore_outcome: { type: "string", values: ["started"] } },
  restore_succeeded: { ...restore, entitlement_active: bool, restore_outcome: { type: "string", values: ["restored", "empty"] } },
  purchase_restore_succeeded: { ...restore, entitlement_active: { ...bool, values: [true] }, restore_outcome: { type: "string", values: ["restored"] } },
  purchase_restore_empty: { ...restore, entitlement_active: { ...bool, values: [false] }, restore_outcome: { type: "string", values: ["empty"] } },
  purchase_restore_failed: { ...restore, entitlement_active: bool, ...failure, restore_outcome: { type: "string", values: ["failed"] } },
  restore_failed: { ...restore, entitlement_active: bool, ...failure, restore_outcome: { type: "string", values: ["failed"] } },
  training_session_started: { training_session_id: id, mode: { type: "string", values: QUESTION_SESSION_MODES }, question_total: integer },
  training_session_resumed: { training_session_id: id, mode: { type: "string", values: QUESTION_SESSION_MODES }, question_total: integer },
  training_question_viewed: { training_session_id: id, question_id: id },
  training_question_answered: { training_session_id: id, question_id: id, answer_id: id, is_correct: bool },
  training_session_completed: {
    training_session_id: id, mode: { type: "string", values: QUESTION_SESSION_MODES },
    learning_outcome_rule_version: { type: "string", values: ["learning-v1"] },
    answered_count: integer, accepted_unique_question_count: integer, correct_count: integer, incorrect_count: integer,
    passed: bool, question_total: integer, score_percent: count,
  },
  exam_session_started: { exam_session_id: id, mode: { type: "string", values: ["exam", "mini_test", "exam_tomorrow"] }, question_total: integer },
  exam_question_viewed: { exam_session_id: id, question_id: id },
  exam_question_answered: {
    exam_session_id: id, question_id: id, answer_id: id, answer_revision_id: id,
    answer_action: { type: "string", values: ["create", "update"] }, is_correct: bool,
  },
  exam_session_completed: {
    exam_session_id: id, mode: { type: "string", values: ["exam", "mini_test", "exam_tomorrow"] },
    learning_outcome_rule_version: { type: "string", values: ["learning-v1"] },
    completion_status: { type: "string", values: ["active", "completed", "abandoned", "expired"] },
    answered_count: integer, correct_count: integer, wrong_count: integer, passed: bool,
    question_total: integer, score_points: integer, total_points_target: integer,
  },
  question_media_load_started: media,
  question_media_ready: { ...media, media_load_duration_ms: count },
  question_media_failed: {
    ...media, error_code: id, media_failure_stage: { type: "string", values: ["load", "playback"] },
  },
  question_media_playback_started: media,
  question_media_playback_ended: media,
  question_media_buffering: { ...media, buffering_duration_ms: count, buffering_completed: bool },
  analytics_identity_observed: {
    app_user_id: id, supabase_user_id: optionalId, previous_supabase_user_id: optionalId,
    identity_scope: { type: "string", values: ["install"] },
    identity_link_version: { type: "number", values: [1] },
    identity_observation_reason: {
      type: "string", values: ["initial", "account_link", "account_unlink", "account_switch"],
    },
  },
  install_observation_resolved: {
    installation_observation_id: id, first_observed_at: id,
    observation_detection_method: { type: "string", values: ["first_local_observation", "storage_recovery", "memory_only"] },
  },
  onboarding_flow_viewed: {
    onboarding_attempt_id: id, flow_context: { type: "string", values: ["onboarding"] },
    flow_version: { type: "string", values: ["category_schedule_v1"] }, onboarding_started_at: id,
  },
  onboarding_flow_completed: {
    onboarding_attempt_id: optionalId, onboarding_completed_at: id, flow_context: { type: "string", values: ["onboarding"] },
    completion_source: { type: "string", values: ["finalize_local"] },
    completion_scope: { type: "string", values: ["local_store_operations_returned"] },
    home_arrival_observed: { ...bool, values: [false] },
  },
  onboarding_home_arrived: {
    onboarding_attempt_id: id, onboarding_completed_at: id, onboarding_home_observed_at: id,
    home_arrival_basis: { type: "string", values: ["foreground_route_observed"] },
  },
  ad_native_request_started: {
    ...rewardedObservation, ad_request_id: id, ad_impression_id: id,
    ad_request_basis: { type: "string", values: ["sdk_load_invoked"] },
  },
  ad_impression_observed: {
    ...rewardedObservation, ad_request_id: id, ad_impression_id: id,
    ad_impression_basis: { type: "string", values: ["sdk_paid_callback"] }, ad_native_terminal_observed: bool,
  },
  ad_observation_failed: {
    ...rewardedObservation,
    observation_stage: { type: "string", values: ["paid_listener_registration", "paid_payload"] },
    why: { type: "string", values: ["unparseable_revenue", "observation_failed"] },
  },
  external_entry_destination_observed: {
    ...externalEntry,
    entry_destination_route_pattern: id, entry_destination_screen_name: id,
    entry_destination_entity_revision: optionalId,
    entry_destination_phase: { type: "string", values: ["route", "loading", "usable", "blocked", "error", "other"] },
    entry_destination_match: { type: "string", values: ["target_unspecified", "redirect_landing", "target_unknown",
      "different_route", "static_route", "entity_unverified", "route_and_entity", "different_entity"] },
    entry_destination_basis: { type: "string", values: [
      "preexisting_route_snapshot", "foreground_route_transition", "foreground_view_state",
    ] },
    entry_elapsed_ms: { ...count, nullable: true },
  },
  external_entry_destination_ended: {
    ...externalEntry,
    entry_destination_end_reason: { type: "string", values: [...ENTRY_END_REASONS, "destination_horizon_elapsed", "observation_limit"] },
    entry_elapsed_ms: { ...count, nullable: true },
    entry_destination_target_observed: { ...bool, nullable: true }, entry_destination_usable_observed: bool,
  },
  external_entry_ended: {
    ...externalEntry,
    entry_end_reason: { type: "string", values: ENTRY_END_REASONS }, entry_elapsed_ms: { ...count, nullable: true },
  },
} satisfies Partial<Record<AnalyticsEventName, Record<string, Rule>>>;
const runtimeContracts: Partial<Record<AnalyticsEventName, Record<string, Rule>>> = ANALYTICS_PAYLOAD_CONTRACTS;

export function validateAnalyticsPayload(event: AnalyticsEventName, properties: AnalyticsProperties) {
  const contract = runtimeContracts[event];
  const hasAccessObservation = properties.access_observation_version !== undefined;
  const hasContentProvenance = properties.content_provenance_version !== undefined;
  const hasExplanationDisplay = properties.explanation_display_observation_version !== undefined;
  const hasExamRules = properties.exam_rules_observation_version !== undefined;
  const hasRewardedObservation = properties.ad_observation_version !== undefined
    || ["ad_native_request_started", "ad_impression_observed", "ad_observation_failed"].includes(event);
  const hasExternalEntry = properties.entry_observation_version !== undefined || event.startsWith("external_entry_");
  const hasPaywallOrigin = properties.paywall_origin_version !== undefined;
  const hasCheckoutOrigin = properties.checkout_origin_version !== undefined;
  const readySessionKey = properties.feature === "training" ? "training_session_id"
    : properties.feature === "exam" ? "exam_session_id" : "sign_test_session_id";
  const rules: Record<string, Rule> = {
    ...(event === "screen_viewed"
      ? ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS.screen_viewed[properties.screen_observation_scope === "inline_review" ? "inline_review" : "route"]
      : {}),
    ...(event === "offline_pack_download_failed"
      ? ANALYTICS_OPERATION_CONDITIONAL_CONTRACTS.offline_pack_download_failed[properties.operation === "remove" ? "remove" : "download"]
      : {}),
    ...(event === "learning_screen_ready" ? { [readySessionKey]: id } : {}),
    ...(hasAccessObservation ? accessObservation : {}),
    ...(hasContentProvenance ? contentProvenance : {}), ...(hasExplanationDisplay ? explanationDisplay : {}),
    ...(hasExamRules ? examRules : {}),
    ...(hasExamRules && properties.exam_session_rules_status === "observed" ? observedExamParameters : {}),
    ...(hasRewardedObservation ? rewardedObservation : {}),
    ...(hasRewardedObservation && event === "ad_impression_revenue" ? rewardedPaid : {}),
    ...(hasRewardedObservation && event === "ad_failed" ? rewardedFailure : {}),
    ...(hasExternalEntry ? externalEntry : {}),
    ...(hasPaywallOrigin ? paywallOrigin : {}),
    ...(hasPaywallOrigin && properties.paywall_origin_status === "observed" ? observedPaywallOrigin : {}),
    ...(hasCheckoutOrigin ? checkoutOrigin : {}),
    ...(hasCheckoutOrigin && properties.checkout_origin_status === "observed" ? observedCheckoutOrigin : {}),
    // Event-specific requirements cannot be weakened by nullable shared diagnostics.
    ...contract,
  };
  const invalid = Object.entries(rules).filter(([key, rule]) => {
    const value = properties[key];
    if (value === undefined && rule.optional) return false;
    if (value === null && rule.nullable) return false;
    if (typeof value !== rule.type) return true;
    if (typeof value === "string" && (value.length === 0 || value.length > 1024)) return true;
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || (rule.integer && !Number.isInteger(value)))) return true;
    return rule.values !== undefined && !rule.values.includes(value);
  }).map(([key]) => key);
  const issues = [...new Set([...invalid, ...criticalPayloadIssues(event, properties)])];
  return {
    analytics_payload_contract_version: 2,
    analytics_payload_contract_status: !Object.keys(rules).length ? "not_defined" : issues.length ? "invalid" : "valid",
    analytics_payload_valid: issues.length === 0,
    // Keys are from the static contract. No rejected values or free text.
    analytics_payload_invalid_keys: issues.length ? issues.join(",") : null,
  };
}
