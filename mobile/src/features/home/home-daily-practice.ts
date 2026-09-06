import type { DrivingCategory } from "@prawko/config";

import type { QuestionSession } from "../questions/types";

import { FIRST_START_QUESTION_COUNT } from "./first-start";

export const HOME_DAILY_QUESTION_COUNT = FIRST_START_QUESTION_COUNT;

/** Parked until the completed-day copy is rewritten. */
export const SHOW_HOME_DAILY_DONE_CARD = false;

export type HomeDailyPracticeStatus = "missing" | "in_progress" | "done";

export function isHomeTodayStartCardVisible(status: HomeDailyPracticeStatus) {
  return status !== "done" || SHOW_HOME_DAILY_DONE_CARD;
}

const HOME_DAILY_KEY_PATTERN = /home-today:(\d{4}-\d{2}-\d{2}):([^:]+)/;

export function createHomeDailySessionKey(
  date: string,
  category: DrivingCategory | string
) {
  return `home-today:${date}:${category}`;
}

export function isHomeDailySessionKey(sessionKey: string | null | undefined) {
  return typeof sessionKey === "string" && sessionKey.includes("home-today:");
}

export function getHomeDailySessionFingerprint(
  sessionKey: string | null | undefined
) {
  if (typeof sessionKey !== "string") {
    return null;
  }

  const match = sessionKey.match(HOME_DAILY_KEY_PATTERN);

  return match ? `${match[1]}:${match[2]}` : null;
}

export function isSameHomeDailySession(
  left: string | null | undefined,
  right: string | null | undefined
) {
  const fingerprint = getHomeDailySessionFingerprint(left);

  return fingerprint != null && fingerprint === getHomeDailySessionFingerprint(right);
}

export function isHomeDailySessionFor(input: {
  sessionKey: string | null | undefined;
  today: string;
  category: DrivingCategory | string;
}) {
  return (
    getHomeDailySessionFingerprint(input.sessionKey) ===
    `${input.today}:${input.category}`
  );
}

export function getHomeDailyPracticeStatus(input: {
  session: QuestionSession | null | undefined;
  today: string;
  category: DrivingCategory | string;
}): HomeDailyPracticeStatus {
  if (
    input.session == null ||
    !isHomeDailySessionFor({
      sessionKey: input.session.request.sessionKey,
      today: input.today,
      category: input.category,
    })
  ) {
    return "missing";
  }

  if (input.session.finishedAt && !input.session.emptyReason) {
    return "done";
  }

  return "in_progress";
}

export function getHomeDailyRemainingCount(session: QuestionSession) {
  return session.questionIds.filter((questionId) => session.answers[questionId] == null)
    .length;
}

export function resumeHomeDailySession(session: QuestionSession) {
  if (session.finishedAt || session.emptyReason) {
    return session;
  }

  const firstUnansweredIndex = session.questionIds.findIndex(
    (questionId) => session.answers[questionId] == null
  );

  if (firstUnansweredIndex < 0 || firstUnansweredIndex === session.currentIndex) {
    return session;
  }

  return {
    ...session,
    currentIndex: firstUnansweredIndex,
  };
}
