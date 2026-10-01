import { MONETIZATION_V2, type QuestionSessionMode } from "@prawko/config";

export const MONETIZATION_LIMITS = MONETIZATION_V2;

export type MonetizationUsage = {
  freeQuestionIds: string[];
  /** Question ids whose full explanation was already opened for free. */
  freeExplanationQuestionIds: string[];
  freeExplanationsUsed: number;
  freeExamUsed: boolean;
  wrongAnswersPreviewUsed: boolean;
  rewardedExamUnlocksTotal: number;
  rewardedExamUnlockDate: string | null;
  rewardedExamUnlocksToday: number;
  /** 1 after a completed rewarded ad, until the exam session actually starts. */
  rewardedExamCredit: number;
};

export type ExamAccessMethod = "free_initial" | "rewarded" | "premium";

export type TrainingAccessMethod =
  | "free_quota"
  | "wrong_answers_preview"
  | "premium";

const QUOTA_EXEMPT_MODES = new Set<QuestionSessionMode>([
  "initial_diagnostic",
  "exam",
]);

/** Saved questions stay open after the free pool is gone. */
const SAVED_MODES = new Set<QuestionSessionMode>(["saved", "saved_sprint"]);

export function createEmptyMonetizationUsage(): MonetizationUsage {
  return {
    freeQuestionIds: [],
    freeExplanationQuestionIds: [],
    freeExplanationsUsed: 0,
    freeExamUsed: false,
    wrongAnswersPreviewUsed: false,
    rewardedExamUnlocksTotal: 0,
    rewardedExamUnlockDate: null,
    rewardedExamUnlocksToday: 0,
    rewardedExamCredit: 0,
  };
}

export function localDateKey(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function rollUsageToToday(
  usage: MonetizationUsage,
  today = localDateKey()
): MonetizationUsage {
  if (usage.rewardedExamUnlockDate === today) {
    return usage;
  }

  return {
    ...usage,
    rewardedExamUnlockDate: today,
    rewardedExamUnlocksToday: 0,
  };
}

export function freeQuestionsRemaining(usage: MonetizationUsage) {
  return Math.max(
    0,
    MONETIZATION_LIMITS.freeUniqueQuestions - usage.freeQuestionIds.length
  );
}

export function freeExplanationsRemaining(usage: MonetizationUsage) {
  return Math.max(
    0,
    MONETIZATION_LIMITS.freeExplanations -
      Math.max(usage.freeExplanationsUsed, usage.freeExplanationQuestionIds.length)
  );
}

export function isTrainingQuotaMode(mode: QuestionSessionMode) {
  return (
    !QUOTA_EXEMPT_MODES.has(mode) &&
    !SAVED_MODES.has(mode) &&
    mode !== "wrong_answers" &&
    mode !== "weak_spots" &&
    mode !== "review_due" &&
    mode !== "high_points"
  );
}

export type TrainingStartDecision =
  | {
      action: "start";
      accessMethod: TrainingAccessMethod;
      questionLimit: number | null;
    }
  | {
      action: "paywall";
      source:
        | "training_limit"
        | "wrong_answers"
        | "weak_spots"
        | "smart_reviews"
        | "trap_questions"
        | "exam_limit";
    };

/** Unscoped practice that must stay inside the free Learn categories. */
export function usesFreeTopicPool(mode: QuestionSessionMode) {
  return (
    mode === "learning" ||
    mode === "blitz" ||
    mode === "new_questions" ||
    mode === "hard_questions" ||
    mode === "seen_not_mastered" ||
    mode === "wrong_answers"
  );
}

/**
 * Caps the session before it is created. `null` questionLimit means "all".
 * The official simulator starts on `/exam`. A question-mode exam or mini test
 * is not that free attempt.
 */
export function resolveTrainingStart(input: {
  isPlus: boolean;
  mode: QuestionSessionMode;
  questionLimit: number | null;
  /** Caps free-pool practice to the open Learn slice. */
  topicFreeQuestionLimit?: number | null;
  usage: MonetizationUsage;
  v2: boolean;
}): TrainingStartDecision {
  if (!input.v2 || input.isPlus) {
    return {
      action: "start",
      accessMethod: input.isPlus ? "premium" : "free_quota",
      questionLimit: input.questionLimit,
    };
  }

  if (input.mode === "exam" || input.mode === "mini_test") {
    return { action: "paywall", source: "exam_limit" };
  }

  if (QUOTA_EXEMPT_MODES.has(input.mode)) {
    return {
      action: "start",
      accessMethod: "free_quota",
      questionLimit: input.questionLimit,
    };
  }

  if (SAVED_MODES.has(input.mode)) {
    return {
      action: "start",
      accessMethod: "free_quota",
      questionLimit: input.questionLimit,
    };
  }

  if (input.mode === "review_due") {
    return { action: "paywall", source: "smart_reviews" };
  }

  if (input.mode === "high_points") {
    return { action: "paywall", source: "trap_questions" };
  }

  if (input.mode === "weak_spots") {
    return { action: "paywall", source: "weak_spots" };
  }

  if (input.mode === "wrong_answers") {
    if (input.usage.wrongAnswersPreviewUsed) {
      return { action: "paywall", source: "wrong_answers" };
    }

    const preview = MONETIZATION_LIMITS.wrongAnswersPreviewQuestions;
    const questionLimit =
      input.questionLimit == null
        ? preview
        : Math.min(input.questionLimit, preview);

    return {
      action: "start",
      accessMethod: "wrong_answers_preview",
      questionLimit,
    };
  }

  if (!isTrainingQuotaMode(input.mode)) {
    return {
      action: "start",
      accessMethod: "free_quota",
      questionLimit: input.questionLimit,
    };
  }

  const remaining = freeQuestionsRemaining(input.usage);

  if (remaining <= 0) {
    return { action: "paywall", source: "training_limit" };
  }

  const requested = capToFreeTopicSlice(
    input.questionLimit,
    input.mode,
    input.topicFreeQuestionLimit
  );

  return {
    action: "start",
    accessMethod: "free_quota",
    questionLimit:
      requested == null ? remaining : Math.min(requested, remaining),
  };
}

function capToFreeTopicSlice(
  questionLimit: number | null,
  mode: QuestionSessionMode,
  topicFreeQuestionLimit: number | null | undefined
) {
  if (
    topicFreeQuestionLimit == null ||
    mode === "wrong_answers" ||
    !usesFreeTopicPool(mode)
  ) {
    return questionLimit;
  }

  if (questionLimit == null) {
    return topicFreeQuestionLimit;
  }

  return Math.min(questionLimit, topicFreeQuestionLimit);
}

export function recordFreeQuestion(usage: MonetizationUsage, questionId: string) {
  if (!questionId || usage.freeQuestionIds.includes(questionId)) {
    return usage;
  }

  if (usage.freeQuestionIds.length >= MONETIZATION_LIMITS.freeUniqueQuestions) {
    return usage;
  }

  return {
    ...usage,
    freeQuestionIds: [...usage.freeQuestionIds, questionId],
  };
}

/**
 * Keeps already-seen ids and at most `remaining` new ids.
 * Returns an empty list when no new questions are left — callers must not start.
 */
export function capTrainingQuestionIds(
  questionIds: string[],
  usage: MonetizationUsage
) {
  const seen = new Set(usage.freeQuestionIds);
  const remaining = freeQuestionsRemaining(usage);

  if (remaining <= 0) {
    return [];
  }

  const picked: string[] = [];
  let fresh = 0;

  for (const questionId of questionIds) {
    if (seen.has(questionId)) {
      picked.push(questionId);
      continue;
    }

    if (fresh >= remaining) {
      continue;
    }

    picked.push(questionId);
    fresh += 1;
  }

  return picked;
}

export function capWrongAnswersPreview(questionIds: string[]) {
  return questionIds.slice(0, MONETIZATION_LIMITS.wrongAnswersPreviewQuestions);
}

export type ExplanationAccess =
  | { kind: "premium" }
  | { kind: "free"; remainingAfter: number; usage: MonetizationUsage }
  | { kind: "locked" };

export function resolveExplanationAccess(
  _usage: MonetizationUsage,
  _questionId: string,
  isPlus: boolean
): ExplanationAccess {
  if (isPlus) {
    return { kind: "premium" };
  }

  return { kind: "locked" };
}

export function canOfferRewardedExam(
  usage: MonetizationUsage,
  today = localDateKey()
) {
  const rolled = rollUsageToToday(usage, today);

  return (
    rolled.rewardedExamUnlocksToday < MONETIZATION_LIMITS.rewardedExamDailyLimit &&
    rolled.rewardedExamUnlocksTotal < MONETIZATION_LIMITS.rewardedExamLifetimeLimit
  );
}

export function rewardedExamUnlocksLeft(usage: MonetizationUsage) {
  return Math.max(
    0,
    MONETIZATION_LIMITS.rewardedExamLifetimeLimit - usage.rewardedExamUnlocksTotal
  );
}

/** Credit only. Counters move when the exam session actually starts. */
export function grantRewardedExamCredit(usage: MonetizationUsage): MonetizationUsage {
  return {
    ...usage,
    rewardedExamCredit: 1,
  };
}

export type ExamStartDecision =
  | { action: "start"; method: ExamAccessMethod }
  | { action: "sheet" };

export function resolveExamStart(input: {
  isPlus: boolean;
  isResume: boolean;
  usage: MonetizationUsage;
}): ExamStartDecision {
  if (input.isResume || input.isPlus) {
    return { action: "start", method: input.isPlus ? "premium" : input.usage.freeExamUsed ? "rewarded" : "free_initial" };
  }

  if (!input.usage.freeExamUsed) {
    return { action: "start", method: "free_initial" };
  }

  if (input.usage.rewardedExamCredit > 0) {
    return { action: "start", method: "rewarded" };
  }

  return { action: "sheet" };
}

/** Apply usage only after `exam_session_started`. */
export function commitExamStarted(
  usage: MonetizationUsage,
  method: ExamAccessMethod,
  today = localDateKey()
): MonetizationUsage {
  if (method === "premium") {
    return usage;
  }

  if (method === "free_initial") {
    return { ...usage, freeExamUsed: true };
  }

  const rolled = rollUsageToToday(usage, today);

  return {
    ...rolled,
    rewardedExamCredit: 0,
    rewardedExamUnlockDate: today,
    rewardedExamUnlocksToday: rolled.rewardedExamUnlocksToday + 1,
    rewardedExamUnlocksTotal: rolled.rewardedExamUnlocksTotal + 1,
  };
}

export function mergeMonetizationUsage(
  local: MonetizationUsage,
  remote: MonetizationUsage
): MonetizationUsage {
  const freeQuestionIds = uniqueIds([
    ...local.freeQuestionIds,
    ...remote.freeQuestionIds,
  ]).slice(0, MONETIZATION_LIMITS.freeUniqueQuestions);
  const freeExplanationQuestionIds = uniqueIds([
    ...local.freeExplanationQuestionIds,
    ...remote.freeExplanationQuestionIds,
  ]);
  const freeExplanationsUsed = Math.max(
    local.freeExplanationsUsed,
    remote.freeExplanationsUsed,
    freeExplanationQuestionIds.length
  );
  const rewardedExamUnlocksTotal = Math.max(
    local.rewardedExamUnlocksTotal,
    remote.rewardedExamUnlocksTotal
  );
  const today = localDateKey();
  const todayCount = pickTodayUnlocks(local, remote, today);

  return {
    freeQuestionIds,
    freeExplanationQuestionIds,
    freeExplanationsUsed,
    freeExamUsed: local.freeExamUsed || remote.freeExamUsed,
    wrongAnswersPreviewUsed:
      local.wrongAnswersPreviewUsed || remote.wrongAnswersPreviewUsed,
    rewardedExamUnlocksTotal,
    rewardedExamUnlockDate: todayCount.date,
    rewardedExamUnlocksToday: todayCount.count,
    rewardedExamCredit: Math.max(
      local.rewardedExamCredit,
      remote.rewardedExamCredit
    ),
  };
}

function pickTodayUnlocks(
  local: MonetizationUsage,
  remote: MonetizationUsage,
  today: string
) {
  const localToday =
    local.rewardedExamUnlockDate === today ? local.rewardedExamUnlocksToday : 0;
  const remoteToday =
    remote.rewardedExamUnlockDate === today
      ? remote.rewardedExamUnlocksToday
      : 0;
  const count = Math.max(localToday, remoteToday);

  return {
    count,
    date: count > 0 ? today : local.rewardedExamUnlockDate ?? remote.rewardedExamUnlockDate,
  };
}

function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
}
