import type { QuestionScope, TopicBlockId } from "@prawko/config";

import {
  getQuestionById,
  getQuestionUserState,
} from "../questions/question-engine";
import type { QuestionUserStateMap } from "../questions/types";
import type {
  RemoteExamAnswer,
  RemoteExamQuestionRef,
  RemoteExamSession,
  RemoteExamSnapshot,
} from "./types";

export type ExamResultOutcome =
  | "passed"
  | "failed"
  | "expired"
  | "abandoned";

export type ExamResultQuestionChip = {
  isBookmarked: boolean;
  number: number;
  questionSourceId: string;
  status: "correct" | "wrong" | "unanswered";
};

export type ExamResultScopeSection = {
  correctCount: number;
  questions: ExamResultQuestionChip[];
  scope: QuestionScope;
  totalCount: number;
};

export type ExamResultTopicStat = {
  correctCount: number;
  percent: number;
  topicBlock: TopicBlockId;
  totalCount: number;
};

export type ExamScoreDelta = {
  percentPoints: number;
  previousPercent: number;
};

const TOPIC_STAT_LIMIT = 4;

export function getExamResultOutcome(
  session: RemoteExamSession
): ExamResultOutcome {
  if (session.status === "expired") {
    return "expired";
  }

  if (session.status === "abandoned") {
    return "abandoned";
  }

  return session.passed ? "passed" : "failed";
}

export function getExamScorePercent(session: RemoteExamSession) {
  const totalPoints = session.totalPointsTarget || 1;
  return Math.round((session.scorePoints / totalPoints) * 100);
}

export function getExamDurationSeconds(session: RemoteExamSession) {
  const startedAtMs = Date.parse(session.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return 0;
  }

  const finishedAtMs = session.finishedAt
    ? Date.parse(session.finishedAt)
    : Date.now();

  if (!Number.isFinite(finishedAtMs) || finishedAtMs < startedAtMs) {
    return 0;
  }

  return Math.max(0, Math.floor((finishedAtMs - startedAtMs) / 1000));
}

export function formatExamDurationParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return { minutes, seconds };
}

export function getProgressBarAccent(percent: number): "green" | "amber" | "red" {
  if (percent >= 80) {
    return "green";
  }

  if (percent >= 60) {
    return "amber";
  }

  return "red";
}

export function buildExamTopicStats(
  snapshot: RemoteExamSnapshot
): ExamResultTopicStat[] {
  const answerByOrder = indexAnswersByOrder(snapshot.answers);
  const buckets = new Map<
    TopicBlockId,
    { correctCount: number; totalCount: number }
  >();

  for (const questionRef of snapshot.questions) {
    const question = getQuestionById(questionRef.questionSourceId);
    if (!question) {
      continue;
    }

    const bucket = buckets.get(question.topicBlock) ?? {
      correctCount: 0,
      totalCount: 0,
    };
    bucket.totalCount += 1;

    const answer = answerByOrder.get(questionRef.order);
    if (answer?.isCorrect) {
      bucket.correctCount += 1;
    }

    buckets.set(question.topicBlock, bucket);
  }

  return [...buckets.entries()]
    .map(([topicBlock, bucket]) => ({
      topicBlock,
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

export function buildExamScopeSections(
  snapshot: RemoteExamSnapshot,
  questionUserState: QuestionUserStateMap
): ExamResultScopeSection[] {
  const answerByOrder = indexAnswersByOrder(snapshot.answers);
  const scopes: QuestionScope[] = ["base", "specialist"];

  return scopes
    .map((scope) => {
      const scopedQuestions = snapshot.questions
        .filter((question) => question.scope === scope)
        .sort((left, right) => left.order - right.order);

      const questions = scopedQuestions.map((questionRef, index) =>
        buildQuestionChip(
          questionRef,
          index + 1,
          answerByOrder.get(questionRef.order),
          questionUserState
        )
      );

      const correctCount = questions.filter(
        (question) => question.status === "correct"
      ).length;

      return {
        scope,
        questions,
        correctCount,
        totalCount: questions.length,
      };
    })
    .filter((section) => section.totalCount > 0);
}

export function getWeakestTopicBlock(
  topicStats: ExamResultTopicStat[]
): TopicBlockId | null {
  if (topicStats.length === 0) {
    return null;
  }

  return [...topicStats].sort((left, right) => left.percent - right.percent)[0]
    ?.topicBlock ?? null;
}

export function getExamScoreDelta(
  currentSession: RemoteExamSession,
  recentSessions: RemoteExamSession[]
): ExamScoreDelta | null {
  const previous = recentSessions.find(
    (session) =>
      session.id !== currentSession.id &&
      session.status !== "active" &&
      session.totalPointsTarget > 0
  );

  if (!previous) {
    return null;
  }

  const currentPercent = getExamScorePercent(currentSession);
  const previousPercent = getExamScorePercent(previous);
  const percentPoints = currentPercent - previousPercent;

  if (percentPoints === 0) {
    return null;
  }

  return {
    percentPoints,
    previousPercent,
  };
}

function buildQuestionChip(
  questionRef: RemoteExamQuestionRef,
  number: number,
  answer: RemoteExamAnswer | undefined,
  questionUserState: QuestionUserStateMap
): ExamResultQuestionChip {
  const userState = getQuestionUserState(
    questionUserState,
    questionRef.questionSourceId
  );

  let status: ExamResultQuestionChip["status"] = "unanswered";
  if (answer) {
    status = answer.isCorrect ? "correct" : "wrong";
  }

  return {
    number,
    questionSourceId: questionRef.questionSourceId,
    status,
    isBookmarked: userState.isBookmarked,
  };
}

function indexAnswersByOrder(answers: RemoteExamAnswer[]) {
  return new Map(answers.map((answer) => [answer.order, answer]));
}
