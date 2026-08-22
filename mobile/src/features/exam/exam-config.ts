import {
  EXAM_RULES,
  getExamBaseVideoMinTarget,
  type QuestionScope,
} from "@prawko/config";

import {
  getExamProfile,
  type ExamProfile,
} from "./exam-profile";
import type { ExamSimulatorMode } from "./types";

export { getExamBaseVideoMinTarget };

export type ExamQuestionTimerPhase = "read" | "media" | "answer";

export type ExamQuestionTiming = {
  answerSeconds: number;
  readSeconds: number;
};

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

/**
 * Map a numeric size onto an exam launch (study-plan mini tests, scaled runs).
 * The Home / Learn Exam tile does not use this — it always starts the official
 * country simulator. Full size stays `exam`; smaller picks become `mini_test`
 * so the 0/1 official slot is unchanged.
 */
export function resolveExamLaunchFromQuestionCount(
  selectedCount: number | "all",
  profile: ExamProfile = getExamProfile()
): {
  mode: ExamSimulatorMode;
  questionLimit?: number;
} {
  if (
    selectedCount === "all" ||
    selectedCount >= profile.totalQuestions
  ) {
    return { mode: "exam" };
  }

  return {
    mode: "mini_test",
    questionLimit: selectedCount,
  };
}

export function getExamQuestionTarget(
  mode: ExamSimulatorMode,
  requestedTotalQuestions?: number | null,
  profile: ExamProfile = getExamProfile()
) {
  // Official simulator is always the country-sized exam. Custom limits are
  // only for mini tests (study-plan scaling). Ignoring request here also
  // guards against sticky `questionLimit` params left over from a previous
  // /exam navigation.
  if (mode !== "mini_test") {
    return profile.totalQuestions;
  }

  if (
    typeof requestedTotalQuestions === "number" &&
    Number.isFinite(requestedTotalQuestions)
  ) {
    const normalized = Math.floor(requestedTotalQuestions);

    if (normalized >= 1 && normalized <= 64) {
      return normalized;
    }
  }

  return DEFAULT_MINI_TEST_QUESTIONS;
}

export function getExamDurationMinutes(
  totalQuestions: number,
  profile: ExamProfile = getExamProfile()
) {
  const normalized = Math.max(1, Math.floor(totalQuestions));
  return Math.max(
    5,
    Math.ceil((normalized * profile.durationMinutes) / profile.totalQuestions)
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

/**
 * Soft per-bucket video floors for base scope, proportional to point mix.
 * Used when composing media quota with 3/2/1 point buckets.
 */
export function getExamBaseVideoTargetsByPoints(
  pointTargets: Array<{ points: number; count: number }>,
  videoMinTarget: number
) {
  const normalizedVideoMin = Math.max(0, Math.floor(videoMinTarget));
  const totalSlots = pointTargets.reduce((sum, entry) => sum + entry.count, 0);

  if (normalizedVideoMin <= 0 || totalSlots <= 0) {
    return pointTargets.map((entry) => ({
      points: entry.points,
      count: entry.count,
      videoMin: 0,
    }));
  }

  const scaled = pointTargets.map((entry) => {
    const raw = (entry.count * normalizedVideoMin) / totalSlots;
    const floorCount = Math.floor(raw);

    return {
      points: entry.points,
      count: entry.count,
      floorCount,
      remainder: raw - floorCount,
    };
  });
  const remaining =
    Math.min(normalizedVideoMin, totalSlots) -
    scaled.reduce((sum, entry) => sum + entry.floorCount, 0);

  return scaled
    .sort((left, right) => {
      if (left.remainder !== right.remainder) {
        return right.remainder - left.remainder;
      }

      return right.points - left.points;
    })
    .map((entry, index) => ({
      points: entry.points,
      count: entry.count,
      videoMin: Math.min(
        entry.count,
        entry.floorCount + (index < remaining ? 1 : 0)
      ),
    }))
    .sort((left, right) => right.points - left.points);
}

export function getScaledExamPassPoints(
  totalPointsTarget: number,
  profile: ExamProfile = getExamProfile()
) {
  return Math.max(
    1,
    Math.round(
      (Math.max(1, totalPointsTarget) * profile.passingPoints) / profile.maxPoints
    )
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

export function formatQuestionCountdown(totalSeconds: number | null | undefined) {
  const normalized = Math.max(0, Math.ceil(totalSeconds ?? 0));
  return `${normalized}s`;
}

export function getExamQuestionTiming(
  scope: QuestionScope,
  profile: ExamProfile = getExamProfile()
): ExamQuestionTiming {
  if (scope === "specialist") {
    return {
      readSeconds: 0,
      answerSeconds: profile.specialistSeconds,
    };
  }

  return {
    readSeconds: profile.baseReadSeconds,
    answerSeconds: profile.baseAnswerSeconds,
  };
}

export function getExamQuestionPhaseDuration(
  phase: ExamQuestionTimerPhase,
  timing: ExamQuestionTiming
) {
  if (phase === "read") {
    return timing.readSeconds;
  }

  if (phase === "answer") {
    return timing.answerSeconds;
  }

  return 0;
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
