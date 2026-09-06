import type { QuestionTopicId } from "@prawko/config";

import { getQuestionById, getQuestionPrimaryTopicId } from "../question-engine";
import type { QuestionSession } from "../types";
import type { ExamResultTopicStat } from "../../exam/exam-result-stats";

export type DiagnosticTopicStat = ExamResultTopicStat;

export function buildDiagnosticTopicStats(
  session: QuestionSession
): DiagnosticTopicStat[] {
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
    .filter((stat) => stat.totalCount > 0)
    .sort((left, right) => {
      if (right.totalCount !== left.totalCount) {
        return right.totalCount - left.totalCount;
      }

      return left.percent - right.percent;
    });
}

export function getDiagnosticWeakAreas(
  topicStats: DiagnosticTopicStat[],
  limit = 2
): DiagnosticTopicStat[] {
  return [...topicStats]
    .filter((stat) => stat.correctCount < stat.totalCount)
    .sort((left, right) => {
      const leftWrong = left.totalCount - left.correctCount;
      const rightWrong = right.totalCount - right.correctCount;

      if (rightWrong !== leftWrong) {
        return rightWrong - leftWrong;
      }

      return left.percent - right.percent;
    })
    .slice(0, limit);
}

export function getDiagnosticStrongArea(
  topicStats: DiagnosticTopicStat[]
): DiagnosticTopicStat | null {
  const ranked = [...topicStats]
    .filter((stat) => stat.correctCount > 0)
    .sort((left, right) => {
      if (right.percent !== left.percent) {
        return right.percent - left.percent;
      }

      return right.totalCount - left.totalCount;
    });

  const strongest = ranked[0];
  const runnerUp = ranked[1];

  if (!strongest) {
    return null;
  }

  if (runnerUp && runnerUp.percent === strongest.percent) {
    return null;
  }

  return strongest;
}

export function getDiagnosticSummaryBand(correctCount: number, total: number) {
  if (total <= 0) {
    return "mid" as const;
  }

  if (correctCount <= 3) {
    return "low" as const;
  }

  if (correctCount >= 8) {
    return "high" as const;
  }

  return "mid" as const;
}
