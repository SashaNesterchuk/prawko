import type { SupportedLocale } from "@prawko/config";

import type { QuestionAttempt } from "../questions/types";
import { getWarsawIsoDate } from "../study-plan/supabase-study-plan-progress";

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
  hasActivity: boolean;
  isStreakDay: boolean;
};

const WEEKDAY_LABELS: Record<SupportedLocale, string[]> = {
  ua: ["П", "В", "С", "Ч", "П", "С", "Н"],
  pl: ["P", "W", "Ś", "C", "P", "S", "N"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
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

export function buildWeekActivity(
  attempts: QuestionAttempt[],
  locale: SupportedLocale,
  referenceDate: Date = new Date()
): WeekDayActivity[] {
  const activityDates = collectActivityDates(attempts);
  const streakDates = getStreakDateSet(activityDates, getWarsawIsoDate(referenceDate));
  const weekStart = getMondayOfWeek(referenceDate);
  const labels = WEEKDAY_LABELS[locale];
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
      hasActivity: activityDates.has(isoDate),
      isStreakDay: streakDates.has(isoDate),
    };
  });
}

function collectActivityDates(attempts: QuestionAttempt[]) {
  const dates = new Set<string>();

  for (const attempt of attempts) {
    dates.add(getWarsawIsoDate(new Date(attempt.answeredAt)));
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

function getWarsawDayOfMonth(date: Date) {
  return getWarsawDateParts(date).day;
}

function getWarsawDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Warsaw",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
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
    locale === "ua" ? "uk-UA" : locale === "pl" ? "pl-PL" : "en-GB";

  return new Intl.DateTimeFormat(localeTag, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}
