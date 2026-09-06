import type { QuestionSession } from "./types";
import { getQuestionSessionSummary } from "./question-engine";

import { FIRST_START_QUESTION_COUNT } from "../home/first-start";

/** Home first-start assessment — untimed, capped so it can be finished. */
export const READINESS_ASSESSMENT_QUESTION_COUNT = FIRST_START_QUESTION_COUNT;

export type ReadinessAssessmentResult = {
  completedAt: string;
  correct: number;
  scorePercent: number;
  sessionId: string;
  total: number;
};

export function isInitialDiagnosticSession(
  session: Pick<QuestionSession, "request"> | null | undefined
) {
  return session?.request.mode === "initial_diagnostic";
}

export function isReadinessAssessmentSession(
  session: Pick<QuestionSession, "request"> | null | undefined
) {
  return isInitialDiagnosticSession(session);
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
