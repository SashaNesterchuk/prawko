/**
 * Canonical mobile analytics contract.
 *
 * Keep event names stable. Dashboard logic must use these keys rather than
 * component-local strings so that releases remain comparable in PostHog.
 */
import type { PaywallEligibilityPayloads } from "./paywall-payloads";
import type { CriticalAnalyticsPayloads } from "./critical-payloads";

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

type AnalyticsEventDefinition = {
  description: string;
  key: string;
};

export const ANALYTICS_EVENTS = {
  appVisitStarted: {
    key: "app_visit_started",
    description: "An observed foreground visit started. Not a SDK session, runtime, or learning attempt.",
  },
  appVisitCheckpoint: {
    key: "app_visit_checkpoint",
    description: "Cumulative observed visit time. Use the latest/max counters per visit, never sum checkpoints. A missing terminal leaves an unknown tail.",
  },
  appVisitEnded: {
    key: "app_visit_ended",
    description: "An observed visit entered background; cumulative foreground and inactive time. Not guaranteed on process kill.",
  },
  screenVisitStarted: {
    key: "screen_visit_started",
    description: "A route/entity foreground screen visit started, including foreground returns.",
  },
  screenVisitCheckpoint: {
    key: "screen_visit_checkpoint",
    description: "Cumulative observed screen time for screen_visit_id. Not evidence of reading or UI responsiveness.",
  },
  screenVisitEnded: {
    key: "screen_visit_ended",
    description: "Observed route/entity screen visit ended on navigation or background, with cumulative foreground time. State changes stay within the same screen_visit_id.",
  },
  screenStateViewed: {
    key: "screen_state_viewed",
    description: "A focused route displayed a state such as loading, question, feedback, result, review, blocked, or error.",
  },
  appEntryResolved: {
    key: "app_entry_resolved",
    description: "Observed launch/foreground entry attribution resolved to direct, notification, or a normalized deep link. No raw URL.",
  },
  externalEntryDestinationObserved: {
    key: "external_entry_destination_observed",
    description: "A received external signal was linked to an observed foreground route/state in its bound visit. Not dispatcher success, native rendering, notification delivery or causal attribution.",
  },
  externalEntryDestinationEnded: {
    key: "external_entry_destination_ended",
    description: "The bounded destination observation window ended. Missing target observations are not automatically routing failures.",
  },
  externalEntryEnded: {
    key: "external_entry_ended",
    description: "An external signal's same-foreground-visit association ended, was superseded or reached its observation horizon. Not a product timeout.",
  },
  appleSearchAdsAttributionResolved: {
    key: "apple_search_ads_attribution_resolved",
    description: "Apple Search Ads install check finished for this iOS install. Campaign, ad group, and keyword are numeric ids, not names. asa_result=organic is a completed check with no ad click. Not a visit source, not Android, and not spend.",
  },
  notificationOpened: {
    key: "notification_opened",
    description: "The OS supplied a notification response. Not proof of reminder delivery or a new installation.",
  },
  notificationScheduleResolved: {
    key: "notification_schedule_resolved",
    description: "A reminder schedule operation returned enabled/disabled/failed/permission_denied. Idle sync of an already-disabled empty schedule is silent. Not proof the OS delivered it.",
  },
  accessStateChanged: {
    key: "access_state_changed",
    description: "Observed access state changed, with previous/current source and Plus. Not a new purchase or financial transaction.",
  },
  analyticsIdentityObserved: {
    key: "analytics_identity_observed",
    description: "A versioned install/account link, unlink or switch was observed. Not a person merge, login outcome or access transfer.",
  },
  installObservationResolved: {
    key: "install_observation_resolved",
    description: "Persistent first-observed metadata resolved for an install identity. Native install time is separate; this event can repeat and is not a new install.",
  },
  onboardingFlowCompleted: {
    key: "onboarding_flow_completed",
    description: "Local plan save and completeOnboarding calls returned successfully for previously incomplete onboarding. Not proof of physical storage flush or arrival on Home.",
  },
  onboardingHomeArrived: {
    key: "onboarding_home_arrived",
    description: "A foreground Home route was observed after accepted local onboarding, with a persisted attempt ID. Not usable content, learning activation, or proof of event delivery.",
  },
  questionMediaLoadStarted: {
    key: "question_media_load_started",
    description: "A displayed media component requested an asset. media_load_id is the load grain, not a video view.",
  },
  questionMediaReady: {
    key: "question_media_ready",
    description: "The native image/video component reported readiness once per media_load_id. Does not imply playback or comprehension.",
  },
  questionMediaFailed: {
    key: "question_media_failed",
    description: "A missing asset or native media load/playback failure was observed, with a normalized code and no URL.",
  },
  questionMediaPlaybackStarted: {
    key: "question_media_playback_started",
    description: "The video player reported actual playback, distinct from the learner's play intent.",
  },
  questionMediaPlaybackEnded: {
    key: "question_media_playback_ended",
    description: "The native player reported playToEnd. Not proof of focused viewing or learning.",
  },
  questionMediaBuffering: {
    key: "question_media_buffering",
    description: "An observed post-ready loading interval ended or was censored; completed=false is not a full buffering duration.",
  },
  onboardingFlowViewed: {
    key: "onboarding_flow_viewed",
    description: "A real first-run/reset onboarding flow was observed. Settings visits are a separate flow_context.",
  },
  learningIntentRequested: {
    key: "learning_intent_requested",
    description: "A learning route was requested; learning_intent_id joins setup/roadmap/launch, without changing route behavior.",
  },
  learningScreenReady: {
    key: "learning_screen_ready",
    description: "A focused learning screen showed its first usable question for the focus/foreground entry. ready_duration_scope defines the latency clock; media_readiness is not_measured.",
  },
  learningOperationFailed: {
    key: "learning_operation_failed",
    description: "A learning operation failed with normalized code, attempt/question/operation IDs, and whether feedback is user-visible.",
  },
  examQuestionViewed: {
    key: "exam_question_viewed",
    description: "A ready focused exam question became visible. answer_presence is distinct from a new answer submission.",
  },
  examQuestionNavigationRequested: {
    key: "exam_question_navigation_requested",
    description: "The learner requested a different exam question; the later view confirms success.",
  },
  examQuestionFlagChanged: {
    key: "exam_question_flag_changed",
    description: "An exam flag change completed successfully.",
  },
  examResultViewed: {
    key: "exam_result_viewed",
    description: "A finished exam result became visible. Existing results do not create a new completion.",
  },
  examResultAction: {
    key: "exam_result_action",
    description: "A result CTA was selected: home, answers, work_on_mistakes, or new_attempt. Not the eventual operation outcome.",
  },
  examAnswersReviewQuestionViewed: {
    key: "exam_answers_review_question_viewed",
    description: "An exam review item became visible with review_id, question context, answer presence and view_state.",
  },
  examAnswersReviewClosed: {
    key: "exam_answers_review_closed",
    description: "An exam review view ended: back, finished, or view_unmounted. Unmount is not a learner-finish claim; not guaranteed on kill.",
  },
  signTestQuestionViewed: {
    key: "sign_test_question_viewed",
    description: "A focused sign-test question became visible; media readiness is not implied.",
  },
  signTestResultViewed: {
    key: "sign_test_result_viewed",
    description: "A sign-practice result became visible, distinct from finalizing its attempt.",
  },
  signSearchResultSelected: {
    key: "sign_search_result_selected",
    description: "The learner selected a search result. search_id and query_revision join the debounced query without sending its text.",
  },
  offlinePackStateViewed: {
    key: "offline_pack_state_viewed",
    description: "The focused offline screen displayed an observed pack state, not a download action.",
  },
  offlinePackCancelRequested: {
    key: "offline_pack_cancel_requested",
    description: "The learner requested download cancellation; canonical cancelled is its later terminal outcome.",
  },
  progressResetStarted: {
    key: "progress_reset_started",
    description: "Progress reset was confirmed and the existing helper was invoked; not completion.",
  },
  progressResetFailed: {
    key: "progress_reset_failed",
    description: "The progress-reset helper rejected. No changes to cleanup policy or navigation.",
  },
  screenViewed: {
    key: "screen_viewed",
    description: "A production app screen became visible. screen_observation_scope distinguishes route observations from inline exam review, which does not imply navigation.",
  },
  onboardingStepCompleted: {
    key: "onboarding_step_completed",
    description: "The learner completed a persisted onboarding step.",
  },
  authStarted: {
    key: "auth_started",
    description: "The learner submitted an authentication action.",
  },
  authCompleted: {
    key: "auth_completed",
    description: "Authentication completed successfully.",
  },
  authFailed: {
    key: "auth_failed",
    description: "Authentication failed with a normalized error code.",
  },
  schoolCodeRedeemStarted: {
    key: "school_code_redeem_started",
    description: "School-code redemption was requested.",
  },
  schoolCodeRedeemed: {
    key: "school_code_redeemed",
    description: "School-code redemption completed.",
  },
  schoolCodeRedeemFailed: {
    key: "school_code_redeem_failed",
    description: "School-code redemption failed.",
  },
  studyPlanCreated: {
    key: "study_plan_created",
    description: "A generated study plan was accepted.",
  },
  studyPlanCreateFailed: {
    key: "study_plan_create_failed",
    description: "Initial study-plan persistence failed.",
  },
  studyPlanAdjusted: {
    key: "study_plan_adjusted",
    description: "An existing study plan was regenerated.",
  },
  studyPlanAdjustFailed: {
    key: "study_plan_adjust_failed",
    description: "Study-plan regeneration failed.",
  },
  notificationPermissionRequested: {
    key: "notification_permission_requested",
    description: "The app requested study-reminder permission.",
  },
  notificationPermissionResolved: {
    key: "notification_permission_resolved",
    description: "The notification permission flow resolved.",
  },
  firstStartShown: {
    key: "first_start_shown",
    description:
      "Historical post-onboarding Home spotlight exposure. The current roadmap UI disables the spotlight; not a required activation step.",
  },
  firstStartSkipped: {
    key: "first_start_skipped",
    description: "Historical dismissal of the post-onboarding Home spotlight, which is disabled in the current roadmap UI.",
  },
  firstStartStarted: {
    key: "first_start_started",
    description:
      "The learner started the capped first-start session. source_screen distinguishes the Home and Learn readiness entries.",
  },
  diagnosticResultAction: {
    key: "diagnostic_result_action",
    description:
      "The learner chose a first-session diagnostic result CTA.",
  },
  diagnosticReminderShown: {
    key: "diagnostic_reminder_shown",
    description:
      "The post-diagnostic study-reminder bottom sheet was shown.",
  },
  diagnosticReminderResolved: {
    key: "diagnostic_reminder_resolved",
    description:
      "The learner enabled, deferred, or dismissed the study-reminder sheet.",
  },
  homeContextualShown: {
    key: "home_contextual_shown",
    description:
      "Legacy Home retention card exposure, not mounted on the current roadmap Home. kind: completion, resume, mistakes, review, or weak_topic. Returning users only; completion is one-shot.",
  },
  homeContextualSelected: {
    key: "home_contextual_selected",
    description:
      "The learner tapped the legacy Home retention card. kind matches home_contextual_shown; not a current roadmap Home funnel step.",
  },
  roadmapStepOpened: {
    key: "roadmap_step_opened",
    description:
      "The learner tapped a Home roadmap lesson. roadmap_step_id, section_index, step_index. premium: paid lesson. locked: the tap opened the paywall.",
  },
  trainingModeSelected: {
    key: "training_mode_selected",
    description:
      "A training mode and question count were selected. practice_entry splits mode=learning into random, topic, or roadmap.",
  },
  practiceSetupViewed: {
    key: "practice_setup_viewed",
    description: "A question-count or blitz-duration dialog became visible. setup_id links its resolution.",
  },
  practiceSetupResolved: {
    key: "practice_setup_resolved",
    description: "The learner started, cancelled or dismissed practice setup. Not a session start.",
  },
  trainingSessionStarted: {
    key: "training_session_started",
    description:
      "A question-training session was created. roadmap_step_id is set when the session came from a roadmap lesson. practice_entry splits mode=learning into random, topic, or roadmap.",
  },
  trainingSessionResumed: {
    key: "training_session_resumed",
    description: "An unfinished question-training session was resumed.",
  },
  trainingQuestionViewed: {
    key: "training_question_viewed",
    description: "A ready training question became visible. Includes attempt ID, index and already_answered; not proof that media finished loading.",
  },
  trainingFeedbackContinued: {
    key: "training_feedback_continued",
    description: "The learner tapped Next/Finish after training feedback.",
  },
  trainingQuestionAnswered: {
    key: "training_question_answered",
    description: "The learner answered one training question.",
  },
  trainingSessionCompleted: {
    key: "training_session_completed",
    description: "An attempt entered unfinished in this visit transitioned to finished. Opening a stored result never emits this.",
  },
  trainingResultViewed: {
    key: "training_result_viewed",
    description: "A training or diagnostic result became visible. result_origin is new_completion or existing_result; view_reason is initial or review_return.",
  },
  trainingResultAction: {
    key: "training_result_action",
    description: "A regular training result CTA was selected: close, finish, work_on_mistakes, new_attempt, answers, or upgrade.",
  },
  trainingAnswersReviewOpened: {
    key: "training_answers_review_opened",
    description: "The learner opened training or diagnostic answer review. review_id identifies this review visit.",
  },
  trainingAnswersReviewQuestionViewed: {
    key: "training_answers_review_question_viewed",
    description: "A training review item became visible, with answer presence, correctness and view_state=question/missing_question.",
  },
  trainingAnswersReviewClosed: {
    key: "training_answers_review_closed",
    description: "The learner returned from training review. close_reason is finished or back; viewed_count counts distinct questions in this review visit.",
  },
  trainingSessionAbandoned: {
    key: "training_session_abandoned",
    description: "The learner left an unfinished training session.",
  },
  trainingSessionEmpty: {
    key: "training_session_empty",
    description: "A training mode had no eligible questions.",
  },
  examStartRequested: {
    key: "exam_start_requested",
    description:
      "The app started loading or creating an exam. exam_entry is the opener: home, learn, practice, roadmap_step, roadmap_simulator, result_restart, home_contextual, paywall. source stays manual or study_plan.",
  },
  examStartFailed: {
    key: "exam_start_failed",
    description: "Exam launch failed before navigating to the session. launch_attempt_id joins the request; no free-form error text.",
  },
  learningAccessBlocked: {
    key: "learning_access_blocked",
    description: "Visible offline training/exam gate, not an exception or an exam restart cap. block_id links its actions.",
  },
  learningAccessBlockAction: {
    key: "learning_access_block_action",
    description: "Action on the visible offline gate: retry, open_offline_mode, or close. destination distinguishes offline-mode from paywall.",
  },
  examCategoryMismatchViewed: {
    key: "exam_category_mismatch_viewed",
    description: "An exam screen actually displayed a category conflict, with exam_session_id and both categories.",
  },
  examCategoryMismatchResolved: {
    key: "exam_category_mismatch_resolved",
    description: "A previously displayed exam category conflict no longer blocks the loaded screen.",
  },
  examCategoryMismatchAction: {
    key: "exam_category_mismatch_action",
    description: "The learner selected switch_category or close on an exam category conflict. A switch intent is not proof that the conflict resolved.",
  },
  examSessionStarted: {
    key: "exam_session_started",
    description:
      "An exam session was created. exam_entry matches exam_start_requested. roadmap_step_id is set for a roadmap step or the exam simulator.",
  },
  examSessionResumed: {
    key: "exam_session_resumed",
    description: "An active exam session was reopened.",
  },
  examQuestionAnswered: {
    key: "exam_question_answered",
    description: "An exam submission succeeded. answer_id is a stable session/order slot; answer_revision_id identifies this submission; answer_action is create/update. Wall and focused foreground durations are separate.",
  },
  examSessionCompleted: {
    key: "exam_session_completed",
    description:
      "The learner just finished an exam in this visit. Opening a stored result does not emit this. exam_entry is the opener of that attempt.",
  },
  examSessionEnded: {
    key: "exam_session_ended",
    description: "An exam was explicitly finished, abandoned or expired. Inspect status/end_reason: learner_finish with status=completed is not abandonment.",
  },
  examEmptyExit: {
    key: "exam_empty_exit",
    description:
      "The learner closed an exam before answering. Not an abandoned exam. The close button stays immediate.",
  },
  examAnswersReviewOpened: {
    key: "exam_answers_review_opened",
    description: "The learner opened completed exam answer review.",
  },
  examRestartGateShown: {
    key: "exam_restart_gate_shown",
    description:
      "The result-screen restart modal was shown after New attempt. Not a daily exam cap and not shown from the Home/Learn exam tile.",
  },
  examRestartSelected: {
    key: "exam_restart_selected",
    description:
      "Choice on the result-screen modal only: watch_ad, upgrade, dismiss, plus. Dismiss stays on result. Home/Learn do not show this modal; a separate V2 exam_limit gate can block a new launch.",
  },
  questionBookmarkChanged: {
    key: "question_bookmark_changed",
    description: "A question bookmark changed state.",
  },
  questionProblemReportRequested: {
    key: "question_problem_report_requested",
    description: "The learner opened a question-problem report email.",
  },
  aiChatOpened: {
    key: "ai_chat_opened",
    description: "The AI question assistant was opened.",
  },
  aiChatAccessBlocked: {
    key: "ai_chat_access_blocked",
    description: "AI chat required Plus access.",
  },
  aiChatMessageSent: {
    key: "ai_chat_message_sent",
    description: "A message was submitted to the AI question assistant.",
  },
  aiChatMessageResolved: {
    key: "ai_chat_message_resolved",
    description: "The AI assistant returned a response.",
  },
  aiChatMessageFailed: {
    key: "ai_chat_message_failed",
    description: "The AI assistant request failed.",
  },
  signOpened: {
    key: "sign_opened",
    description: "A road-sign detail screen was opened.",
  },
  signSearchSubmitted: {
    key: "sign_search_submitted",
    description: "A nonempty search query was observed after 400ms debounce, not a submit-button action. search_id and query_revision join result selection; no query text.",
  },
  signTestStarted: {
    key: "sign_test_started",
    description:
      "A road-sign test session started. sign_test_entry is signs_home, category, statistics, or sign_detail. category_id is the sign category, or null for the whole catalog.",
  },
  signTestQuestionAnswered: {
    key: "sign_test_question_answered",
    description: "The learner answered a road-sign test question.",
  },
  signTestEnded: {
    key: "sign_test_ended",
    description: "A road-sign test session completed or was abandoned.",
  },
  premiumPromptShown: {
    key: "premium_prompt_shown",
    description:
      "Historical Premium bottom sheet. It is no longer presented on app open or after an ad.",
  },
  premiumPromptClicked: {
    key: "premium_prompt_clicked",
    description:
      "Historical tap on the Premium bottom sheet. New events are not emitted.",
  },
  premiumPromptDismissed: {
    key: "premium_prompt_dismissed",
    description:
      "Historical dismiss of the Premium bottom sheet. New events are not emitted.",
  },
  premiumGateViewed: {
    key: "premium_gate_viewed",
    description:
      "The learner hit a Monetization V2 limit or a premium entry that opens the paywall. source matches paywall_viewed. surface splits a shared source: home_step, home_unlock, learn_topic, topics, statistics_topic, trainer_modes, question_start. moment is only the legacy prompt timing and is absent on V2 entries.",
  },
  premiumGateAction: {
    key: "premium_gate_action",
    description:
      "Choice on a Monetization V2 gate: open_paywall, watch_ad, or dismiss. surface matches premium_gate_viewed when the entry is shared.",
  },
  answerExplanationViewed: {
    key: "answer_explanation_viewed",
    description:
      "A full answer explanation was shown. access_method is premium, or free_topic when a Poland free-topic explanation stays open and is only marked as Premium.",
  },
  adRewardEarned: {
    key: "ad_reward_earned",
    description:
      "The rewarded ad SDK confirmed the reward. placement exam_unlock grants one exam credit, before the exam is created.",
  },
  paywallViewed: {
    key: "paywall_viewed",
    description:
      "The Plus paywall became visible. Entry is source and surface. moment is only present for a legacy prompt (after_exam, after_ad, app_open, manual_test).",
  },
  paywallCtaSelected: {
    key: "paywall_cta_selected",
    description: "Purchase/retry/restore intent on a paywall, before checkout guards. Not a native purchase start.",
  },
  paywallCheckoutBlocked: {
    key: "paywall_checkout_blocked",
    description: "A paywall purchase/restore handler stopped before checkout: checkout_busy, already_entitled, purchase_disabled, or not_configured.",
  },
  paywallOfferLoadStarted: {
    key: "paywall_offer_load_started",
    description: "A paywall offer availability cycle started. Cached offers do not imply a new store request.",
  },
  paywallOfferReady: {
    key: "paywall_offer_ready",
    description: "A purchasable offer is available on the current paywall; linked view/load IDs and load duration.",
  },
  paywallOfferFailed: {
    key: "paywall_offer_failed",
    description: "Offer loading failed, returned no packages or is not configured. Not an empty snapshot while loading.",
  },
  paywallTrialEligibilityStarted: {
    key: "paywall_trial_eligibility_started",
    description: "A scoped trial-eligibility helper invocation started. Not necessarily a native query or display.",
  },
  paywallTrialEligibilityResolved: {
    key: "paywall_trial_eligibility_resolved",
    description: "Normalized product eligibility outcome from that request. Unknown is not ineligible; not displayed trial or conversion.",
  },
  paywallTrialEligibilityCompleted: {
    key: "paywall_trial_eligibility_completed",
    description: "Eligibility request resolved, errored or was not queried. A detached observer result is not current UI exposure.",
  },
  paywallDismissed: {
    key: "paywall_dismissed",
    description: "The Plus paywall closed. Not a purchase outcome; access_unlocked identifies closure after access activation.",
  },
  paywallPackageSelected: {
    key: "paywall_package_selected",
    description: "Historical package selector event. The current paywall selects its package in code and does not emit this.",
  },
  paywallPlanSelected: {
    key: "paywall_plan_selected",
    description: "The user picked a subscription plan (week / month / quarter) on the plans paywall; placement is offer (top selector) or final (bottom selector).",
  },
  purchaseStarted: {
    key: "purchase_started",
    description: "A native purchase was initiated.",
  },
  purchaseStageChanged: {
    key: "purchase_stage_changed",
    description: "Checkout entered an access, offerings, durable journal or native purchase stage; timing is not a UI freeze measurement.",
  },
  purchaseAttemptRecovered: {
    key: "purchase_attempt_recovered",
    description: "An unresolved purchase was loaded from the local journal after process restart. Not a new checkout, successful payment or grant of access.",
  },
  purchasePreparationFailed: {
    key: "purchase_preparation_failed",
    description: "Checkout preparation failed before the native purchase call; no store purchase was launched by this attempt.",
  },
  purchaseOutcomeUnknown: {
    key: "purchase_outcome_unknown",
    description: "Native checkout returned StoreProblem, a network or unclassified error: no reliable charge outcome. Requires reconciliation, not automatic purchase retry.",
  },
  purchaseStatusCheckStarted: {
    key: "purchase_status_check_started",
    description: "Access reconciliation for an unresolved purchase started without launching payment.",
  },
  purchaseStatusCheckCompleted: {
    key: "purchase_status_check_completed",
    description: "Access reconciliation completed. Missing access is not proof that no charge occurred.",
  },
  purchaseStatusCheckFailed: {
    key: "purchase_status_check_failed",
    description: "Access reconciliation failed; the original purchase outcome remains unresolved.",
  },
  purchaseSucceeded: {
    key: "purchase_succeeded",
    description: "A native purchase granted access.",
  },
  purchasePending: {
    key: "purchase_pending",
    description: "The store payment or entitlement activation awaits confirmation. Not a failed purchase.",
  },
  purchaseAccessConfirmed: {
    key: "purchase_access_confirmed",
    description: "CustomerInfo confirmed access to the pending product; not proof of a new successful store transaction.",
  },
  purchaseCancelled: {
    key: "purchase_cancelled",
    description: "The store purchase flow was cancelled.",
  },
  purchaseFailed: {
    key: "purchase_failed",
    description: "A native purchase failed.",
  },
  purchaseRestoreStarted: {
    key: "purchase_restore_started",
    description: "Purchase restoration was initiated.",
  },
  purchaseRestoreSucceeded: {
    key: "purchase_restore_succeeded",
    description: "Restore completed with confirmed access: entitlement_active=true, restore_outcome=restored. Canonical restore conversion event.",
  },
  purchaseRestoreEmpty: {
    key: "purchase_restore_empty",
    description: "Purchase restoration found no access.",
  },
  purchaseRestoreFailed: {
    key: "purchase_restore_failed",
    description: "Purchase restoration failed.",
  },
  restoreStarted: {
    key: "restore_started",
    description: "Purchase restoration was initiated.",
  },
  restoreSucceeded: {
    key: "restore_succeeded",
    description: "Legacy SDK request completion, with or without access; restore_outcome and entitlement_active distinguish restored from empty. Not a restore conversion by itself.",
  },
  restoreFailed: {
    key: "restore_failed",
    description: "Purchase restoration failed.",
  },
  customerCenterOpened: {
    key: "customer_center_opened",
    description: "RevenueCat customer center was opened.",
  },
  adRequested: {
    key: "ad_requested",
    description:
      "Policy allowed an interstitial. Includes after, should_show, step, why, detail.",
  },
  adShown: {
    key: "ad_shown",
    description:
      "An interstitial was displayed. Includes after, should_show, step, why, detail.",
  },
  adDismissed: {
    key: "ad_dismissed",
    description:
      "An interstitial was dismissed. Includes after, should_show, step, why, detail.",
  },
  adSkipped: {
    key: "ad_skipped",
    description:
      "An interstitial did not show. Includes after, should_show, step, why, detail, including trigger_not_ready. Expected disabled-placement skips are silent.",
  },
  adFailed: {
    key: "ad_failed",
    description:
      "An interstitial failed after policy allowed it. Includes after, should_show, step, why, detail.",
  },
  adImpressionRevenue: {
    key: "ad_impression_revenue",
    description:
      "Google Mobile Ads impression-level paid revenue. Properties: revenue, currency, ad_unit_id, ad_format, ad_network, revenue_precision, placement. app_user_id is a super-property. Use SDK value, never derive from eCPM.",
  },
  adNativeRequestStarted: {
    key: "ad_native_request_started",
    description: "A scoped rewarded SDK load call was invoked. Not provider receipt, fill, OPENED, impression, reward or settled money.",
  },
  adImpressionObserved: {
    key: "ad_impression_observed",
    description: "A scoped rewarded impression has SDK PAID callback evidence. OPENED alone is not promoted to a native impression callback.",
  },
  adObservationFailed: {
    key: "ad_observation_failed",
    description: "Optional ad paid-listener/payload observation failed. Not an ad load/show failure or a change to the reward outcome.",
  },
  offlinePackDownloadStarted: {
    key: "offline_pack_download_started",
    description: "Offline pack download started.",
  },
  offlinePackDownloadCompleted: {
    key: "offline_pack_download_completed",
    description: "Offline pack download completed.",
  },
  offlinePackDownloadCancelled: {
    key: "offline_pack_download_cancelled",
    description: "The download promise rejected as cancelled. One terminal per operation_id; Stop intent is offline_pack_cancel_requested.",
  },
  offlinePackDownloadFailed: {
    key: "offline_pack_download_failed",
    description: "Offline pack download failed.",
  },
  offlinePackRemoved: {
    key: "offline_pack_removed",
    description: "Stored offline content was removed.",
  },
  offlineAccessBlocked: {
    key: "offline_access_blocked",
    description: "Offline functionality was requested without Plus access.",
  },
  settingsChanged: {
    key: "settings_changed",
    description: "A persisted learner preference changed.",
  },
  examCountryResolved: {
    key: "exam_country_resolved",
    description:
      "Exam country was assigned on first launch or for an existing learner without a stored country.",
  },
  examCountryChanged: {
    key: "exam_country_changed",
    description: "The learner switched exam country from Profile.",
  },
  profileActionSelected: {
    key: "profile_action_selected",
    description: "A profile support, sharing, or navigation action was selected.",
  },
  appReviewRequested: {
    key: "app_review_requested",
    description: "The native in-app review prompt was requested.",
  },
  appReviewSkipped: {
    key: "app_review_skipped",
    description: "An eligible review prompt was skipped by policy or the store API. Already-prompted skips are silent.",
  },
  appReviewFailed: {
    key: "app_review_failed",
    description: "Opening the native review prompt or store URL failed.",
  },
  progressResetConfirmed: {
    key: "progress_reset_confirmed",
    description: "The existing reset helper resolved. reset_operation_id joins intent and later onboarding; cleanup is best effort, not proof every storage/remote operation succeeded.",
  },
  signedOut: {
    key: "signed_out",
    description: "The learner signed out.",
  },
  clientErrorLogged: {
    key: "client_error_logged",
    description:
      "A normalized client error was captured. Ads/RevenueCat put why in step, why, detail — not message.",
  },
  clientFallbackUsed: {
    key: "client_fallback_used",
    description: "A product fallback path was used.",
  },
} as const satisfies Record<string, AnalyticsEventDefinition>;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]["key"];

/**
 * Event-name safety is enforced at every call site. Payload values remain
 * primitive by design. Key sanitization is not a semantic free-text allowlist.
 */
export type AnalyticsEventPayloads = {
  [EventName in AnalyticsEventName]: EventName extends keyof CriticalAnalyticsPayloads
    ? CriticalAnalyticsPayloads[EventName] & AnalyticsProperties
    : EventName extends keyof PaywallEligibilityPayloads
      ? PaywallEligibilityPayloads[EventName] & AnalyticsProperties : AnalyticsProperties;
};
export type TypedAnalyticsEventName = keyof CriticalAnalyticsPayloads | keyof PaywallEligibilityPayloads;
export type AnalyticsPayloadArguments<EventName extends AnalyticsEventName> =
  [payload: AnalyticsEventPayloads[EventName]];

const FORBIDDEN_ANALYTICS_PROPERTY_KEYS = new Set([
  "answer_given",
  "component_stack",
  "email",
  "full_name",
  "message",
  "password",
  "prompt",
  "school_code",
  "selected_answer",
  "url",
  "preview_url",
  "asset_url",
  "access_token",
  "refresh_token",
  "push_token",
  "receipt",
  "authorization",
  "history",
  "content",
  "initial_url",
  "$initial_url",
  "token",
  "attribution_token",
  "receipt_data",
  "push_notification_token",
  "query",
]);

function isSafeAnalyticsString(value: string) {
  return value.length <= 1024 &&
    !/https?:\/\/|(?:^|\s)bearer\s+\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(value);
}

/**
 * Product analytics must never receive free-form or authentication content.
 * This denylist is key-based because payloads are assembled by
 * multiple feature modules before reaching PostHog.
 * SDK lifecycle/person payloads also pass sanitizeSdkAnalyticsValue.
 * This is not a semantic allowlist for arbitrary strings.
 */
export function sanitizeAnalyticsProperties(payload?: AnalyticsProperties) {
  if (!payload) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        !FORBIDDEN_ANALYTICS_PROPERTY_KEYS.has(key.toLowerCase()) &&
        (value === null || typeof value === "boolean" || (typeof value === "string" && isSafeAnalyticsString(value)) ||
          (typeof value === "number" && Number.isFinite(value)))
    )
  ) as AnalyticsProperties;
}

/** Also protects SDK lifecycle and nested person updates, outside our wrapper. */
export function sanitizeSdkAnalyticsValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return isSafeAnalyticsString(value) ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(sanitizeSdkAnalyticsValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !FORBIDDEN_ANALYTICS_PROPERTY_KEYS.has(key.toLowerCase()))
      .map(([key, entry]) => [key, sanitizeSdkAnalyticsValue(entry)]));
  }
  return undefined;
}

/** Convert unknown failures to a low-cardinality analytics value. */
export function getAnalyticsErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.code === "string" && /^[a-z0-9_.-]{1,64}$/i.test(record.code.trim())) {
      return record.code.trim();
    }

    if (typeof record.code === "number" && Number.isFinite(record.code)) {
      return String(record.code);
    }

    if (typeof record.status === "number" && Number.isFinite(record.status)) {
      return String(record.status);
    }

    if (typeof record.name === "string" && /^[a-z0-9_.-]{1,64}$/i.test(record.name.trim())) {
      return record.name.trim();
    }
  }

  return "unknown_error";
}

export const ANALYTICS_SCREENS = {
  appEntry: "app_entry",
  onboardingLanguage: "onboarding_language",
  onboardingCategory: "onboarding_category",
  onboardingExamSchedule: "onboarding_exam_schedule",
  onboardingNotifications: "onboarding_notifications",
  onboardingMinutes: "onboarding_minutes",
  onboardingLevel: "onboarding_level",
  onboardingSchoolCode: "onboarding_school_code",
  onboardingAccess: "onboarding_access",
  onboardingPreview: "onboarding_preview",
  home: "home",
  learn: "learn",
  signsHome: "signs_home",
  profile: "profile",
  examCountry: "exam_country",
  topics: "topics",
  topicDetail: "topic_detail",
  trainerModes: "trainer_modes",
  questionTraining: "question_training",
  practice: "practice",
  mistakes: "mistakes",
  examLoading: "exam_loading",
  examSession: "exam_session",
  examResult: "exam_result",
  examAnswers: "exam_answers",
  signsCatalog: "signs_catalog",
  signCategory: "sign_category",
  signSearch: "sign_search",
  signDetail: "sign_detail",
  signPractice: "sign_practice",
  signTest: "sign_test",
  statistics: "statistics",
  paywall: "paywall",
  offlineMode: "offline_mode",
  aiChat: "ai_chat",
  accessCenter: "access_center",
  planAdjust: "plan_adjust",
  notFound: "not_found",
} as const;

export type AnalyticsScreenName =
  (typeof ANALYTICS_SCREENS)[keyof typeof ANALYTICS_SCREENS];

/**
 * Canonical payload keys. Call sites and dashboard breakdowns must use these
 * strings, not ad-hoc aliases.
 */
export const ANALYTICS_PROPERTIES = {
  analyticsSchemaVersion: "analytics_schema_version",
  after: "after",
  adFormat: "ad_format",
  adNetwork: "ad_network",
  adUnitId: "ad_unit_id",
  appUserId: "app_user_id",
  applicationId: "application_id",
  applicationIdBasis: "application_id_basis",
  asaAdGroupId: "asa_ad_group_id",
  asaAdId: "asa_ad_id",
  asaCampaignId: "asa_campaign_id",
  asaClaimType: "asa_claim_type",
  asaClickDate: "asa_click_date",
  asaConversionType: "asa_conversion_type",
  asaCountryOrRegion: "asa_country_or_region",
  asaImpressionDate: "asa_impression_date",
  asaKeywordId: "asa_keyword_id",
  asaOrgId: "asa_org_id",
  asaResult: "asa_result",
  asaUnavailableReason: "asa_unavailable_reason",
  appRunId: "app_run_id",
  appVisitId: "app_visit_id",
  screenVisitId: "screen_visit_id",
  viewState: "view_state",
  learningIntentId: "learning_intent_id",
  operationId: "operation_id",
  answerId: "answer_id",
  answerRevisionId: "answer_revision_id",
  onboardingAttemptId: "onboarding_attempt_id",
  foregroundMs: "foreground_ms",
  interactionEngagedMs: "interaction_engaged_ms",
  searchId: "search_id",
  requestId: "request_id",
  blockId: "block_id",
  clientOccurredAt: "client_occurred_at",
  choice: "choice",
  currency: "currency",
  detail: "detail",
  examCountry: "exam_country",
  eventId: "event_id",
  eventSequence: "event_sequence",
  launchAttemptId: "launch_attempt_id",
  premiumGateId: "premium_gate_id",
  reviewId: "review_id",
  setupId: "setup_id",
  trainingSessionId: "training_session_id",
  examSessionId: "exam_session_id",
  signTestSessionId: "sign_test_session_id",
  placement: "placement",
  previous: "previous",
  revenue: "revenue",
  revenuePrecision: "revenue_precision",
  shouldShow: "should_show",
  source: "source",
  step: "step",
  supabaseUserId: "supabase_user_id",
  why: "why",
} as const;

export const ANALYTICS_EXAM_COUNTRY_SOURCES = {
  default: "default",
  deviceRegion: "device_region",
  e2e: "e2e",
  legacyOnboarded: "legacy_onboarded",
  settings: "settings",
  storefront: "storefront",
} as const;

export type AnalyticsExamCountrySource =
  (typeof ANALYTICS_EXAM_COUNTRY_SOURCES)[keyof typeof ANALYTICS_EXAM_COUNTRY_SOURCES];

export const ANALYTICS_EXAM_RESTART_CHOICES = {
  dismiss: "dismiss",
  plus: "plus",
  upgrade: "upgrade",
  watchAd: "watch_ad",
} as const;

export type AnalyticsExamRestartChoice =
  (typeof ANALYTICS_EXAM_RESTART_CHOICES)[keyof typeof ANALYTICS_EXAM_RESTART_CHOICES];
