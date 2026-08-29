/**
 * Canonical mobile analytics contract.
 *
 * Keep event names stable. Dashboard logic must use these keys rather than
 * component-local strings so that releases remain comparable in PostHog.
 */
export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

type AnalyticsEventDefinition = {
  description: string;
  key: string;
};

export const ANALYTICS_EVENTS = {
  screenViewed: {
    key: "screen_viewed",
    description: "A production app screen became visible.",
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
  trainingModeSelected: {
    key: "training_mode_selected",
    description: "A training mode and question count were selected.",
  },
  trainingSessionStarted: {
    key: "training_session_started",
    description: "A question-training session was created.",
  },
  trainingSessionResumed: {
    key: "training_session_resumed",
    description: "An unfinished question-training session was resumed.",
  },
  trainingQuestionAnswered: {
    key: "training_question_answered",
    description: "The learner answered one training question.",
  },
  trainingSessionCompleted: {
    key: "training_session_completed",
    description: "A question-training session reached its result.",
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
    description: "The app started loading or creating an exam.",
  },
  examSessionStarted: {
    key: "exam_session_started",
    description: "An exam session was created.",
  },
  examSessionResumed: {
    key: "exam_session_resumed",
    description: "An active exam session was reopened.",
  },
  examQuestionAnswered: {
    key: "exam_question_answered",
    description: "The learner submitted an exam answer.",
  },
  examSessionCompleted: {
    key: "exam_session_completed",
    description: "An exam session completed with its score.",
  },
  examSessionEnded: {
    key: "exam_session_ended",
    description: "An exam was abandoned or expired.",
  },
  examAnswersReviewOpened: {
    key: "exam_answers_review_opened",
    description: "The learner opened completed exam answer review.",
  },
  examRestartGateShown: {
    key: "exam_restart_gate_shown",
    description: "The free-user exam restart gate was shown.",
  },
  examRestartSelected: {
    key: "exam_restart_selected",
    description: "The learner chose an exam restart path.",
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
    description: "A road-sign search query was submitted.",
  },
  signTestStarted: {
    key: "sign_test_started",
    description: "A road-sign test session started.",
  },
  signTestQuestionAnswered: {
    key: "sign_test_question_answered",
    description: "The learner answered a road-sign test question.",
  },
  signTestEnded: {
    key: "sign_test_ended",
    description: "A road-sign test session completed or was abandoned.",
  },
  paywallViewed: {
    key: "paywall_viewed",
    description: "The Plus paywall became visible.",
  },
  paywallPackageSelected: {
    key: "paywall_package_selected",
    description: "The learner selected a purchase package.",
  },
  purchaseStarted: {
    key: "purchase_started",
    description: "A native purchase was initiated.",
  },
  purchaseSucceeded: {
    key: "purchase_succeeded",
    description: "A native purchase granted access.",
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
    description: "Purchase restoration granted access.",
  },
  purchaseRestoreEmpty: {
    key: "purchase_restore_empty",
    description: "Purchase restoration found no access.",
  },
  purchaseRestoreFailed: {
    key: "purchase_restore_failed",
    description: "Purchase restoration failed.",
  },
  customerCenterOpened: {
    key: "customer_center_opened",
    description: "RevenueCat customer center was opened.",
  },
  adRequested: {
    key: "ad_requested",
    description: "An interstitial ad opportunity was accepted.",
  },
  adShown: {
    key: "ad_shown",
    description: "An interstitial ad was displayed.",
  },
  adDismissed: {
    key: "ad_dismissed",
    description: "An interstitial ad was dismissed.",
  },
  adSkipped: {
    key: "ad_skipped",
    description: "An interstitial ad opportunity was skipped.",
  },
  adFailed: {
    key: "ad_failed",
    description: "An interstitial ad failed to load or display.",
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
    description: "Offline pack download was cancelled.",
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
    description: "An eligible review prompt was skipped by policy or the store API.",
  },
  appReviewFailed: {
    key: "app_review_failed",
    description: "Opening the native review prompt or store URL failed.",
  },
  progressResetConfirmed: {
    key: "progress_reset_confirmed",
    description: "The learner reset all local progress.",
  },
  signedOut: {
    key: "signed_out",
    description: "The learner signed out.",
  },
  clientErrorLogged: {
    key: "client_error_logged",
    description: "A normalized client error was captured.",
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
 * primitive by design so no structured or sensitive user content is emitted.
 */
export type AnalyticsEventPayloads = {
  [EventName in AnalyticsEventName]: AnalyticsProperties;
};

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
]);

/**
 * Product analytics must never receive free-form or authentication content.
 * The allowlist is intentionally key-based because payloads are assembled by
 * multiple feature modules before reaching PostHog.
 */
export function sanitizeAnalyticsProperties(payload?: AnalyticsProperties) {
  if (!payload) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        value !== undefined && !FORBIDDEN_ANALYTICS_PROPERTY_KEYS.has(key)
    )
  ) as AnalyticsProperties;
}

/** Convert unknown failures to a low-cardinality analytics value. */
export function getAnalyticsErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.code === "string" && record.code.trim()) {
      return record.code.trim();
    }

    if (typeof record.status === "number" && Number.isFinite(record.status)) {
      return String(record.status);
    }

    if (typeof record.name === "string" && record.name.trim()) {
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
 * Super-property and payload keys for exam-country analytics.
 * Dashboard breakdowns must use these strings, not ad-hoc aliases.
 */
export const ANALYTICS_PROPERTIES = {
  examCountry: "exam_country",
  previous: "previous",
  source: "source",
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
