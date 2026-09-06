import type { QuestionSession } from "../../questions/types";

import {
  createHomeDailySessionKey,
  getHomeDailyPracticeStatus,
  getHomeDailyRemainingCount,
  isHomeDailySessionKey,
  isHomeTodayStartCardVisible,
  isSameHomeDailySession,
  resumeHomeDailySession,
} from "../home-daily-practice";

function makeSession(
  overrides: Partial<QuestionSession> & {
    request?: Partial<QuestionSession["request"]>;
  } = {}
): QuestionSession {
  const { request, ...rest } = overrides;

  return {
    id: "session-daily",
    request: {
      currentCategory: "B",
      mode: "mini_test",
      questionLimit: 10,
      sessionKey: createHomeDailySessionKey("2026-09-06", "B"),
      ...request,
    },
    questionIds: ["q1", "q2", "q3"],
    currentIndex: 0,
    answers: {},
    createdAt: "2026-09-06T08:00:00.000Z",
    finishedAt: null,
    emptyReason: null,
    ...rest,
  };
}

describe("home daily practice", () => {
  it("uses a stable session key for the Warsaw day and category", () => {
    expect(createHomeDailySessionKey("2026-09-06", "B")).toBe(
      "home-today:2026-09-06:B"
    );
    expect(isHomeDailySessionKey("home-today:2026-09-06:B")).toBe(true);
    expect(isHomeDailySessionKey("B:home-today:2026-09-06:B")).toBe(true);
    expect(isHomeDailySessionKey("B-learning-all-abc")).toBe(false);
  });

  it("treats the category-prefixed stored key as today's set", () => {
    expect(
      getHomeDailyPracticeStatus({
        session: makeSession({
          request: { sessionKey: "B:home-today:2026-09-06:B" },
        }),
        today: "2026-09-06",
        category: "B",
      })
    ).toBe("in_progress");
  });

  it("treats another day as a missing set", () => {
    expect(
      getHomeDailyPracticeStatus({
        session: makeSession(),
        today: "2026-09-07",
        category: "B",
      })
    ).toBe("missing");
  });

  it("keeps in-progress answers and remaining count", () => {
    const session = makeSession({
      answers: {
        q1: {
          questionId: "q1",
          selectedAnswer: "A",
          isCorrect: true,
          answeredAt: "2026-09-06T08:01:00.000Z",
        },
      },
    });

    expect(
      getHomeDailyPracticeStatus({
        session,
        today: "2026-09-06",
        category: "B",
      })
    ).toBe("in_progress");
    expect(getHomeDailyRemainingCount(session)).toBe(2);
  });

  it("marks a finished set as done for the day", () => {
    expect(
      getHomeDailyPracticeStatus({
        session: makeSession({
          finishedAt: "2026-09-06T08:20:00.000Z",
        }),
        today: "2026-09-06",
        category: "B",
      })
    ).toBe("done");
  });

  it("keeps the start card and hides the parked done copy", () => {
    expect(isHomeTodayStartCardVisible("missing")).toBe(true);
    expect(isHomeTodayStartCardVisible("in_progress")).toBe(true);
    expect(isHomeTodayStartCardVisible("done")).toBe(false);
  });

  it("treats the category-prefixed route key as the same daily set", () => {
    expect(
      isSameHomeDailySession(
        "home-today:2026-09-06:B",
        "B:home-today:2026-09-06:B"
      )
    ).toBe(true);
    expect(
      isSameHomeDailySession(
        "B:home-today:2026-09-06:B",
        "B:home-today:2026-09-07:B"
      )
    ).toBe(false);
  });

  it("opens an in-progress set at the first unanswered question", () => {
    const session = makeSession({
      currentIndex: 0,
      answers: {
        q1: {
          questionId: "q1",
          selectedAnswer: "A",
          isCorrect: true,
          answeredAt: "2026-09-06T08:01:00.000Z",
        },
      },
    });

    expect(resumeHomeDailySession(session).currentIndex).toBe(1);
    expect(
      resumeHomeDailySession({
        ...session,
        finishedAt: "2026-09-06T08:20:00.000Z",
      }).currentIndex
    ).toBe(0);
  });
});
