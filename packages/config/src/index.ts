export const CONTENT_LOCALES = ["pl", "ua", "en", "de"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export const SUPPORTED_LOCALES = ["pl", "ua", "en", "de", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Question / exam content language for a UI locale (es falls back to English). */
export function getContentLocale(locale: SupportedLocale): ContentLocale {
  if (locale === "pl" || locale === "ua" || locale === "en" || locale === "de") {
    return locale;
  }

  return "en";
}

export const ACTIVE_CATEGORIES = ["B"] as const;
export type DrivingCategory = (typeof ACTIVE_CATEGORIES)[number];

export const PLAN_LEVELS = [
  "first_time",
  "repeater",
  "already_studied",
] as const;
export type PlanLevel = (typeof PLAN_LEVELS)[number];

export const STUDY_PLAN_TASK_TYPES = [
  "learn_topic",
  "review_weak_spots",
  "mini_test",
  "full_exam",
  "review_saved",
  "review_wrong_answers",
] as const;
export type StudyPlanTaskType = (typeof STUDY_PLAN_TASK_TYPES)[number];

export const TOPIC_BLOCK_IDS = [
  "signs",
  "intersections",
  "overtaking",
  "pedestrians",
  "first_aid",
  "priority",
  "safety",
  "technical",
] as const;
export type TopicBlockId = (typeof TOPIC_BLOCK_IDS)[number];

export function isTopicBlockId(value: string): value is TopicBlockId {
  return TOPIC_BLOCK_IDS.includes(value as TopicBlockId);
}

export const QUESTION_SCOPES = ["base", "specialist"] as const;
export type QuestionScope = (typeof QUESTION_SCOPES)[number];

export const QUESTION_ANSWER_TYPES = ["boolean", "abc"] as const;
export type QuestionAnswerType = (typeof QUESTION_ANSWER_TYPES)[number];

export const QUESTION_MEDIA_TYPES = ["image", "video", "none"] as const;
export type QuestionMediaType = (typeof QUESTION_MEDIA_TYPES)[number];

export const SOURCE_MEDIA_COLLECTIONS = [
  "primary",
  "pjm",
  "unknown",
] as const;
export type SourceMediaCollection = (typeof SOURCE_MEDIA_COLLECTIONS)[number];

export const MEDIA_SOURCE_KINDS = [
  "primary",
  "pjm_question",
  "pjm_answer",
] as const;
export type MediaSourceKind = (typeof MEDIA_SOURCE_KINDS)[number];

export const MEDIA_MATCH_STRATEGIES = [
  "exact",
  "normalized",
  "alias",
  "missing",
] as const;
export type MediaMatchStrategy = (typeof MEDIA_MATCH_STRATEGIES)[number];

export const MEDIA_STORAGE_BUCKET_IDS = [
  "question-images",
  "question-videos",
  "question-posters",
  "question-pjm",
] as const;
export type MediaStorageBucketId = (typeof MEDIA_STORAGE_BUCKET_IDS)[number];

export const MEDIA_STORAGE_BUCKETS = {
  images: "question-images",
  videos: "question-videos",
  posters: "question-posters",
  pjm: "question-pjm",
} as const;

export const QUESTION_SESSION_MODES = [
  "learning",
  "new_questions",
  "weak_spots",
  "hard_questions",
  "high_points",
  "review_due",
  "seen_not_mastered",
  "wrong_answers",
  "saved",
  "saved_sprint",
  "exam_tomorrow",
  "mini_test",
  "exam",
] as const;
export type QuestionSessionMode = (typeof QUESTION_SESSION_MODES)[number];

export const AI_PROVIDER_IDS = ["mock", "openai", "anthropic"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const APP_FEATURES = [
  "premium_access",
  "ai_explanations",
  "ai_question_chat",
  "exam_simulator",
] as const;
export type AppFeature = (typeof APP_FEATURES)[number];

export const AI_MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export const AI_MESSAGE_KINDS = [
  "question_explanation",
  "question_chat",
  "exam_review",
  "plan_help",
  "support",
] as const;
export type AiMessageKind = (typeof AI_MESSAGE_KINDS)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ua";
export const DEFAULT_CATEGORY: DrivingCategory = "B";

export const EXAM_RULES = {
  totalQuestions: 32,
  baseQuestions: 20,
  specialistQuestions: 12,
  durationMinutes: 25,
  maxPoints: 74,
  passingPoints: 68,
  /** WORD: time to read a base (TAK/NIE) question before media/answer. */
  baseReadSeconds: 20,
  /** WORD: time to answer a base (TAK/NIE) question after media. */
  baseAnswerSeconds: 15,
  /**
   * After the learner finishes a manually started exam video, add this many
   * seconds back onto whatever remained on the question timer.
   */
  baseVideoResumeBonusSeconds: 5,
  /** WORD: combined read + answer window for specialist (A/B/C) questions. */
  specialistSeconds: 50,
  /**
   * Soft floor for video share among base-scope exam questions (~50–60%).
   * Official rules do not fix film/photo quotas; WORD base mixes both.
   * Soft: take what's available. Do not force specialist videos.
   */
  baseVideoMinRatio: 0.55,
} as const;

/** Soft min video count for a given base-scope slot count (catalog soft quota). */
export function getExamBaseVideoMinTarget(baseQuestionTarget: number) {
  const normalized = Math.max(0, Math.floor(baseQuestionTarget));
  return Math.min(
    normalized,
    Math.round(normalized * EXAM_RULES.baseVideoMinRatio)
  );
}

export const QUESTION_MASTERY_RULES = {
  consecutiveCorrect: 3,
  minTotalCorrect: 3,
} as const;

export const STUDY_PLAN_LIMITS = {
  minDays: 7,
  recommendedDays: 14,
  maxDays: 30,
  minMinutesPerDay: 10,
  maxMinutesPerDay: 180,
} as const;

export const FEATURE_FLAGS = {
  enableCategoryBOnly: true,
  enableSchoolCodes: true,
  enableAiQuestionChat: true,
  enableExamSimulator: true,
  enableAds: true,
  enablePlusPurchase: false,
  devPlusAccess: false,
} as const;

export const AD_POLICY = {
  questionsBetweenInterstitials: 12,
  minSecondsBetweenAds: 180,
  maxAdsPerSession: 6,
  sessionInactivityResetMinutes: 30,
  /** Deprecated in Free + Ads / Plus v1; app-resume ads should stay disabled. */
  appResumeBackgroundMinutes: 10,
} as const;

export const AI_LIMITS = {
  /** Deprecated: AI chat is Plus-only in Free + Ads / Plus v1. */
  freeQuestionChatPerDay: 8,
  maxHistoryMessages: 12,
  maxPromptChars: 500,
} as const;

export const FREE_TIER_LIMITS = {
  /** Deprecated: practice is no longer capped per day in Free + Ads / Plus v1. */
  questionPracticePerDay: 20,
} as const;

export * from "./question-topics";
