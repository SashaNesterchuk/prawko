import {
  BLITZ_MAX_QUESTIONS,
  EXAM_RULES,
  QUESTION_MASTERY_RULES,
  QUESTION_SESSION_MODES,
  getExamBaseVideoMinTarget,
  getQuestionTopicFallbackFromTopicBlock,
  getContentLocale,
  isQuestionTopicId,
  isTopicBlockId,
  normalizeQuestionTopicId,
  normalizeQuestionTopicIds,
  type DrivingCategory,
  type LearningTopicId,
  type QuestionSessionMode,
  type QuestionTopicId,
  type SupportedLocale,
} from "@prawko/config";

import { getQuestionBank, getQuestionBankById } from "./question-bank";
import type {
  LocalQuestion,
  LocalizedQuestionText,
  QuestionChoice,
  QuestionDerivedState,
  QuestionSession,
  QuestionSessionRequest,
  QuestionSessionSummary,
  QuestionUserState,
  QuestionUserStateMap,
  TopicQuestionProgress,
  TopicQuestionProgressMap,
} from "./types";

const EXAM_PREVIEW_TOTAL = 12;
const SAVED_SPRINT_TOTAL = 10;
const HIGH_POINTS_THRESHOLD = 3;

const BOOLEAN_CHOICES: Record<
  "true" | "false",
  Record<"pl" | "ua" | "en" | "de" | "cs" | "el", string>
> = {
  true: {
    pl: "Tak",
    ua: "Так",
    en: "Yes",
    de: "Ja",
    cs: "Ano",
    el: "Ναι",
  },
  false: {
    pl: "Nie",
    ua: "Ні",
    en: "No",
    de: "Nein",
    cs: "Ne",
    el: "Όχι",
  },
};

export function isQuestionSessionMode(value: string): value is QuestionSessionMode {
  return QUESTION_SESSION_MODES.includes(value as QuestionSessionMode);
}

export function getQuestionTopicIds(question: LocalQuestion): QuestionTopicId[] {
  const fallback = getQuestionTopicFallbackFromTopicBlock(question.topicBlock);
  const topicIds = normalizeQuestionTopicIds(question.topicIds ?? []);

  if (topicIds.length > 0) {
    return topicIds;
  }

  return fallback.topicIds;
}

export function getQuestionPrimaryTopicId(question: LocalQuestion): QuestionTopicId {
  const topicIds = getQuestionTopicIds(question);
  const fallback = getQuestionTopicFallbackFromTopicBlock(question.topicBlock);
  const primaryTopicId = normalizeQuestionTopicId(question.primaryTopicId);

  if (primaryTopicId && topicIds.includes(primaryTopicId)) {
    return primaryTopicId;
  }

  return topicIds[0] ?? fallback.primaryTopicId;
}

function questionMatchesTopic(
  question: LocalQuestion,
  topic: LearningTopicId
) {
  // Catalog topics use explicit membership; legacy blocks use topicBlock.
  if (isQuestionTopicId(topic)) {
    return getQuestionTopicIds(question).includes(topic);
  }

  return isTopicBlockId(topic) && question.topicBlock === topic;
}

function getTopicScopedQuestions(topic?: LearningTopicId) {
  if (!topic) {
    return getQuestionBank();
  }

  return getCachedQuestionsForTopic(topic);
}

type TopicQuestionsCache = {
  bank: LocalQuestion[];
  byTopic: Map<string, LocalQuestion[]>;
};

let topicQuestionsCache: TopicQuestionsCache | null = null;

function topicQuestionsCacheKey(topic: LearningTopicId) {
  // Separate keys prevent legacy block membership from leaking into catalog
  // topic lookups.
  return isQuestionTopicId(topic) ? `catalog:${topic}` : `block:${topic}`;
}

function getCachedQuestionsForTopic(topic: LearningTopicId) {
  const bank = getQuestionBank();

  if (!topicQuestionsCache || topicQuestionsCache.bank !== bank) {
    const byTopic = new Map<string, LocalQuestion[]>();

    const push = (cacheKey: string, question: LocalQuestion) => {
      const existing = byTopic.get(cacheKey);
      if (existing) {
        existing.push(question);
        return;
      }
      byTopic.set(cacheKey, [question]);
    };

    for (const question of bank) {
      push(`block:${question.topicBlock}`, question);
      for (const topicId of getQuestionTopicIds(question)) {
        push(`catalog:${topicId}`, question);
      }
    }

    topicQuestionsCache = { bank, byTopic };
  }

  return topicQuestionsCache.byTopic.get(topicQuestionsCacheKey(topic)) ?? [];
}

function isHighPointsQuestion(question: LocalQuestion) {
  return question.points >= HIGH_POINTS_THRESHOLD;
}

export function createQuestionSessionKey(input: {
  currentCategory?: string;
  mode: QuestionSessionMode;
  topic?: LearningTopicId;
}) {
  return `${input.currentCategory ?? "category"}-${input.mode}-${input.topic ?? "all"}-${Date.now().toString(36)}`;
}

export function createEmptyQuestionUserState(questionId: string): QuestionUserState {
  return {
    questionId,
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    consecutiveCorrect: 0,
    lastSeenAt: null,
    lastCorrectAt: null,
    lastWrongAt: null,
    reviewDueAt: null,
    masteryScore: 0,
    isHard: false,
    isBookmarked: false,
    isMastered: false,
  };
}

export function normalizeQuestionUserState(
  questionId: string,
  state?: Partial<QuestionUserState> | null
): QuestionUserState {
  const baseState = createEmptyQuestionUserState(questionId);
  const mergedState = {
    ...baseState,
    ...(state ?? {}),
    questionId,
  } as QuestionUserState;
  const consecutiveCorrect = resolveConsecutiveCorrect(
    mergedState,
    state?.consecutiveCorrect
  );
  const masteryScore = resolveMasteryScore(
    {
      ...mergedState,
      consecutiveCorrect,
    },
    state?.masteryScore
  );
  const isMastered =
    typeof state?.isMastered === "boolean"
      ? state.isMastered
      : isQuestionMastered({
          ...mergedState,
          consecutiveCorrect,
        });

  return {
    ...mergedState,
    consecutiveCorrect,
    masteryScore,
    isMastered,
  };
}

export function normalizeQuestionUserStateMap(userStates: QuestionUserStateMap) {
  return Object.fromEntries(
    Object.entries(userStates).map(([questionId, state]) => [
      questionId,
      normalizeQuestionUserState(questionId, state),
    ])
  ) as QuestionUserStateMap;
}

/**
 * Stats screens normalize the whole bank (thousands of questions) on every
 * answer, so the results are cached per stored object. Stored states are
 * replaced, never mutated, which keeps the cache in sync.
 */
const normalizedStateCache = new WeakMap<object, QuestionUserState>();
const emptyStateCache = new Map<string, QuestionUserState>();

export function getQuestionUserState(
  userStates: QuestionUserStateMap,
  questionId: string
) {
  const storedState = userStates[questionId];

  if (!storedState) {
    const cachedEmptyState = emptyStateCache.get(questionId);

    if (cachedEmptyState) {
      return cachedEmptyState;
    }

    const emptyState = createEmptyQuestionUserState(questionId);
    emptyStateCache.set(questionId, emptyState);

    return emptyState;
  }

  const cachedState = normalizedStateCache.get(storedState);

  if (cachedState && cachedState.questionId === questionId) {
    return cachedState;
  }

  const normalizedState = normalizeQuestionUserState(questionId, storedState);
  normalizedStateCache.set(storedState, normalizedState);

  return normalizedState;
}

export function isQuestionReviewDue(
  state: QuestionUserState,
  now: Date = new Date()
) {
  if (!state.reviewDueAt) {
    return false;
  }

  return new Date(state.reviewDueAt).getTime() <= now.getTime();
}

export function getDerivedQuestionState(
  state: QuestionUserState,
  now: Date = new Date()
): QuestionDerivedState {
  if (state.timesSeen === 0) {
    return {
      isReviewDue: false,
      status: "unseen",
    };
  }

  if (isQuestionMastered(state)) {
    return {
      isReviewDue: isQuestionReviewDue(state, now),
      status: "mastered",
    };
  }

  if (state.isHard) {
    return {
      isReviewDue: isQuestionReviewDue(state, now),
      status: "hard",
    };
  }

  if (isQuestionUnresolvedWrong(state)) {
    return {
      isReviewDue: isQuestionReviewDue(state, now),
      status: "wrong_recently",
    };
  }

  if (isQuestionConsolidating(state)) {
    return {
      isReviewDue: isQuestionReviewDue(state, now),
      status: "consolidating",
    };
  }

  if (state.timesCorrect > 0 || state.consecutiveCorrect > 0) {
    return {
      isReviewDue: isQuestionReviewDue(state, now),
      status: "correct_once",
    };
  }

  return {
    isReviewDue: isQuestionReviewDue(state, now),
    status: "seen",
  };
}

export function isQuestionMastered(state: QuestionUserState) {
  return (
    state.isMastered ||
    (state.consecutiveCorrect >= QUESTION_MASTERY_RULES.consecutiveCorrect &&
      state.timesCorrect >= QUESTION_MASTERY_RULES.minTotalCorrect)
  );
}

export function isQuestionConsolidating(state: QuestionUserState) {
  return (
    state.timesWrong > 0 &&
    !isQuestionUnresolvedWrong(state) &&
    !isQuestionMastered(state)
  );
}

export function getMasteryProgress(state: QuestionUserState) {
  return {
    current: Math.min(
      state.consecutiveCorrect,
      QUESTION_MASTERY_RULES.consecutiveCorrect
    ),
    target: QUESTION_MASTERY_RULES.consecutiveCorrect,
  };
}

export function isQuestionUnresolvedWrong(state: QuestionUserState) {
  if (state.timesWrong === 0) {
    return false;
  }

  const lastWrongAt = getTimestamp(state.lastWrongAt);
  const lastCorrectAt = getTimestamp(state.lastCorrectAt);

  if (lastWrongAt === null) {
    return state.timesWrong >= state.timesCorrect;
  }

  if (lastCorrectAt === null) {
    return true;
  }

  return lastWrongAt >= lastCorrectAt;
}

export function getNextQuestionUserStateAfterAttempt(
  currentState: QuestionUserState,
  input: {
    answeredAt: string;
    isCorrect: boolean;
  }
) {
  const normalizedState = normalizeQuestionUserState(
    currentState.questionId,
    currentState
  );
  const nextState = normalizeQuestionUserState(normalizedState.questionId, {
    ...normalizedState,
    timesSeen: normalizedState.timesSeen + 1,
    timesCorrect:
      normalizedState.timesCorrect + (input.isCorrect ? 1 : 0),
    timesWrong: normalizedState.timesWrong + (input.isCorrect ? 0 : 1),
    consecutiveCorrect: input.isCorrect
      ? normalizedState.consecutiveCorrect + 1
      : 0,
    lastSeenAt: input.answeredAt,
    lastCorrectAt: input.isCorrect
      ? input.answeredAt
      : normalizedState.lastCorrectAt,
    lastWrongAt: input.isCorrect
      ? normalizedState.lastWrongAt
      : input.answeredAt,
  });

  return {
    ...nextState,
    reviewDueAt: getReviewDueAtForState(nextState),
  };
}

export function createEmptyTopicQuestionProgress(): TopicQuestionProgress {
  return {
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    lastCorrectAt: null,
    lastWrongAt: null,
  };
}

export function getTopicQuestionProgress(
  topicProgress: TopicQuestionProgressMap,
  topic: LearningTopicId,
  questionId: string
): TopicQuestionProgress {
  return (
    topicProgress[topic]?.[questionId] ?? createEmptyTopicQuestionProgress()
  );
}

export function getNextTopicQuestionProgressAfterAttempt(
  current: TopicQuestionProgress,
  input: {
    answeredAt: string;
    isCorrect: boolean;
  }
): TopicQuestionProgress {
  return {
    timesSeen: current.timesSeen + 1,
    timesCorrect: current.timesCorrect + (input.isCorrect ? 1 : 0),
    timesWrong: current.timesWrong + (input.isCorrect ? 0 : 1),
    lastCorrectAt: input.isCorrect
      ? input.answeredAt
      : current.lastCorrectAt,
    lastWrongAt: input.isCorrect ? current.lastWrongAt : input.answeredAt,
  };
}

/**
 * One training attempt covers every catalog topic assigned to the question.
 * The caller decides whether the map represents overall topic coverage or
 * practice completed inside a specifically opened topic.
 */
export function getNextTopicQuestionProgressMapAfterAttempt(
  topicProgress: TopicQuestionProgressMap,
  topicIds: readonly QuestionTopicId[],
  questionId: string,
  input: {
    answeredAt: string;
    isCorrect: boolean;
  }
): TopicQuestionProgressMap {
  let nextTopicProgress = topicProgress;

  for (const topicId of new Set(topicIds)) {
    const previousTopicProgress = getTopicQuestionProgress(
      nextTopicProgress,
      topicId,
      questionId
    );
    const nextQuestionProgress = getNextTopicQuestionProgressAfterAttempt(
      previousTopicProgress,
      input
    );

    nextTopicProgress = {
      ...nextTopicProgress,
      [topicId]: {
        ...nextTopicProgress[topicId],
        [questionId]: nextQuestionProgress,
      },
    };
  }

  return nextTopicProgress;
}

/**
 * Topic-scoped queues should only see attempts made inside that topic. Global
 * flags (bookmark, hard, SRS) stay shared across topics.
 */
export function getTopicScopedUserStates(
  userStates: QuestionUserStateMap,
  topicProgress: TopicQuestionProgressMap,
  topic: LearningTopicId
): QuestionUserStateMap {
  const questions = getTopicScopedQuestions(topic);
  // Only materialize states for this topic's questions. Spreading the entire
  // global map here previously froze Learn/topics when many topics recomputed.
  const nextStates: QuestionUserStateMap = {};

  for (const question of questions) {
    const globalState = getQuestionUserState(userStates, question.id);
    const topicState = getTopicQuestionProgress(
      topicProgress,
      topic,
      question.id
    );

    nextStates[question.id] = {
      ...globalState,
      timesSeen: topicState.timesSeen,
      timesCorrect: topicState.timesCorrect,
      timesWrong: topicState.timesWrong,
      lastCorrectAt: topicState.lastCorrectAt,
      lastWrongAt: topicState.lastWrongAt,
    };
  }

  return nextStates;
}

function getEffectiveUserStatesForTopicRequest(
  userStates: QuestionUserStateMap,
  topicProgress: TopicQuestionProgressMap,
  topic?: LearningTopicId,
  mode?: QuestionSessionMode
) {
  // Topic blocks have single membership per question; only multi-topic ids need
  // the overlay. Blocks keep reading the global map.
  if (!topic || isTopicBlockId(topic)) {
    return userStates;
  }

  // Mistakes are global (exams / random / other topics still count). Topic only
  // filters the question pool — same rule as getTopicMistakeProgress.
  if (mode === "wrong_answers") {
    return userStates;
  }

  return getTopicScopedUserStates(userStates, topicProgress, topic);
}

/**
 * One-time migration: attribute legacy global attempts to each question's
 * primary topic so Learn cards are not wiped empty after the scoped upgrade.
 */
export function seedTopicQuestionProgressFromUserState(
  userStates: QuestionUserStateMap
): TopicQuestionProgressMap {
  const topicProgress: TopicQuestionProgressMap = {};

  for (const [questionId, state] of Object.entries(userStates)) {
    if (state.timesSeen <= 0) {
      continue;
    }

    const question = getQuestionById(questionId);

    if (!question) {
      continue;
    }

    const topic = getQuestionPrimaryTopicId(question);
    const topicMap = topicProgress[topic] ?? {};
    topicMap[questionId] = {
      timesSeen: state.timesSeen,
      timesCorrect: state.timesCorrect,
      timesWrong: state.timesWrong,
      lastCorrectAt: state.lastCorrectAt,
      lastWrongAt: state.lastWrongAt,
    };
    topicProgress[topic] = topicMap;
  }

  return topicProgress;
}

export function getQuestionById(questionId: string) {
  return getQuestionBankById()[questionId];
}

export function getLocalizedText(
  value: LocalizedQuestionText,
  locale: SupportedLocale
) {
  const contentLocale = getContentLocale(locale);
  return (
    value[contentLocale] ||
    value.en ||
    value.ua ||
    value.pl ||
    ""
  );
}

export function getQuestionChoices(
  question: LocalQuestion,
  locale: SupportedLocale
): Array<{
  id: QuestionChoice["id"];
  label: string;
}> {
  const contentLocale = getContentLocale(locale);

  if (question.answerType === "boolean") {
    return [
      {
        id: "true",
        label: BOOLEAN_CHOICES.true[contentLocale],
      },
      {
        id: "false",
        label: BOOLEAN_CHOICES.false[contentLocale],
      },
    ];
  }

  return (question.choices ?? []).map((choice) => ({
    id: choice.id,
    label: getLocalizedText(choice.text, locale),
  }));
}

export function getQuestionSessionSummary(
  session: QuestionSession | null
): QuestionSessionSummary {
  const answers = session ? Object.values(session.answers) : [];
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const timedFinished = Boolean(
    session?.finishedAt && isTimedQuestionSession(session)
  );

  return {
    total: timedFinished ? answers.length : session?.questionIds.length ?? 0,
    answered: answers.length,
    correct,
    wrong: answers.length - correct,
  };
}

export function isTimedQuestionSession(
  session: Pick<QuestionSession, "request"> | null | undefined
) {
  return (session?.request.timeLimitSeconds ?? 0) > 0;
}

export function getQuestionSessionExpiresAt(
  session: QuestionSession
): string | null {
  if (session.expiresAt) {
    return session.expiresAt;
  }

  const timeLimitSeconds = session.request.timeLimitSeconds;

  if (!timeLimitSeconds || timeLimitSeconds <= 0) {
    return null;
  }

  const createdAt = Date.parse(session.createdAt);

  if (!Number.isFinite(createdAt)) {
    return null;
  }

  return new Date(createdAt + timeLimitSeconds * 1000).toISOString();
}

export function getRemainingSessionSeconds(
  session: QuestionSession | null | undefined,
  now: Date = new Date()
): number | null {
  if (!session) {
    return null;
  }

  const expiresAt = getQuestionSessionExpiresAt(session);

  if (!expiresAt) {
    return null;
  }

  return Math.max(0, Math.floor((Date.parse(expiresAt) - now.getTime()) / 1000));
}

export function isQuestionSessionExpired(
  session: QuestionSession,
  now: Date = new Date()
) {
  const remaining = getRemainingSessionSeconds(session, now);
  return remaining !== null && remaining <= 0;
}

export function formatSessionCountdown(totalSeconds: number) {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (normalized % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

/**
 * Close a session. Timed runs drop unanswered items so the result screen
 * scores only what the user actually reached.
 */
export function finishQuestionSession(
  session: QuestionSession,
  now: Date = new Date()
): QuestionSession {
  const finishedAt = session.finishedAt ?? now.toISOString();

  if (!isTimedQuestionSession(session)) {
    return {
      ...session,
      finishedAt,
    };
  }

  const answeredIds = session.questionIds.filter(
    (questionId) => session.answers[questionId]
  );

  return {
    ...session,
    currentIndex: Math.max(0, answeredIds.length - 1),
    finishedAt,
    questionIds: answeredIds,
  };
}

type QuestionDisplayStats = {
  total: number;
  hardQuestions: number;
  wrongAnswers: number;
  saved: number;
  reviewDue: number;
  seen: number;
  seenNotMastered: number;
  weakSpots: number;
};

/**
 * Home, learn, profile and the trainer all ask for these counters on the same
 * state object, so the full-bank scan is shared. Review-due depends on the
 * clock, hence the short TTL.
 */
const displayStatsCache = new WeakMap<
  QuestionUserStateMap,
  {
    computedAt: number;
    questionBank: LocalQuestion[];
    stats: QuestionDisplayStats;
  }
>();
const DISPLAY_STATS_TTL_MS = 30_000;

export function getQuestionDisplayStats(
  userStates: QuestionUserStateMap
): QuestionDisplayStats {
  const questionBank = getQuestionBank();
  const cached = displayStatsCache.get(userStates);

  if (
    cached &&
    cached.questionBank === questionBank &&
    Date.now() - cached.computedAt < DISPLAY_STATS_TTL_MS
  ) {
    return cached.stats;
  }

  const stats = computeQuestionDisplayStats(userStates, questionBank);
  displayStatsCache.set(userStates, {
    computedAt: Date.now(),
    questionBank,
    stats,
  });

  return stats;
}

function computeQuestionDisplayStats(
  userStates: QuestionUserStateMap,
  questionBank: LocalQuestion[]
): QuestionDisplayStats {
  const now = new Date();
  const stats: QuestionDisplayStats = {
    total: questionBank.length,
    hardQuestions: 0,
    wrongAnswers: 0,
    saved: 0,
    reviewDue: 0,
    seen: 0,
    seenNotMastered: 0,
    weakSpots: 0,
  };

  for (const question of questionBank) {
    const state = getQuestionUserState(userStates, question.id);

    // Untouched questions score zero on every counter below.
    if (state.timesSeen === 0 && !state.isHard && !state.isBookmarked) {
      continue;
    }

    const isUnresolvedWrong = isQuestionUnresolvedWrong(state);
    const isDueForReview = isQuestionDueForReview(state, now);

    if (state.isHard) {
      stats.hardQuestions += 1;
    }

    if (isUnresolvedWrong) {
      stats.wrongAnswers += 1;
    }

    if (state.isBookmarked) {
      stats.saved += 1;
    }

    // Smart review pool includes mastered cards whose refresh timer elapsed.
    if (isQuestionEligibleForSmartReview(state, now)) {
      stats.reviewDue += 1;
    }

    if (state.timesSeen > 0) {
      stats.seen += 1;
    }

    if (isSeenNotMasteredState(state, now)) {
      stats.seenNotMastered += 1;
    }

    if (isUnresolvedWrong || state.isHard || isDueForReview) {
      stats.weakSpots += 1;
    }
  }

  return stats;
}

/**
 * Counts used by the trainer mode picker: how many questions each mode would
 * queue right now, scoped to a topic when the picker was opened from one.
 */
export function getTrainerModeStats(
  userStates: QuestionUserStateMap,
  topic?: LearningTopicId,
  topicContextProgress: TopicQuestionProgressMap = {}
) {
  const questions = getTopicScopedQuestions(topic);
  const effectiveStates = getEffectiveUserStatesForTopicRequest(
    userStates,
    topicContextProgress,
    topic
  );
  const states = questions.map((question) =>
    getQuestionUserState(effectiveStates, question.id)
  );
  // Count global unresolved wrongs for the topic pool — not the Learn overlay.
  const globalStates = questions.map((question) =>
    getQuestionUserState(userStates, question.id)
  );

  return {
    total: questions.length,
    unseen: states.filter((state) => state.timesSeen === 0).length,
    saved: states.filter((state) => state.isBookmarked).length,
    wrongAnswers: globalStates.filter((state) =>
      isQuestionUnresolvedWrong(state)
    ).length,
    highPoints: questions.filter(isHighPointsQuestion).length,
  };
}

/** Length of the queue a mode would build, so the count picker can offer "all". */
export function getQuestionCountForMode(
  input: {
    currentCategory: DrivingCategory;
    mode: QuestionSessionMode;
    topic?: LearningTopicId;
  },
  userStates: QuestionUserStateMap,
  topicContextProgress: TopicQuestionProgressMap = {},
  now: Date = new Date()
) {
  return getQuestionIdsForMode(
    {
      currentCategory: input.currentCategory,
      mode: input.mode,
      sessionKey: "count-probe",
      topic: input.topic,
    },
    getEffectiveUserStatesForTopicRequest(
      userStates,
      topicContextProgress,
      input.topic,
      input.mode
    ),
    now
  ).length;
}

/**
 * Questions ever answered wrong vs those later corrected (last correct after last wrong).
 * `percent` is null when there are no mistaken questions yet.
 */
export function getMistakesFixedStats(userStates: QuestionUserStateMap) {
  const questionBank = getQuestionBank();
  let total = 0;
  let fixed = 0;

  for (const question of questionBank) {
    const state = getQuestionUserState(userStates, question.id);

    if (state.timesWrong <= 0) {
      continue;
    }

    total += 1;

    if (!isQuestionUnresolvedWrong(state)) {
      fixed += 1;
    }
  }

  return {
    fixed,
    total,
    percent: total > 0 ? Math.round((fixed / total) * 100) : null,
  };
}

export function getSeenQuestionIds(userStates: QuestionUserStateMap) {
  return getQuestionBank()
    .filter(
      (question) => getQuestionUserState(userStates, question.id).timesSeen > 0
    )
    .map((question) => question.id);
}

export function getOverallLearningStats(userStates: QuestionUserStateMap) {
  const questionBank = getQuestionBank();
  const states = questionBank.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const answered = states.reduce((sum, state) => sum + state.timesSeen, 0);
  const correct = states.reduce((sum, state) => sum + state.timesCorrect, 0);
  const wrong = states.reduce((sum, state) => sum + state.timesWrong, 0);
  const readiness =
    questionBank.length === 0
      ? 0
      : Math.round(
          (states.filter((state) => state.timesCorrect > 0).length /
            questionBank.length) *
            100
        );

  return {
    total: questionBank.length,
    answered,
    correct,
    wrong,
    readiness,
  };
}

export function getOverallMistakesStats(userStates: QuestionUserStateMap) {
  const questionBank = getQuestionBank();
  const states = questionBank.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const wrong = states.filter((state) => isQuestionUnresolvedWrong(state)).length;
  const total = questionBank.length;
  const answered = states.reduce((sum, state) => sum + state.timesSeen, 0);
  const correct = Math.max(0, total - wrong);
  const readiness =
    total === 0 ? 100 : Math.round(((total - wrong) / total) * 100);

  return {
    total,
    answered,
    correct,
    wrong,
    readiness,
  };
}

export function getOverallConsolidationStats(userStates: QuestionUserStateMap) {
  const questionBank = getQuestionBank();
  const states = questionBank.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const consolidating = states.filter((state) =>
    isQuestionConsolidating(state)
  ).length;
  const total = questionBank.length;
  const readiness =
    total === 0
      ? 100
      : Math.round(
          (states.filter((state) => isQuestionMastered(state)).length / total) *
            100
        );

  return {
    total,
    consolidating,
    readiness,
  };
}

export function getTopicConsolidationProgress(
  topic: LearningTopicId,
  userStates: QuestionUserStateMap
) {
  const questions = getQuestionBank().filter(
    (question) => questionMatchesTopic(question, topic)
  );
  const states = questions.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const consolidating = states.filter((state) =>
    isQuestionConsolidating(state)
  ).length;
  const total = questions.length;
  const progress =
    total === 0
      ? 100
      : Math.round(
          (states.filter((state) => isQuestionMastered(state)).length / total) *
            100
        );

  return {
    total,
    consolidating,
    progress,
  };
}

export function getTopicMistakeProgress(
  topic: LearningTopicId,
  userStates: QuestionUserStateMap,
  topicProgress: TopicQuestionProgressMap = {}
) {
  const questions = getQuestionBank().filter(
    (question) => questionMatchesTopic(question, topic)
  );
  // Mistakes are global unresolved wrongs attributed to each question's topics.
  // Do not use the topic-scoped overlay here: wrong answers from exams / random
  // sessions still belong on the mistakes monitor for that catalog topic.
  void topicProgress;
  const states = questions.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const wrong = states.filter((state) => isQuestionUnresolvedWrong(state)).length;
  const seen = states.filter((state) => state.timesSeen > 0).length;
  const correct = Math.max(0, seen - wrong);
  const total = questions.length;
  const progress =
    total === 0 ? 100 : Math.round(((total - wrong) / total) * 100);

  return {
    total,
    seen,
    correct,
    wrong,
    progress,
  };
}

export function getTopicProgress(
  topic: LearningTopicId,
  userStates: QuestionUserStateMap,
  topicProgress: TopicQuestionProgressMap = {}
) {
  const questions = getCachedQuestionsForTopic(topic);
  const useTopicOverlay = !isTopicBlockId(topic);
  let seen = 0;
  let correct = 0;
  let wrong = 0;
  let weak = 0;
  let mastered = 0;

  for (const question of questions) {
    const globalState = getQuestionUserState(userStates, question.id);
    let state = globalState;

    if (useTopicOverlay) {
      const topicState = getTopicQuestionProgress(
        topicProgress,
        topic,
        question.id
      );
      state = {
        ...globalState,
        timesSeen: topicState.timesSeen,
        timesCorrect: topicState.timesCorrect,
        timesWrong: topicState.timesWrong,
        lastCorrectAt: topicState.lastCorrectAt,
        lastWrongAt: topicState.lastWrongAt,
      };
    }

    if (state.timesSeen > 0) {
      seen += 1;
    }
    if (state.timesCorrect > 0) {
      correct += 1;
    }
    if (state.timesWrong > 0) {
      wrong += 1;
    }
    if (isWeakSpotState(state)) {
      weak += 1;
    }
    if (isQuestionMastered(state)) {
      mastered += 1;
    }
  }

  return {
    total: questions.length,
    seen,
    correct,
    wrong,
    weak,
    mastered,
    progress:
      questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100),
  };
}

export function getExamQuestionIds(
  userStates: QuestionUserStateMap,
  desiredTotal: number,
  now: Date = new Date()
) {
  return getExamPreviewQuestionIds(userStates, now, desiredTotal);
}

export function buildQuestionSession(
  request: QuestionSessionRequest,
  userStates: QuestionUserStateMap,
  now: Date = new Date(),
  topicContextProgress: TopicQuestionProgressMap = {}
): QuestionSession {
  const effectiveStates = getEffectiveUserStatesForTopicRequest(
    userStates,
    topicContextProgress,
    request.topic,
    request.mode
  );
  const questionIds = getQuestionIdsForMode(request, effectiveStates, now);
  const emptyReason = getEmptyReason(request, questionIds.length);
  const createdAt = now.toISOString();
  const timeLimitSeconds = getNormalizedQuestionLimit(request.timeLimitSeconds);
  const expiresAt =
    timeLimitSeconds != null
      ? new Date(now.getTime() + timeLimitSeconds * 1000).toISOString()
      : null;

  return {
    id: `session-${request.sessionKey}`,
    request: {
      ...request,
      timeLimitSeconds,
    },
    questionIds,
    currentIndex: 0,
    answers: {},
    createdAt,
    expiresAt,
    finishedAt: questionIds.length === 0 ? createdAt : null,
    emptyReason,
  };
}

/** `sessionKey` is regenerated on every entry, so it is not part of identity. */
function isSameQuestionSessionRequest(
  left: QuestionSessionRequest,
  right: QuestionSessionRequest
) {
  return (
    left.currentCategory === right.currentCategory &&
    left.mode === right.mode &&
    (left.topic ?? null) === (right.topic ?? null) &&
    (left.questionLimit ?? null) === (right.questionLimit ?? null) &&
    (left.timeLimitSeconds ?? null) === (right.timeLimitSeconds ?? null) &&
    (left.studyPlanTaskId ?? null) === (right.studyPlanTaskId ?? null)
  );
}

/**
 * Only a session with progress is worth resuming: without an answer there is
 * nothing to continue from, and a fresh draw is the better start.
 */
export function canResumeQuestionSession(
  session: QuestionSession,
  request: QuestionSessionRequest
) {
  return (
    !session.finishedAt &&
    !session.emptyReason &&
    isSameQuestionSessionRequest(session.request, request) &&
    Object.keys(session.answers).length > 0 &&
    session.questionIds.some((questionId) => !session.answers[questionId])
  );
}

/**
 * Re-entering training opens at the first question without an answer, so the
 * feedback panel starts closed and everything above it is already answered.
 * The session adopts the new key, which keeps repeat calls a no-op.
 */
export function resumeQuestionSession(
  session: QuestionSession,
  request: QuestionSessionRequest
): QuestionSession {
  if (session.request.sessionKey === request.sessionKey) {
    return session;
  }

  const firstUnansweredIndex = session.questionIds.findIndex(
    (questionId) => !session.answers[questionId]
  );

  return {
    ...session,
    currentIndex:
      firstUnansweredIndex >= 0 ? firstUnansweredIndex : session.currentIndex,
    request: {
      ...session.request,
      sessionKey: request.sessionKey,
    },
  };
}

function getQuestionIdsForMode(
  request: QuestionSessionRequest,
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionLimit = getNormalizedQuestionLimit(request.questionLimit);

  switch (request.mode) {
    case "learning": {
      const learningIds = getLearningQuestionIds(
        request.topic,
        userStates,
        now
      );

      // Topic-less limited sessions are the app's "random" entry points
      // (trainer random). Shuffle so each run differs.
      if (request.topic == null && questionLimit != null) {
        return takeRandomQuestionIds(learningIds, questionLimit);
      }

      return applyQuestionLimit(learningIds, questionLimit);
    }
    case "blitz":
      return applyQuestionLimit(
        getBlitzQuestionIds(userStates, now),
        questionLimit ?? BLITZ_MAX_QUESTIONS
      );
    case "new_questions":
      return applyQuestionLimit(
        getNewQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "weak_spots":
      return applyQuestionLimit(getWeakSpotQuestionIds(userStates, now), questionLimit);
    case "hard_questions":
      return applyQuestionLimit(
        getHardQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "high_points":
      return applyQuestionLimit(
        getHighPointsQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "review_due":
      return applyQuestionLimit(
        getReviewDueQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "seen_not_mastered":
      return applyQuestionLimit(
        getSeenNotMasteredQuestionIds(userStates, now),
        questionLimit
      );
    case "wrong_answers":
      return applyQuestionLimit(
        getWrongAnswerQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "saved":
      return applyQuestionLimit(
        getSavedQuestionIds(userStates, now, request.topic),
        questionLimit
      );
    case "saved_sprint":
      return applyQuestionLimit(
        getSavedQuestionIds(userStates, now),
        questionLimit ?? SAVED_SPRINT_TOTAL
      );
    case "exam_tomorrow":
      return getExamTomorrowQuestionIds(
        userStates,
        now,
        questionLimit ?? EXAM_PREVIEW_TOTAL
      );
    case "mini_test":
    case "exam":
      return getExamPreviewQuestionIds(
        userStates,
        now,
        questionLimit ?? EXAM_PREVIEW_TOTAL
      );
    default:
      return [];
  }
}

function getLearningQuestionIds(
  topic: LearningTopicId | undefined,
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionBank = getQuestionBank();
  const topicQuestions = topic
    ? questionBank.filter((question) => questionMatchesTopic(question, topic))
    : questionBank;
  const unseen = getUnseenQuestions(topicQuestions, userStates, now);
  const reviewDue = getReviewDueQuestions(topicQuestions, userStates, now);
  const wrong = getWrongQuestions(topicQuestions, userStates, now);
  const hard = getHardQuestions(topicQuestions, userStates, now);

  return uniqueQuestionIds([
    ...unseen,
    ...reviewDue,
    ...wrong,
    ...hard,
    ...sortQuestionsForLearning(topicQuestions, userStates, now),
  ]);
}

/**
 * Blitz pool: shuffle within each bucket, then concatenate by priority
 * unseen → mistakes → smart review → saved → remaining.
 */
function getBlitzQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionBank = getQuestionBank();
  const unseen = shuffleIds(
    getUnseenQuestions(questionBank, userStates, now).map(
      (question) => question.id
    )
  );
  const wrong = shuffleIds(
    getWrongQuestions(questionBank, userStates, now).map(
      (question) => question.id
    )
  );
  const reviewDue = shuffleIds(
    getReviewDueQuestions(questionBank, userStates, now).map(
      (question) => question.id
    )
  );
  const saved = shuffleIds(getSavedQuestionIds(userStates, now));
  const remaining = shuffleIds(questionBank.map((question) => question.id));

  return uniqueIds([...unseen, ...wrong, ...reviewDue, ...saved, ...remaining]);
}

function getWeakSpotQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionBank = getQuestionBank();
  const dueWeakReviews = getReviewDueQuestions(questionBank, userStates, now).filter(
    (question) =>
      !isQuestionMastered(getQuestionUserState(userStates, question.id))
  );

  return uniqueQuestionIds([
    ...dueWeakReviews,
    ...getWrongQuestions(questionBank, userStates, now),
    ...getHardQuestions(questionBank, userStates, now),
  ]);
}

function getNewQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return getUnseenQuestions(
    getTopicScopedQuestions(topic),
    userStates,
    now
  ).map((question) => question.id);
}

function getHardQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return getHardQuestions(getTopicScopedQuestions(topic), userStates, now).map(
    (question) => question.id
  );
}

/** Highest exam weight bucket (3 points) — the questions that cost the most on a real exam. */
function getHighPointsQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return sortQuestionsForLearning(
    getTopicScopedQuestions(topic).filter(isHighPointsQuestion),
    userStates,
    now
  ).map((question) => question.id);
}

function getReviewDueQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return getReviewDueQuestions(
    getTopicScopedQuestions(topic),
    userStates,
    now
  ).map((question) => question.id);
}

function getSeenNotMasteredQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionBank = getQuestionBank();
  return sortQuestionsForConsolidation(
    questionBank.filter((question) =>
      isSeenNotMasteredState(getQuestionUserState(userStates, question.id), now)
    ),
    userStates,
    now
  ).map((question) => question.id);
}

function getSavedQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return sortQuestionsForReview(
    getTopicScopedQuestions(topic).filter((question) =>
      getQuestionUserState(userStates, question.id).isBookmarked
    ),
    userStates,
    now
  ).map((question) => question.id);
}

function getWrongAnswerQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  topic?: LearningTopicId
) {
  return getWrongQuestions(
    getTopicScopedQuestions(topic),
    userStates,
    now
  ).map((question) => question.id);
}

function getExamTomorrowQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  desiredTotal: number = EXAM_PREVIEW_TOTAL
) {
  const questionBank = getQuestionBank();
  return uniqueQuestionIds([
    ...getReviewDueQuestions(questionBank, userStates, now),
    ...getWrongQuestions(questionBank, userStates, now),
    ...getHardQuestions(questionBank, userStates, now),
    ...getUnseenQuestions(questionBank, userStates, now),
    ...sortQuestionsForLearning(questionBank, userStates, now),
  ]).slice(0, desiredTotal);
}

function getExamPreviewQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date,
  desiredTotal: number = EXAM_PREVIEW_TOTAL
) {
  const questionBank = getQuestionBank();
  const baseQuestions = sortQuestionsForExam(
    questionBank.filter((question) => question.scope === "base"),
    userStates,
    now
  );
  const specialistQuestions = sortQuestionsForExam(
    questionBank.filter((question) => question.scope === "specialist"),
    userStates,
    now
  );
  const targetBase = Math.min(
    baseQuestions.length,
    Math.round((desiredTotal * EXAM_RULES.baseQuestions) / EXAM_RULES.totalQuestions)
  );
  const targetSpecialist = Math.min(
    specialistQuestions.length,
    Math.max(0, desiredTotal - targetBase)
  );
  const selectedBase = pickBaseQuestionsWithSoftVideoQuota(
    baseQuestions,
    targetBase
  );
  const selected = [
    ...selectedBase,
    ...specialistQuestions.slice(0, targetSpecialist),
  ];
  const remaining = sortQuestionsForExam(questionBank, userStates, now);

  return uniqueQuestionIds([...selected, ...remaining]).slice(0, desiredTotal);
}

function isVideoQuestion(question: LocalQuestion) {
  return question.media?.type === "video";
}

/**
 * Soft video floor for base-scope picks: fill video quota from the
 * priority-sorted video pool first, then remaining slots by priority
 * among non-video (then leftover video). Never hard-fails if short on videos.
 */
function pickBaseQuestionsWithSoftVideoQuota(
  sortedBaseQuestions: LocalQuestion[],
  targetCount: number
) {
  if (targetCount <= 0) {
    return [];
  }

  const videoMin = Math.min(
    targetCount,
    getExamBaseVideoMinTarget(targetCount),
    sortedBaseQuestions.filter(isVideoQuestion).length
  );
  const videos = sortedBaseQuestions.filter(isVideoQuestion);
  const nonVideos = sortedBaseQuestions.filter(
    (question) => !isVideoQuestion(question)
  );
  const selected = videos.slice(0, videoMin);
  const remainingSlots = targetCount - selected.length;
  const filler = [...nonVideos, ...videos.slice(videoMin)];

  return [...selected, ...filler.slice(0, remainingSlots)];
}

function getUnseenQuestions(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return sortQuestionsForLearning(
    questions.filter(
      (question) => getQuestionUserState(userStates, question.id).timesSeen === 0
    ),
    userStates,
    now
  );
}

function getWrongQuestions(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return sortQuestionsForReview(
    questions.filter(
      (question) => isQuestionUnresolvedWrong(getQuestionUserState(userStates, question.id))
    ),
    userStates,
    now
  );
}

function getHardQuestions(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return sortQuestionsForReview(
    questions.filter(
      (question) => getQuestionUserState(userStates, question.id).isHard
    ),
    userStates,
    now
  );
}

function getReviewDueQuestions(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return sortQuestionsForReview(
    questions.filter((question) =>
      isQuestionEligibleForSmartReview(
        getQuestionUserState(userStates, question.id),
        now
      )
    ),
    userStates,
    now
  );
}

function sortQuestionsForConsolidation(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return [...questions].sort((left, right) => {
    const leftScore = getConsolidationPriorityScore(
      getQuestionUserState(userStates, left.id),
      left,
      now
    );
    const rightScore = getConsolidationPriorityScore(
      getQuestionUserState(userStates, right.id),
      right,
      now
    );

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.difficultySeed - right.difficultySeed;
  });
}

function sortQuestionsForLearning(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return [...questions].sort((left, right) => {
    const leftScore = getLearningPriorityScore(
      getQuestionUserState(userStates, left.id),
      left,
      now
    );
    const rightScore = getLearningPriorityScore(
      getQuestionUserState(userStates, right.id),
      right,
      now
    );

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.difficultySeed - right.difficultySeed;
  });
}

function sortQuestionsForReview(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return [...questions].sort((left, right) => {
    const leftScore = getReviewPriorityScore(
      getQuestionUserState(userStates, left.id),
      left,
      now
    );
    const rightScore = getReviewPriorityScore(
      getQuestionUserState(userStates, right.id),
      right,
      now
    );

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return right.difficultySeed - left.difficultySeed;
  });
}

function sortQuestionsForExam(
  questions: LocalQuestion[],
  userStates: QuestionUserStateMap,
  now: Date
) {
  return [...questions].sort((left, right) => {
    const leftState = getQuestionUserState(userStates, left.id);
    const rightState = getQuestionUserState(userStates, right.id);
    const leftScore = getExamPriorityScore(leftState, left, now);
    const rightScore = getExamPriorityScore(rightState, right, now);

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.difficultySeed - right.difficultySeed;
  });
}

function getLearningPriorityScore(
  state: QuestionUserState,
  question: LocalQuestion,
  now: Date
) {
  let score = question.difficultySeed;

  if (state.timesSeen === 0) {
    score -= 100;
  }

  if (isQuestionDueForReview(state, now)) {
    score -= 40;
  }

  if (isQuestionUnresolvedWrong(state)) {
    score -= 30;
  }

  score -= state.timesWrong * 10;

  if (state.isHard) {
    score -= 12;
  }

  if (isQuestionMastered(state)) {
    score += 140;
  }

  score += Math.round(state.masteryScore / 3);
  score += state.timesSeen * 6;

  return score;
}

function getReviewPriorityScore(
  state: QuestionUserState,
  question: LocalQuestion,
  now: Date
) {
  let score = question.difficultySeed;

  // More overdue → earlier in the smart-review queue.
  score -= Math.min(120, Math.floor(getDaysOverdue(state, now) * 8));

  if (isQuestionUnresolvedWrong(state)) {
    // Still wrong — fix first.
    score -= 70;
  } else if (isQuestionConsolidating(state)) {
    // Corrected after a mistake — reinforce on the 3-day schedule.
    score -= 55;
  } else if (state.consecutiveCorrect === 1) {
    // Fragile first correct (often the 3-day refresh slot).
    score -= 40;
  } else if (
    state.consecutiveCorrect ===
    QUESTION_MASTERY_RULES.consecutiveCorrect - 1
  ) {
    // One step from mastery — 7-day refresh.
    score -= 32;
  } else if (isQuestionMastered(state)) {
    // Maintenance refresh after longer interval — still due, but lower urgency.
    score -= 20;
  }

  score -= state.timesWrong * 10;

  if (state.isHard) {
    score -= 35;
  }

  // Light mastery damping so well-known cards don't dominate over fragile ones.
  score += Math.round(state.masteryScore / 4);
  score += state.timesCorrect * 2;

  return score;
}

function getDaysOverdue(state: QuestionUserState, now: Date) {
  if (!state.reviewDueAt) {
    return 0;
  }

  const dueAt = new Date(state.reviewDueAt).getTime();

  if (!Number.isFinite(dueAt)) {
    return 0;
  }

  return Math.max(0, (now.getTime() - dueAt) / (24 * 60 * 60 * 1000));
}

function getExamPriorityScore(
  state: QuestionUserState,
  question: LocalQuestion,
  now: Date
) {
  let score = question.difficultySeed;

  if (state.timesSeen === 0) {
    score -= 50;
  }

  if (isQuestionDueForReview(state, now)) {
    score -= 10;
  }

  if (isQuestionUnresolvedWrong(state)) {
    score -= 16;
  }

  score -= state.timesWrong * 6;
  score += Math.round(state.masteryScore / 5);
  score += state.timesSeen * 2;

  if (isQuestionMastered(state)) {
    score += 60;
  }

  return score;
}

function getConsolidationPriorityScore(
  state: QuestionUserState,
  question: LocalQuestion,
  now: Date
) {
  let score = question.difficultySeed;

  if (state.consecutiveCorrect >= QUESTION_MASTERY_RULES.consecutiveCorrect - 1) {
    score -= 26;
  } else if (state.consecutiveCorrect === 1) {
    score -= 14;
  }

  if (isQuestionReviewDue(state, now)) {
    score -= 8;
  }

  score -= Math.round(state.masteryScore / 4);
  score += state.timesSeen * 2;

  return score;
}

function uniqueQuestionIds(questions: LocalQuestion[]) {
  return uniqueIds(questions.map((question) => question.id));
}

function uniqueIds(ids: string[]) {
  const seen = new Set<string>();

  return ids.filter((id) => {
    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function applyQuestionLimit(questionIds: string[], questionLimit: number | null) {
  if (questionLimit === null) {
    return questionIds;
  }

  return questionIds.slice(0, questionLimit);
}

function shuffleIds(ids: string[]) {
  const pool = [...ids];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swapIndex]!;
    pool[swapIndex] = current!;
  }

  return pool;
}

function takeRandomQuestionIds(questionIds: string[], questionLimit: number) {
  if (questionIds.length <= questionLimit) {
    return questionIds;
  }

  return shuffleIds(questionIds).slice(0, questionLimit);
}

function getNormalizedQuestionLimit(questionLimit: number | null | undefined) {
  if (typeof questionLimit !== "number" || !Number.isFinite(questionLimit)) {
    return null;
  }

  const normalized = Math.floor(questionLimit);

  return normalized > 0 ? normalized : null;
}

function isWeakSpotState(state: QuestionUserState) {
  return (
    isQuestionUnresolvedWrong(state) ||
    state.isHard ||
    isQuestionDueForReview(state)
  );
}

function isQuestionDueForReview(
  state: QuestionUserState,
  now: Date = new Date()
) {
  return isQuestionReviewDue(state, now) && !isQuestionMastered(state);
}

/**
 * Smart-review eligibility: any seen question whose spaced-repetition timer
 * has elapsed. Unlike weak-spot "due" checks, this includes mastered cards
 * that need a maintenance refresh (e.g. 14 days after mastery, or 7/3-day
 * intervals after earlier correct / post-mistake corrections).
 */
function isQuestionEligibleForSmartReview(
  state: QuestionUserState,
  now: Date = new Date()
) {
  return state.timesSeen > 0 && isQuestionReviewDue(state, now);
}

function isSeenNotMasteredState(
  state: QuestionUserState,
  now: Date = new Date()
) {
  return (
    state.timesSeen > 0 &&
    !isQuestionMastered(state) &&
    !state.isHard &&
    !isQuestionUnresolvedWrong(state) &&
    !isQuestionDueForReview(state, now)
  );
}

function getEmptyReason(
  request: QuestionSessionRequest,
  questionCount: number
) {
  if (questionCount > 0) {
    return null;
  }

  if (request.mode === "saved" || request.mode === "saved_sprint") {
    return "saved_empty";
  }

  if (request.mode === "new_questions") {
    return "new_questions_empty";
  }

  if (request.mode === "weak_spots") {
    return "weak_spots_empty";
  }

  if (request.mode === "hard_questions") {
    return "hard_questions_empty";
  }

  if (request.mode === "high_points") {
    return "high_points_empty";
  }

  if (request.mode === "review_due") {
    return "review_due_empty";
  }

  if (request.mode === "seen_not_mastered") {
    return "seen_not_mastered_empty";
  }

  if (request.mode === "wrong_answers") {
    return "wrong_answers_empty";
  }

  if (request.mode === "learning" && request.topic) {
    return "topic_empty";
  }

  return "general_empty";
}

function resolveConsecutiveCorrect(
  state: QuestionUserState,
  value: number | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(state.timesCorrect, Math.max(0, Math.floor(value)));
  }

  const lastCorrectAt = getTimestamp(state.lastCorrectAt);
  const lastWrongAt = getTimestamp(state.lastWrongAt);

  if (state.timesCorrect === 0 || lastCorrectAt === null) {
    return 0;
  }

  if (lastWrongAt === null) {
    return Math.min(state.timesCorrect, QUESTION_MASTERY_RULES.consecutiveCorrect);
  }

  if (lastWrongAt >= lastCorrectAt) {
    return 0;
  }

  return Math.min(state.timesCorrect, 1);
}

function resolveMasteryScore(
  state: QuestionUserState,
  value: number | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(Math.round(value), 0, 100);
  }

  return calculateMasteryScore(state);
}

function calculateMasteryScore(state: QuestionUserState) {
  return clampNumber(
    (state.timesCorrect * 12) -
      (state.timesWrong * 10) +
      (state.consecutiveCorrect * 15),
    0,
    100
  );
}

function getReviewDueAtForState(state: QuestionUserState) {
  if (!state.lastSeenAt) {
    return null;
  }

  const lastWrongAt = getTimestamp(state.lastWrongAt);
  const lastCorrectAt = getTimestamp(state.lastCorrectAt);

  if (lastWrongAt !== null && (lastCorrectAt === null || lastWrongAt >= lastCorrectAt)) {
    return addDays(state.lastSeenAt, 1);
  }

  if (state.consecutiveCorrect >= QUESTION_MASTERY_RULES.consecutiveCorrect) {
    return addDays(state.lastSeenAt, 14);
  }

  if (state.consecutiveCorrect === QUESTION_MASTERY_RULES.consecutiveCorrect - 1) {
    return addDays(state.lastSeenAt, 7);
  }

  if (state.consecutiveCorrect === 1) {
    return addDays(state.lastSeenAt, 3);
  }

  return state.lastSeenAt;
}

function getTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function addDays(value: string, days: number) {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
