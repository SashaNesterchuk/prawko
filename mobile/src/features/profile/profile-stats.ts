import type { SupportedLocale } from "@prawko/config";
import { getContentLocale } from "@prawko/config";

import { resolveLocalReadinessPercent } from "../questions/readiness-assessment";
import type { QuestionAttempt } from "../questions/types";

export type ProfileStatMetrics = {
  sessions: number;
  accuracy: number;
  exams: number;
  streak: number;
};

export type WeekDayActivity = {
  isoDate: string;
  dayOfMonth: number;
  weekdayLabel: string;
  isToday: boolean;
  isFuture: boolean;
  hasActivity: boolean;
  isStreakDay: boolean;
};

const WEEKDAY_LABELS: Record<"pl" | "ua" | "en" | "de", string[]> = {
  ua: ["П", "В", "С", "Ч", "П", "С", "Н"],
  pl: ["P", "W", "Ś", "C", "P", "S", "N"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  de: ["M", "D", "M", "D", "F", "S", "S"],
};

export function getLearningDaysCount(attempts: QuestionAttempt[]) {
  return collectActivityDates(attempts).size;
}

export function getProfileStatMetrics(
  attempts: QuestionAttempt[],
  examCount: number
): ProfileStatMetrics {
  const sessionIds = new Set(attempts.map((attempt) => attempt.sessionId));
  const correct = attempts.filter((attempt) => attempt.isCorrect).length;
  const accuracy =
    attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0;
  const activityDates = collectActivityDates(attempts);

  return {
    sessions: sessionIds.size,
    accuracy,
    exams: examCount,
    streak: getCurrentStreak(activityDates),
  };
}

export function getCurrentStreakFromAttempts(attempts: QuestionAttempt[]) {
  return getCurrentStreak(collectActivityDates(attempts));
}

export const MAX_READINESS_PERIOD_DAYS = 7;

export type ReadinessPeriodChange = {
  deltaPercent: number;
  periodDays: number;
};

export type ReadinessPeriodChangeLabelKey =
  | "readinessPeriodChangeToday"
  | "readinessPeriodChangeDays"
  | "readinessPeriodChangeDaysMany";

export function resolveReadinessPeriodChangeLabelKey(
  periodDays: number
): ReadinessPeriodChangeLabelKey {
  if (periodDays <= 1) {
    return "readinessPeriodChangeToday";
  }

  if (periodDays >= 5) {
    return "readinessPeriodChangeDaysMany";
  }

  return "readinessPeriodChangeDays";
}

/**
 * Signed change of the displayed readiness index over an adaptive window.
 * New learners use "today", then 2..7 days, then stay at 7. Returns null when
 * the index did not move. Coverage-only users still see coverage change
 * because that is the local index; assessment/remote scores are not replaced
 * by newly seen material. Questions without a local first-seen timestamp are
 * treated as older than the window (common after remote sync).
 */
export function getReadinessPeriodChange(input: {
  attempts: QuestionAttempt[];
  seenQuestionIds: readonly string[];
  totalQuestions: number;
  assessment?: {
    completedAt: string;
    scorePercent: number;
  } | null;
  currentReadiness?: number | null;
  referenceDate?: Date;
}): ReadinessPeriodChange | null {
  const { attempts, seenQuestionIds, totalQuestions, assessment } = input;

  if (totalQuestions <= 0) {
    return null;
  }

  const assessmentCompletedAt = Date.parse(assessment?.completedAt ?? "");
  const resolvedAssessment =
    assessment != null &&
    Number.isFinite(assessment.scorePercent) &&
    Number.isFinite(assessmentCompletedAt)
      ? assessment
      : null;

  if (seenQuestionIds.length === 0 && resolvedAssessment == null) {
    return null;
  }

  const firstSeenAtByQuestion = new Map<string, number>();
  let firstActivityIso: string | null = null;

  for (const attempt of attempts) {
    const timestamp = Date.parse(attempt.answeredAt);

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const previous = firstSeenAtByQuestion.get(attempt.questionId);

    if (previous == null || timestamp < previous) {
      firstSeenAtByQuestion.set(attempt.questionId, timestamp);
    }

    const attemptIso = getWarsawIsoDate(new Date(timestamp));

    if (firstActivityIso == null || attemptIso < firstActivityIso) {
      firstActivityIso = attemptIso;
    }
  }

  if (resolvedAssessment != null) {
    const assessmentIso = getWarsawIsoDate(new Date(assessmentCompletedAt));

    if (firstActivityIso == null || assessmentIso < firstActivityIso) {
      firstActivityIso = assessmentIso;
    }
  }

  const todayIso = getWarsawIsoDate(input.referenceDate ?? new Date());
  const periodDays = resolveReadinessPeriodDays(firstActivityIso, todayIso);
  const cutoffIso = shiftIsoDate(todayIso, -periodDays);
  let seenAtBaseline = 0;

  for (const questionId of seenQuestionIds) {
    const firstSeenAt = firstSeenAtByQuestion.get(questionId);

    if (firstSeenAt == null) {
      seenAtBaseline += 1;
      continue;
    }

    const firstSeenIso = getWarsawIsoDate(new Date(firstSeenAt));

    if (firstSeenIso <= cutoffIso) {
      seenAtBaseline += 1;
    }
  }

  const assessmentAtBaseline =
    resolvedAssessment != null &&
    getWarsawIsoDate(new Date(assessmentCompletedAt)) <= cutoffIso
      ? resolvedAssessment.scorePercent
      : null;
  const reconstructedNow = resolveLocalReadinessPercent({
    assessmentScorePercent: resolvedAssessment?.scorePercent ?? null,
    seen: seenQuestionIds.length,
    total: totalQuestions,
  });
  const readinessThen = resolveLocalReadinessPercent({
    assessmentScorePercent: assessmentAtBaseline,
    seen: seenAtBaseline,
    total: totalQuestions,
  });
  const readinessNow =
    typeof input.currentReadiness === "number" &&
    Number.isFinite(input.currentReadiness)
      ? Math.max(0, Math.min(100, Math.round(input.currentReadiness)))
      : reconstructedNow;
  const deltaPercent = readinessNow - readinessThen;

  if (deltaPercent === 0) {
    return null;
  }

  return {
    deltaPercent,
    periodDays,
  };
}

function resolveReadinessPeriodDays(
  firstActivityIso: string | null,
  todayIso: string
) {
  if (firstActivityIso == null || firstActivityIso >= todayIso) {
    return 1;
  }

  return Math.min(
    isoDateDiffDays(todayIso, firstActivityIso) + 1,
    MAX_READINESS_PERIOD_DAYS
  );
}

function isoDateDiffDays(laterIso: string, earlierIso: string) {
  const later = utcDateFromIsoDate(laterIso);
  const earlier = utcDateFromIsoDate(earlierIso);

  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function utcDateFromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function buildWeekActivity(
  attempts: QuestionAttempt[],
  locale: SupportedLocale,
  referenceDate: Date = new Date()
): WeekDayActivity[] {
  const activityDates = collectActivityDates(attempts);
  const streakDates = getStreakDateSet(activityDates, getWarsawIsoDate(referenceDate));
  const weekStart = getMondayOfWeek(referenceDate);
  const labels = WEEKDAY_LABELS[getContentLocale(locale)];
  const todayIso = getWarsawIsoDate(referenceDate);

  return labels.map((weekdayLabel, index) => {
    const date = addDays(weekStart, index);
    const isoDate = getWarsawIsoDate(date);
    const dayOfMonth = getWarsawDayOfMonth(date);

    return {
      isoDate,
      dayOfMonth,
      weekdayLabel,
      isToday: isoDate === todayIso,
      isFuture: isoDate > todayIso,
      hasActivity: activityDates.has(isoDate),
      isStreakDay: streakDates.has(isoDate),
    };
  });
}

/**
 * Attempt objects are reused across store updates, so each one is only ever
 * converted to a Warsaw date once instead of on every re-render.
 */
const attemptDateCache = new WeakMap<QuestionAttempt, string>();

function collectActivityDates(attempts: QuestionAttempt[]) {
  const dates = new Set<string>();

  for (const attempt of attempts) {
    let isoDate = attemptDateCache.get(attempt);

    if (!isoDate) {
      isoDate = getWarsawIsoDate(new Date(attempt.answeredAt));
      attemptDateCache.set(attempt, isoDate);
    }

    dates.add(isoDate);
  }

  return dates;
}

function getCurrentStreak(activityDates: Set<string>, todayIso?: string) {
  const today = todayIso ?? getWarsawIsoDate();
  let cursor = today;
  let streak = 0;

  if (!activityDates.has(cursor)) {
    cursor = shiftIsoDate(cursor, -1);
  }

  while (activityDates.has(cursor)) {
    streak += 1;
    cursor = shiftIsoDate(cursor, -1);
  }

  return streak;
}

function getStreakDateSet(activityDates: Set<string>, todayIso: string) {
  const streakDates = new Set<string>();
  let cursor = todayIso;

  if (!activityDates.has(cursor)) {
    cursor = shiftIsoDate(cursor, -1);
  }

  while (activityDates.has(cursor)) {
    streakDates.add(cursor);
    cursor = shiftIsoDate(cursor, -1);
  }

  return streakDates;
}

function getMondayOfWeek(date: Date) {
  const warsawDate = getWarsawDateParts(date);
  const utcDate = new Date(
    Date.UTC(warsawDate.year, warsawDate.month - 1, warsawDate.day)
  );
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getWarsawIsoDate(date: Date = new Date()) {
  const { year, month, day } = getWarsawDateParts(date);

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWarsawDayOfMonth(date: Date) {
  return getWarsawDateParts(date).day;
}

let warsawDatePartsFormatter: Intl.DateTimeFormat | null = null;

function getWarsawDateParts(date: Date) {
  warsawDatePartsFormatter ??= new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Warsaw",
    year: "numeric",
  });

  const parts = warsawDatePartsFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(
    parts.find((part) => part.type === "month")?.value ?? 0
  );
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);

  return { year, month, day };
}

function shiftIsoDate(isoDate: string, deltaDays: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function formatProfileExamDate(
  isoDate: string,
  locale: SupportedLocale
) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const localeTag =
    locale === "ua"
      ? "uk-UA"
      : locale === "pl"
        ? "pl-PL"
        : locale === "de"
          ? "de-DE"
          : locale === "es"
            ? "es-ES"
            : "en-GB";

  return new Intl.DateTimeFormat(localeTag, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}
