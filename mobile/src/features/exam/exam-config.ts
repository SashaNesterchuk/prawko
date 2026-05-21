import { EXAM_RULES, type QuestionScope } from "@prawko/config";

import type { ExamSimulatorMode } from "./types";

const OFFICIAL_SCOPE_TOTALS: Record<QuestionScope, number> = {
  base: EXAM_RULES.baseQuestions,
  specialist: EXAM_RULES.specialistQuestions,
};

const OFFICIAL_POINT_MIX: Record<
  QuestionScope,
  Array<{ points: number; weight: number }>
> = {
  base: [
    { points: 3, weight: 10 },
    { points: 2, weight: 6 },
    { points: 1, weight: 4 },
  ],
  specialist: [
    { points: 3, weight: 6 },
    { points: 2, weight: 4 },
    { points: 1, weight: 2 },
  ],
};

export const DEFAULT_MINI_TEST_QUESTIONS = 12;

export function isExamSimulatorMode(
  value: string | null | undefined
): value is ExamSimulatorMode {
  return (
    value === "exam" ||
    value === "mini_test" ||
    value === "exam_tomorrow"
  );
}

export function getExamQuestionTarget(
  mode: ExamSimulatorMode,
  requestedTotalQuestions?: number | null
) {
  if (
    typeof requestedTotalQuestions === "number" &&
    Number.isFinite(requestedTotalQuestions)
  ) {
    const normalized = Math.floor(requestedTotalQuestions);

    if (normalized >= 1 && normalized <= 64) {
      return normalized;
    }
  }

  return mode === "mini_test"
    ? DEFAULT_MINI_TEST_QUESTIONS
    : EXAM_RULES.totalQuestions;
}

export function getExamDurationMinutes(totalQuestions: number) {
  const normalized = Math.max(1, Math.floor(totalQuestions));
  return Math.max(
    5,
    Math.ceil((normalized * EXAM_RULES.durationMinutes) / EXAM_RULES.totalQuestions)
  );
}

export function getExamScopeTargets(totalQuestions: number) {
  const normalized = Math.max(1, Math.floor(totalQuestions));
  const base = Math.min(
    normalized,
    Math.max(0, Math.round((normalized * EXAM_RULES.baseQuestions) / EXAM_RULES.totalQuestions))
  );

  return {
    base,
    specialist: Math.max(0, normalized - base),
  };
}

export function getExamPointTargets(scope: QuestionScope, scopeQuestionTarget: number) {
  const normalized = Math.max(0, Math.floor(scopeQuestionTarget));
  const officialTotal = OFFICIAL_SCOPE_TOTALS[scope];
  const scaled = OFFICIAL_POINT_MIX[scope].map((entry) => {
    const raw = (normalized * entry.weight) / officialTotal;
    const floorCount = Math.floor(raw);

    return {
      ...entry,
      floorCount,
      remainder: raw - floorCount,
    };
  });
  const remaining = normalized - scaled.reduce((sum, entry) => sum + entry.floorCount, 0);

  return scaled
    .sort((left, right) => {
      if (left.remainder !== right.remainder) {
        return right.remainder - left.remainder;
      }

      return right.points - left.points;
    })
    .map((entry, index) => ({
      points: entry.points,
      count: entry.floorCount + (index < remaining ? 1 : 0),
    }))
    .sort((left, right) => right.points - left.points);
}

export function getScaledExamPassPoints(totalPointsTarget: number) {
  return Math.max(
    1,
    Math.round((Math.max(1, totalPointsTarget) * EXAM_RULES.passingPoints) / EXAM_RULES.maxPoints)
  );
}

export function formatExamCountdown(totalSeconds: number | null | undefined) {
  const normalized = Math.max(0, Math.floor(totalSeconds ?? 0));
  const minutes = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (normalized % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function getRemainingExamSeconds(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
}
