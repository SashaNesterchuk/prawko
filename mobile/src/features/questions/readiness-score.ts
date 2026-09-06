import type { QuestionSessionMode } from "@prawko/config";

import {
  createEmptyQuestionUserState,
  getNextQuestionUserStateAfterAttempt,
  isQuestionMastered,
  isQuestionReviewDue,
} from "./question-engine";
import type { QuestionAttempt, QuestionUserStateMap } from "./types";

/**
 * Same weights as `get_readiness_summary` in Supabase:
 * accuracy 45 + plan 25 + latest exam 20 + review hygiene 5 + weak spots 5.
 */
export const READINESS_EXAM_SESSION_MODES: ReadonlySet<QuestionSessionMode> =
  new Set(["exam", "mini_test", "exam_tomorrow"]);

export type ReadinessScoreInput = {
  attempts: readonly QuestionAttempt[];
  userStates?: QuestionUserStateMap | null;
  planCompletionPercent?: number | null;
  /** Unique questions in the active bank. Scales quality down until the exam is actually covered. */
  totalQuestions?: number | null;
  now?: Date;
};

export type ReadinessScoreComponents = {
  accuracyPercent: number;
  accuracyComponent: number;
  planComponent: number;
  recentExamScorePercent: number | null;
  recentExamComponent: number;
  dueReviews: number;
  reviewHygieneComponent: number;
  unresolvedWeakSpots: number;
  weakSpotComponent: number;
  uniqueSeen: number;
  qualityScore: number;
  readinessScore: number;
};

export function resolveReadinessScore(
  remoteScore: number | null | undefined,
  localInput: ReadinessScoreInput
) {
  const local = computeLocalReadinessScoreComponents(localInput);

  if (typeof remoteScore === "number" && Number.isFinite(remoteScore)) {
    return scaleQualityByCoverage(
      clampPercent(Math.round(remoteScore)),
      local.uniqueSeen,
      localInput.totalQuestions
    );
  }

  return local.readinessScore;
}

export function computeLocalReadinessScore(input: ReadinessScoreInput) {
  return computeLocalReadinessScoreComponents(input).readinessScore;
}

export function computeLocalReadinessScoreComponents(
  input: ReadinessScoreInput
): ReadinessScoreComponents {
  const now = input.now ?? new Date();
  const userStates =
    input.userStates ?? replayQuestionUserStates(input.attempts);
  const accuracyPercent = resolveAccuracyPercent(input.attempts, userStates);
  const recentExamScorePercent = resolveRecentExamScorePercent(input.attempts);
  const planCompletionPercent = resolveFinitePercent(
    input.planCompletionPercent
  );
  const { dueReviews, unresolvedWeakSpots } = resolveReviewStats(
    userStates,
    now
  );

  const uniqueSeen = resolveUniqueSeen(input.attempts, userStates);

  if (!hasReadinessProgress(input.attempts, userStates)) {
    return {
      accuracyPercent: 0,
      accuracyComponent: 0,
      planComponent: 0,
      recentExamScorePercent: null,
      recentExamComponent: 0,
      dueReviews,
      reviewHygieneComponent: 0,
      unresolvedWeakSpots,
      weakSpotComponent: 0,
      uniqueSeen,
      qualityScore: 0,
      readinessScore: 0,
    };
  }

  const accuracyComponent = weightedComponent(accuracyPercent, 0.45, 45);
  const planComponent = weightedComponent(planCompletionPercent, 0.25, 25);
  const recentExamComponent = weightedComponent(
    recentExamScorePercent ?? 0,
    0.2,
    20
  );
  const reviewHygieneComponent = Math.max(0, 5 - Math.min(dueReviews, 5));
  const weakSpotComponent = Math.max(0, 5 - Math.min(unresolvedWeakSpots, 5));
  const qualityScore = clampPercent(
    accuracyComponent +
      planComponent +
      recentExamComponent +
      reviewHygieneComponent +
      weakSpotComponent
  );

  return {
    accuracyPercent,
    accuracyComponent,
    planComponent,
    recentExamScorePercent,
    recentExamComponent,
    dueReviews,
    reviewHygieneComponent,
    unresolvedWeakSpots,
    weakSpotComponent,
    uniqueSeen,
    qualityScore,
    readinessScore: scaleQualityByCoverage(
      qualityScore,
      uniqueSeen,
      input.totalQuestions
    ),
  };
}

function resolveUniqueSeen(
  attempts: readonly QuestionAttempt[],
  userStates: QuestionUserStateMap
) {
  const seenIds = new Set<string>();

  for (const state of Object.values(userStates)) {
    if (state.timesSeen > 0) {
      seenIds.add(state.questionId);
    }
  }

  if (seenIds.size > 0) {
    return seenIds.size;
  }

  for (const attempt of attempts) {
    seenIds.add(attempt.questionId);
  }

  return seenIds.size;
}

/**
 * Quality of answers is not exam readiness while almost none of the bank is
 * covered. 3/10 on a 2142-question exam is 1%, not 24% and not an empty 0%.
 */
export function scaleQualityByCoverage(
  qualityScore: number,
  uniqueSeen: number,
  totalQuestions: number | null | undefined
) {
  if (uniqueSeen <= 0) {
    return 0;
  }

  if (
    typeof totalQuestions !== "number" ||
    !Number.isFinite(totalQuestions) ||
    totalQuestions <= 0
  ) {
    return clampPercent(qualityScore);
  }

  return Math.min(
    100,
    Math.max(1, Math.round((qualityScore * uniqueSeen) / totalQuestions))
  );
}

function hasReadinessProgress(
  attempts: readonly QuestionAttempt[],
  userStates: QuestionUserStateMap
) {
  if (attempts.length > 0) {
    return true;
  }

  return Object.values(userStates).some((state) => state.timesSeen > 0);
}

export function replayQuestionUserStates(
  attempts: readonly QuestionAttempt[]
): QuestionUserStateMap {
  const ordered = [...attempts].sort((left, right) => {
    const byTime = Date.parse(left.answeredAt) - Date.parse(right.answeredAt);

    if (byTime !== 0) {
      return byTime;
    }

    return left.id.localeCompare(right.id);
  });
  const userStates: QuestionUserStateMap = {};

  for (const attempt of ordered) {
    if (!Number.isFinite(Date.parse(attempt.answeredAt))) {
      continue;
    }

    const current =
      userStates[attempt.questionId] ??
      createEmptyQuestionUserState(attempt.questionId);

    userStates[attempt.questionId] = getNextQuestionUserStateAfterAttempt(
      current,
      {
        answeredAt: attempt.answeredAt,
        isCorrect: attempt.isCorrect,
      }
    );
  }

  return userStates;
}

function resolveAccuracyPercent(
  attempts: readonly QuestionAttempt[],
  userStates: QuestionUserStateMap
) {
  if (attempts.length > 0) {
    const correct = attempts.reduce(
      (sum, attempt) => sum + (attempt.isCorrect ? 1 : 0),
      0
    );

    return roundToOneDecimal((100 * correct) / attempts.length);
  }

  let seen = 0;
  let correct = 0;

  for (const state of Object.values(userStates)) {
    seen += state.timesSeen;
    correct += state.timesCorrect;
  }

  if (seen <= 0) {
    return 0;
  }

  return roundToOneDecimal((100 * correct) / seen);
}

function resolveRecentExamScorePercent(attempts: readonly QuestionAttempt[]) {
  const sessions = new Map<
    string,
    { correct: number; lastAnsweredAt: number; total: number }
  >();

  for (const attempt of attempts) {
    if (!READINESS_EXAM_SESSION_MODES.has(attempt.sessionMode)) {
      continue;
    }

    const answeredAt = Date.parse(attempt.answeredAt);

    if (!Number.isFinite(answeredAt)) {
      continue;
    }

    const current = sessions.get(attempt.sessionId) ?? {
      correct: 0,
      lastAnsweredAt: answeredAt,
      total: 0,
    };

    sessions.set(attempt.sessionId, {
      correct: current.correct + (attempt.isCorrect ? 1 : 0),
      lastAnsweredAt: Math.max(current.lastAnsweredAt, answeredAt),
      total: current.total + 1,
    });
  }

  let latest: { correct: number; lastAnsweredAt: number; total: number } | null =
    null;

  for (const session of sessions.values()) {
    if (session.total <= 0) {
      continue;
    }

    if (latest == null || session.lastAnsweredAt > latest.lastAnsweredAt) {
      latest = session;
    }
  }

  if (latest == null) {
    return null;
  }

  return roundToOneDecimal((100 * latest.correct) / latest.total);
}

function resolveReviewStats(userStates: QuestionUserStateMap, now: Date) {
  let dueReviews = 0;
  let unresolvedWeakSpots = 0;

  for (const state of Object.values(userStates)) {
    if (isQuestionMastered(state)) {
      continue;
    }

    if (state.timesWrong > 0) {
      unresolvedWeakSpots += 1;
    }

    if (isQuestionReviewDue(state, now)) {
      dueReviews += 1;
    }
  }

  return { dueReviews, unresolvedWeakSpots };
}

function weightedComponent(percent: number, weight: number, cap: number) {
  return Math.min(cap, Math.floor(percent * weight));
}

function resolveFinitePercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return clampPercent(value);
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
