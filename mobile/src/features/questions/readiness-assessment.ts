import type { QuestionSession } from "./types";
import { getQuestionSessionSummary } from "./question-engine";

/** Home «Оціни знання» — untimed training, larger than a timed blitz. */
export const READINESS_ASSESSMENT_QUESTION_COUNT = 30;

export type ReadinessAssessmentResult = {
  completedAt: string;
  correct: number;
  scorePercent: number;
  sessionId: string;
  total: number;
};

export function isReadinessAssessmentSession(
  session: Pick<QuestionSession, "request"> | null | undefined
) {
  if (session?.request.mode !== "mini_test") {
    return false;
  }

  const limit = session.request.questionLimit;

  return (
    typeof limit === "number" &&
    Number.isFinite(limit) &&
    limit >= READINESS_ASSESSMENT_QUESTION_COUNT
  );
}

export function buildReadinessAssessmentResult(
  session: QuestionSession
): ReadinessAssessmentResult | null {
  if (!isReadinessAssessmentSession(session) || session.emptyReason) {
    return null;
  }

  const summary = getQuestionSessionSummary(session);
  const total = summary.total;

  if (total <= 0 || summary.answered < total) {
    return null;
  }

  const scorePercent = Math.round((summary.correct / total) * 100);

  return {
    completedAt: session.finishedAt ?? new Date().toISOString(),
    correct: summary.correct,
    scorePercent,
    sessionId: session.id,
    total,
  };
}

export function resolveLocalReadinessPercent(input: {
  assessmentScorePercent?: number | null;
  seen: number;
  total: number;
}) {
  if (
    typeof input.assessmentScorePercent === "number" &&
    Number.isFinite(input.assessmentScorePercent)
  ) {
    return Math.max(0, Math.min(100, Math.round(input.assessmentScorePercent)));
  }

  if (input.total <= 0) {
    return 0;
  }

  return Math.round((input.seen / input.total) * 100);
}
