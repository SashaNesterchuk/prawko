import type { QuestionAttempt } from "../../questions/types";
import {
  getReadinessPeriodChange,
  resolveReadinessPeriodChangeLabelKey,
} from "../profile-stats";

const TOTAL_QUESTIONS = 2139;
const TODAY = new Date("2026-08-15T12:00:00.000Z");

function makeAttempt(questionId: string, answeredAt: string): QuestionAttempt {
  return {
    id: `attempt-${questionId}`,
    questionId,
    sessionId: "session-1",
    sessionMode: "learning",
    topicBlock: "safety",
    selectedAnswer: "A",
    isCorrect: true,
    answeredAt,
  };
}

function makeSeenIds(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

describe("getReadinessPeriodChange", () => {
  it("does not treat newly covered questions as readiness change when the index is an assessment score", () => {
    const previouslySeen = makeSeenIds(94, "old");
    const newlyCovered = makeSeenIds(199, "new");
    const attempts = [
      ...previouslySeen.map((questionId) =>
        makeAttempt(questionId, "2026-08-07T12:00:00.000Z")
      ),
      ...newlyCovered.map((questionId) =>
        makeAttempt(questionId, "2026-08-15T12:00:00.000Z")
      ),
    ];

    expect(
      getReadinessPeriodChange({
        attempts,
        seenQuestionIds: [...previouslySeen, ...newlyCovered],
        totalQuestions: TOTAL_QUESTIONS,
        assessment: {
          completedAt: "2026-08-07T12:00:00.000Z",
          scorePercent: 53,
        },
        currentReadiness: 53,
        referenceDate: TODAY,
      })
    ).toBeNull();
  });

  it("shows today's index jump for a new learner instead of coverage gained in the session", () => {
    const coveredToday = makeSeenIds(293, "today");

    expect(
      getReadinessPeriodChange({
        attempts: coveredToday.map((questionId) =>
          makeAttempt(questionId, "2026-08-15T14:00:00.000Z")
        ),
        seenQuestionIds: coveredToday,
        totalQuestions: TOTAL_QUESTIONS,
        assessment: {
          completedAt: "2026-08-15T12:00:00.000Z",
          scorePercent: 53,
        },
        currentReadiness: 53,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 53,
      periodDays: 1,
    });
  });

  it("grows the window from today to 7 days, then stays at 7", () => {
    const seenYesterday = makeSeenIds(20, "yesterday");
    const seenTwoDaysAgo = makeSeenIds(20, "two-days");
    const seenTenDaysAgo = makeSeenIds(20, "ten-days");

    expect(
      getReadinessPeriodChange({
        attempts: seenYesterday.map((questionId) =>
          makeAttempt(questionId, "2026-08-14T12:00:00.000Z")
        ),
        seenQuestionIds: seenYesterday,
        totalQuestions: 100,
        currentReadiness: 20,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 20,
      periodDays: 2,
    });

    expect(
      getReadinessPeriodChange({
        attempts: seenTwoDaysAgo.map((questionId) =>
          makeAttempt(questionId, "2026-08-13T12:00:00.000Z")
        ),
        seenQuestionIds: seenTwoDaysAgo,
        totalQuestions: 100,
        currentReadiness: 20,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 20,
      periodDays: 3,
    });

    expect(
      getReadinessPeriodChange({
        attempts: [
          ...seenTenDaysAgo.map((questionId) =>
            makeAttempt(questionId, "2026-08-05T12:00:00.000Z")
          ),
          ...seenYesterday.map((questionId) =>
            makeAttempt(questionId, "2026-08-14T12:00:00.000Z")
          ),
        ],
        seenQuestionIds: [...seenTenDaysAgo, ...seenYesterday],
        totalQuestions: 100,
        currentReadiness: 40,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 20,
      periodDays: 7,
    });
  });

  it("hides the badge when the index is unchanged over the window", () => {
    const seen = makeSeenIds(40, "old");

    expect(
      getReadinessPeriodChange({
        attempts: seen.map((questionId) =>
          makeAttempt(questionId, "2026-08-01T12:00:00.000Z")
        ),
        seenQuestionIds: seen,
        totalQuestions: 100,
        currentReadiness: 40,
        referenceDate: TODAY,
      })
    ).toBeNull();
  });

  it("uses coverage change only when coverage is the displayed index", () => {
    const previouslySeen = makeSeenIds(10, "old");
    const newlyCovered = makeSeenIds(20, "new");

    expect(
      getReadinessPeriodChange({
        attempts: [
          ...previouslySeen.map((questionId) =>
            makeAttempt(questionId, "2026-08-05T12:00:00.000Z")
          ),
          ...newlyCovered.map((questionId) =>
            makeAttempt(questionId, "2026-08-15T12:00:00.000Z")
          ),
        ],
        seenQuestionIds: [...previouslySeen, ...newlyCovered],
        totalQuestions: 100,
        currentReadiness: 30,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 20,
      periodDays: 7,
    });
  });
});

describe("resolveReadinessPeriodChangeLabelKey", () => {
  it("picks today, paucal, and many copy keys", () => {
    expect(resolveReadinessPeriodChangeLabelKey(1)).toBe(
      "readinessPeriodChangeToday"
    );
    expect(resolveReadinessPeriodChangeLabelKey(2)).toBe(
      "readinessPeriodChangeDays"
    );
    expect(resolveReadinessPeriodChangeLabelKey(4)).toBe(
      "readinessPeriodChangeDays"
    );
    expect(resolveReadinessPeriodChangeLabelKey(5)).toBe(
      "readinessPeriodChangeDaysMany"
    );
    expect(resolveReadinessPeriodChangeLabelKey(7)).toBe(
      "readinessPeriodChangeDaysMany"
    );
  });
});
