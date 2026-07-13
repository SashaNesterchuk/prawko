import {
  EXAM_RULES,
  QUESTION_MASTERY_RULES,
  QUESTION_SESSION_MODES,
  getQuestionTopicFallbackFromTopicBlock,
  isTopicBlockId,
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
} from "./types";

const EXAM_PREVIEW_TOTAL = 12;
const SAVED_SPRINT_TOTAL = 10;

const BOOLEAN_CHOICES: Record<
  "true" | "false",
  Record<SupportedLocale, string>
> = {
  true: {
    pl: "Tak",
    ua: "Так",
    en: "Yes",
  },
  false: {
    pl: "Nie",
    ua: "Ні",
    en: "No",
  },
};

export function isQuestionSessionMode(value: string): value is QuestionSessionMode {
  return QUESTION_SESSION_MODES.includes(value as QuestionSessionMode);
}

export function getQuestionTopicIds(question: LocalQuestion): QuestionTopicId[] {
  const fallback = getQuestionTopicFallbackFromTopicBlock(question.topicBlock);

  if (question.topicIds && question.topicIds.length > 0) {
    return [...new Set(question.topicIds)];
  }

  return fallback.topicIds;
}

export function getQuestionPrimaryTopicId(question: LocalQuestion): QuestionTopicId {
  const topicIds = getQuestionTopicIds(question);
  const fallback = getQuestionTopicFallbackFromTopicBlock(question.topicBlock);

  if (question.primaryTopicId && topicIds.includes(question.primaryTopicId)) {
    return question.primaryTopicId;
  }

  return topicIds[0] ?? fallback.primaryTopicId;
}

function questionMatchesTopic(
  question: LocalQuestion,
  topic: LearningTopicId
) {
  return isTopicBlockId(topic)
    ? question.topicBlock === topic
    : getQuestionTopicIds(question).includes(topic);
}

export function createQuestionSessionKey(input: {
  mode: QuestionSessionMode;
  topic?: LearningTopicId;
}) {
  return `${input.mode}-${input.topic ?? "all"}-${Date.now().toString(36)}`;
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

export function getQuestionUserState(
  userStates: QuestionUserStateMap,
  questionId: string
) {
  return normalizeQuestionUserState(questionId, userStates[questionId]);
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

export function getQuestionById(questionId: string) {
  return getQuestionBankById()[questionId];
}

export function getLocalizedText(
  value: LocalizedQuestionText,
  locale: SupportedLocale
) {
  return value[locale] ?? value.ua ?? value.en ?? value.pl;
}

export function getQuestionChoices(
  question: LocalQuestion,
  locale: SupportedLocale
): Array<{
  id: QuestionChoice["id"];
  label: string;
}> {
  if (question.answerType === "boolean") {
    return [
      {
        id: "true",
        label: BOOLEAN_CHOICES.true[locale],
      },
      {
        id: "false",
        label: BOOLEAN_CHOICES.false[locale],
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

  return {
    total: session?.questionIds.length ?? 0,
    answered: answers.length,
    correct,
    wrong: answers.length - correct,
  };
}

export function getQuestionDisplayStats(userStates: QuestionUserStateMap) {
  const questionBank = getQuestionBank();
  const states = questionBank.map((question) =>
    getQuestionUserState(userStates, question.id)
  );

  return {
    total: questionBank.length,
    hardQuestions: states.filter((state) => state.isHard).length,
    wrongAnswers: states.filter((state) => isQuestionUnresolvedWrong(state)).length,
    saved: states.filter((state) => state.isBookmarked).length,
    reviewDue: states.filter((state) => isQuestionDueForReview(state)).length,
    seen: states.filter((state) => state.timesSeen > 0).length,
    seenNotMastered: states.filter((state) => isSeenNotMasteredState(state)).length,
    weakSpots: states.filter((state) => isWeakSpotState(state)).length,
  };
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
  userStates: QuestionUserStateMap
) {
  const questions = getQuestionBank().filter(
    (question) => questionMatchesTopic(question, topic)
  );
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
  userStates: QuestionUserStateMap
) {
  const questions = getQuestionBank().filter(
    (question) => questionMatchesTopic(question, topic)
  );
  const states = questions.map((question) =>
    getQuestionUserState(userStates, question.id)
  );
  const seen = states.filter((state) => state.timesSeen > 0).length;
  const correct = states.filter((state) => state.timesCorrect > 0).length;
  const wrong = states.filter((state) => state.timesWrong > 0).length;
  const weak = states.filter((state) => isWeakSpotState(state)).length;
  const mastered = states.filter((state) => isQuestionMastered(state)).length;

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
  now: Date = new Date()
): QuestionSession {
  const questionIds = getQuestionIdsForMode(request, userStates, now);
  const emptyReason = getEmptyReason(request, questionIds.length);
  const createdAt = now.toISOString();

  return {
    id: `session-${request.sessionKey}`,
    request,
    questionIds,
    currentIndex: 0,
    answers: {},
    createdAt,
    finishedAt: questionIds.length === 0 ? createdAt : null,
    emptyReason,
  };
}

function getQuestionIdsForMode(
  request: QuestionSessionRequest,
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionLimit = getNormalizedQuestionLimit(request.questionLimit);

  switch (request.mode) {
    case "learning":
      return applyQuestionLimit(
        getLearningQuestionIds(request.topic, userStates, now),
        questionLimit
      );
    case "weak_spots":
      return applyQuestionLimit(getWeakSpotQuestionIds(userStates, now), questionLimit);
    case "hard_questions":
      return applyQuestionLimit(getHardQuestionIds(userStates, now), questionLimit);
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
      return applyQuestionLimit(getSavedQuestionIds(userStates, now), questionLimit);
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

function getWeakSpotQuestionIds(
  userStates: QuestionUserStateMap,
  now: Date
) {
  const questionBank = getQuestionBank();
  return uniqueQuestionIds([
    ...getReviewDueQuestions(questionBank, userStates, now),
    ...getWrongQuestions(questionBank, userStates, now),
    ...getHardQuestions(questionBank, userStates, now),
  ]);
}

function getHardQuestionIds(userStates: QuestionUserStateMap, now: Date) {
  const questionBank = getQuestionBank();
  return getHardQuestions(questionBank, userStates, now).map((question) => question.id);
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

function getSavedQuestionIds(userStates: QuestionUserStateMap, now: Date) {
  const questionBank = getQuestionBank();
  return sortQuestionsForReview(
    questionBank.filter((question) =>
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
  const questionBank = topic
    ? getQuestionBank().filter((question) => questionMatchesTopic(question, topic))
    : getQuestionBank();
  return getWrongQuestions(questionBank, userStates, now).map(
    (question) => question.id
  );
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
  const selected = [
    ...baseQuestions.slice(0, targetBase),
    ...specialistQuestions.slice(0, targetSpecialist),
  ];
  const remaining = sortQuestionsForExam(questionBank, userStates, now);

  return uniqueQuestionIds([...selected, ...remaining]).slice(0, desiredTotal);
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
      isQuestionDueForReview(getQuestionUserState(userStates, question.id), now)
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

  if (isQuestionDueForReview(state, now)) {
    score -= 80;
  }

  if (isQuestionUnresolvedWrong(state)) {
    score -= 50;
  }

  score -= state.timesWrong * 14;

  if (state.isHard) {
    score -= 35;
  }

  if (isQuestionMastered(state)) {
    score += 150;
  }

  score += state.masteryScore;
  score += state.timesCorrect * 8;
  score += state.timesSeen * 4;

  return score;
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
  const seen = new Set<string>();

  return questions
    .filter((question) => {
      if (seen.has(question.id)) {
        return false;
      }

      seen.add(question.id);
      return true;
    })
    .map((question) => question.id);
}

function applyQuestionLimit(questionIds: string[], questionLimit: number | null) {
  if (questionLimit === null) {
    return questionIds;
  }

  return questionIds.slice(0, questionLimit);
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

  if (request.mode === "weak_spots") {
    return "weak_spots_empty";
  }

  if (request.mode === "hard_questions") {
    return "hard_questions_empty";
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
