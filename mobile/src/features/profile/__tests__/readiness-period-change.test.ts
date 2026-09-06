import type { QuestionAttempt } from "../../questions/types";
import {
  computeLocalReadinessScore,
  computeLocalReadinessScoreComponents,
} from "../../questions/readiness-score";
import {
  getReadinessPeriodChange,
  resolveReadinessPeriodChangeLabelKey,
} from "../profile-stats";

const TODAY = new Date("2026-08-15T12:00:00.000Z");

function makeAttempt(
  questionId: string,
  answeredAt: string,
  overrides: Partial<QuestionAttempt> = {}
): QuestionAttempt {
  return {
    id: `attempt-${questionId}`,
    questionId,
    sessionId: "session-1",
    sessionMode: "learning",
    topicBlock: "safety",
    selectedAnswer: "A",
    isCorrect: true,
    answeredAt,
    ...overrides,
  };
}

function makeSeenAttempts(
  count: number,
  prefix: string,
  answeredAt: string,
  overrides: Partial<QuestionAttempt> = {}
) {
  return Array.from({ length: count }, (_, index) =>
    makeAttempt(`${prefix}-${index}`, answeredAt, {
      id: `attempt-${prefix}-${index}`,
      ...overrides,
    })
  );
}

describe("getReadinessPeriodChange", () => {
  it("does not treat newly covered questions as readiness change when accuracy stays the same", () => {
    const previouslySeen = makeSeenAttempts(
      94,
      "old",
      "2026-08-07T12:00:00.000Z"
    );
    const newlyCovered = makeSeenAttempts(
      199,
      "new",
      "2026-08-15T12:00:00.000Z"
    );
    const attempts = [...previouslySeen, ...newlyCovered];
    const currentReadiness = computeLocalReadinessScore({
      attempts,
      now: TODAY,
    });

    expect(
      getReadinessPeriodChange({
        attempts,
        currentReadiness,
        referenceDate: TODAY,
      })
    ).toBeNull();
  });

  it("shows today's index jump for a new learner instead of the first-session percent", () => {
    const attempts = [
      ...makeSeenAttempts(3, "correct", "2026-08-15T12:00:00.000Z", {
        sessionId: "mini-1",
        sessionMode: "mini_test",
        isCorrect: true,
      }),
      ...makeSeenAttempts(7, "wrong", "2026-08-15T12:00:00.000Z", {
        sessionId: "mini-1",
        sessionMode: "mini_test",
        isCorrect: false,
      }),
    ];
    const currentReadiness = computeLocalReadinessScore({
      attempts,
      now: TODAY,
    });

    expect(currentReadiness).toBe(24);
    expect(
      getReadinessPeriodChange({
        attempts,
        currentReadiness,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 24,
      periodDays: 1,
    });
  });

  it("does not show +24% today after 10 questions in the real bank", () => {
    const attempts = [
      ...makeSeenAttempts(3, "correct", "2026-08-15T12:00:00.000Z", {
        sessionId: "mini-1",
        sessionMode: "mini_test",
        isCorrect: true,
      }),
      ...makeSeenAttempts(7, "wrong", "2026-08-15T12:00:00.000Z", {
        sessionId: "mini-1",
        sessionMode: "mini_test",
        isCorrect: false,
      }),
    ];

    expect(
      getReadinessPeriodChange({
        attempts,
        totalQuestions: 2142,
        currentReadiness: computeLocalReadinessScore({
          attempts,
          totalQuestions: 2142,
          now: TODAY,
        }),
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: 1,
      periodDays: 1,
    });
  });

  it("grows the window from today to 7 days, then stays at 7", () => {
    const seenYesterday = makeSeenAttempts(
      20,
      "yesterday",
      "2026-08-14T12:00:00.000Z"
    );
    const seenTwoDaysAgo = makeSeenAttempts(
      20,
      "two-days",
      "2026-08-13T12:00:00.000Z"
    );
    const seenTenDaysAgo = makeSeenAttempts(
      20,
      "ten-days",
      "2026-08-05T12:00:00.000Z",
      { isCorrect: false, sessionMode: "mini_test", sessionId: "old-exam" }
    );
    const seenYesterdayBetter = makeSeenAttempts(
      20,
      "yesterday",
      "2026-08-14T12:00:00.000Z",
      { sessionMode: "mini_test", sessionId: "new-exam" }
    );

    expect(
      getReadinessPeriodChange({
        attempts: seenYesterday,
        currentReadiness: computeLocalReadinessScore({
          attempts: seenYesterday,
          now: TODAY,
        }),
        referenceDate: TODAY,
      })?.periodDays
    ).toBe(2);

    expect(
      getReadinessPeriodChange({
        attempts: seenTwoDaysAgo,
        currentReadiness: computeLocalReadinessScore({
          attempts: seenTwoDaysAgo,
          now: TODAY,
        }),
        referenceDate: TODAY,
      })?.periodDays
    ).toBe(3);

    const weekAttempts = [...seenTenDaysAgo, ...seenYesterdayBetter];
    const weekNow = computeLocalReadinessScore({
      attempts: weekAttempts,
      now: TODAY,
    });
    const weekThen = computeLocalReadinessScore({
      attempts: seenTenDaysAgo,
      now: TODAY,
    });

    expect(weekNow).not.toBe(weekThen);
    expect(
      getReadinessPeriodChange({
        attempts: weekAttempts,
        currentReadiness: weekNow,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: weekNow - weekThen,
      periodDays: 7,
    });
  });

  it("hides the badge when the index is unchanged over the window", () => {
    const seen = makeSeenAttempts(40, "old", "2026-08-01T12:00:00.000Z");

    expect(
      getReadinessPeriodChange({
        attempts: seen,
        currentReadiness: computeLocalReadinessScore({
          attempts: seen,
          now: TODAY,
        }),
        referenceDate: TODAY,
      })
    ).toBeNull();
  });

  it("shows the readinessScore delta, not unique coverage gained in the session", () => {
    const previouslySeen = makeSeenAttempts(
      10,
      "old",
      "2026-08-05T12:00:00.000Z",
      { isCorrect: false, sessionMode: "mini_test", sessionId: "old-exam" }
    );
    const newlyCovered = makeSeenAttempts(
      20,
      "new",
      "2026-08-15T12:00:00.000Z",
      { sessionMode: "mini_test", sessionId: "new-exam" }
    );
    const attempts = [...previouslySeen, ...newlyCovered];
    const currentReadiness = computeLocalReadinessScore({
      attempts,
      now: TODAY,
    });
    const readinessThen = computeLocalReadinessScore({
      attempts: previouslySeen,
      now: TODAY,
    });

    expect(currentReadiness).not.toBe(30);
    expect(
      getReadinessPeriodChange({
        attempts,
        currentReadiness,
        referenceDate: TODAY,
      })
    ).toEqual({
      deltaPercent: currentReadiness - readinessThen,
      periodDays: 7,
    });
    expect(
      computeLocalReadinessScoreComponents({ attempts, now: TODAY })
        .accuracyPercent
    ).toBe(66.7);
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
