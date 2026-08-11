import type { QuestionTopicId } from "@prawko/config";

import {
  getProgressBarAccent,
  type ExamResultQuestionChip,
  type ExamResultTopicStat,
  type ExamScoreDelta,
} from "../../exam/exam-result-stats";
import {
  getQuestionById,
  getQuestionPrimaryTopicId,
  getQuestionUserState,
} from "../question-engine";
import type {
  QuestionSession,
  QuestionUserStateMap,
} from "../types";

export type TrainingResultOutcome = "good" | "medium" | "poor";

export type TrainingResultQuestionChip = ExamResultQuestionChip;
export type TrainingResultTopicStat = ExamResultTopicStat;
export type TrainingScoreDelta = ExamScoreDelta;

const TOPIC_STAT_LIMIT = 4;

/** Aligns with progress-bar accents: high / mid / low. */
export function getTrainingResultOutcome(
  percent: number
): TrainingResultOutcome {
  if (percent >= 80) {
    return "good";
  }

  if (percent >= 60) {
    return "medium";
  }

  return "poor";
}

export function createTrainingResultScoreKey(input: {
  mode: string;
  topic?: string | null;
}) {
  return `${input.mode}:${input.topic ?? "all"}`;
}

export function getTrainingScorePercent(input: {
  correct: number;
  total: number;
}) {
  const total = input.total || 1;
  return Math.round((input.correct / total) * 100);
}

export function getTrainingScoreDelta(
  currentPercent: number,
  previousPercent: number | null | undefined
): TrainingScoreDelta | null {
  if (
    typeof previousPercent !== "number" ||
    !Number.isFinite(previousPercent)
  ) {
    return null;
  }

  const percentPoints = currentPercent - previousPercent;
  if (percentPoints === 0) {
    return null;
  }

  return {
    percentPoints,
    previousPercent,
  };
}

export function buildTrainingQuestionChips(
  session: QuestionSession,
  questionUserState: QuestionUserStateMap
): TrainingResultQuestionChip[] {
  return session.questionIds.map((questionId, index) => {
    const answer = session.answers[questionId];
    const userState = getQuestionUserState(questionUserState, questionId);

    let status: TrainingResultQuestionChip["status"] = "unanswered";
    if (answer) {
      status = answer.isCorrect ? "correct" : "wrong";
    }

    return {
      number: index + 1,
      questionSourceId: questionId,
      status,
      isBookmarked: userState.isBookmarked,
    };
  });
}

export function buildTrainingTopicStats(
  session: QuestionSession
): TrainingResultTopicStat[] {
  const buckets = new Map<
    QuestionTopicId,
    { correctCount: number; totalCount: number }
  >();

  for (const questionId of session.questionIds) {
    const question = getQuestionById(questionId);
    if (!question) {
      continue;
    }

    const topicId = getQuestionPrimaryTopicId(question);
    const bucket = buckets.get(topicId) ?? {
      correctCount: 0,
      totalCount: 0,
    };
    bucket.totalCount += 1;

    if (session.answers[questionId]?.isCorrect) {
      bucket.correctCount += 1;
    }

    buckets.set(topicId, bucket);
  }

  return [...buckets.entries()]
    .map(([topicId, bucket]) => ({
      topicId,
      correctCount: bucket.correctCount,
      totalCount: bucket.totalCount,
      percent:
        bucket.totalCount > 0
          ? Math.round((bucket.correctCount / bucket.totalCount) * 100)
          : 0,
    }))
    .sort((left, right) => {
      if (right.totalCount !== left.totalCount) {
        return right.totalCount - left.totalCount;
      }

      return left.percent - right.percent;
    })
    .slice(0, TOPIC_STAT_LIMIT);
}

export function getWeakestTrainingTopic(
  topicStats: TrainingResultTopicStat[]
): QuestionTopicId | null {
  if (topicStats.length === 0) {
    return null;
  }

  return (
    [...topicStats].sort((left, right) => left.percent - right.percent)[0]
      ?.topicId ?? null
  );
}

export { getProgressBarAccent };
