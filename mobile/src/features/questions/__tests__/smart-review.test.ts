import {
  buildQuestionSession,
  createEmptyQuestionUserState,
  getNextQuestionUserStateAfterAttempt,
  getQuestionDisplayStats,
} from "../question-engine";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type { LocalQuestion, QuestionUserState } from "../types";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  difficultySeed: number
): LocalQuestion {
  return {
    id,
    sourceRowNumber: 1,
    prompt: txt,
    explanation: txt,
    answerType: "abc",
    correctAnswer: "A",
    choices: [
      { id: "A", text: txt },
      { id: "B", text: txt },
      { id: "C", text: txt },
    ],
    points: 1,
    scope: "base",
    topicBlock: "signs",
    primaryTopicId: "road_markings_and_warning_signs",
    topicIds: ["road_markings_and_warning_signs"],
    difficultySeed,
  };
}

function daysAgoIso(days: number, now = new Date("2026-08-06T12:00:00.000Z")) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function withReviewDue(
  base: QuestionUserState,
  overrides: Partial<QuestionUserState>
): QuestionUserState {
  return { ...base, ...overrides };
}

describe("smart review (review_due)", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("fragile-correct", 50),
      makeQuestion("post-mistake", 50),
      makeQuestion("mastered-due", 50),
      makeQuestion("mastered-fresh", 50),
      makeQuestion("unresolved-wrong", 10),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("schedules 3 days after first correct and 14 days after mastery", () => {
    const empty = createEmptyQuestionUserState("q1");
    const afterFirstCorrect = getNextQuestionUserStateAfterAttempt(empty, {
      answeredAt: "2026-08-01T12:00:00.000Z",
      isCorrect: true,
    });

    expect(afterFirstCorrect.reviewDueAt).toBe(
      new Date("2026-08-04T12:00:00.000Z").toISOString()
    );

    let state = empty;
    for (let i = 0; i < 3; i += 1) {
      state = getNextQuestionUserStateAfterAttempt(state, {
        answeredAt: `2026-08-0${i + 1}T12:00:00.000Z`,
        isCorrect: true,
      });
    }

    expect(state.isMastered || state.consecutiveCorrect >= 3).toBe(true);
    expect(state.reviewDueAt).toBe(
      new Date("2026-08-17T12:00:00.000Z").toISOString()
    );
  });

  it("includes mastered cards whose refresh timer elapsed", () => {
    const states = {
      "fragile-correct": withReviewDue(
        createEmptyQuestionUserState("fragile-correct"),
        {
          timesSeen: 1,
          timesCorrect: 1,
          consecutiveCorrect: 1,
          lastSeenAt: daysAgoIso(4, now),
          lastCorrectAt: daysAgoIso(4, now),
          reviewDueAt: daysAgoIso(1, now),
        }
      ),
      "mastered-due": withReviewDue(
        createEmptyQuestionUserState("mastered-due"),
        {
          timesSeen: 5,
          timesCorrect: 5,
          consecutiveCorrect: 3,
          isMastered: true,
          lastSeenAt: daysAgoIso(20, now),
          lastCorrectAt: daysAgoIso(20, now),
          reviewDueAt: daysAgoIso(6, now),
        }
      ),
      "mastered-fresh": withReviewDue(
        createEmptyQuestionUserState("mastered-fresh"),
        {
          timesSeen: 5,
          timesCorrect: 5,
          consecutiveCorrect: 3,
          isMastered: true,
          lastSeenAt: daysAgoIso(2, now),
          lastCorrectAt: daysAgoIso(2, now),
          reviewDueAt: daysAgoIso(-12, now),
        }
      ),
    };

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "review_due",
        sessionKey: "test-review",
      },
      states,
      now
    );

    expect(session.questionIds).toContain("fragile-correct");
    expect(session.questionIds).toContain("mastered-due");
    expect(session.questionIds).not.toContain("mastered-fresh");
  });

  it("orders consolidating / overdue cards ahead of maintenance mastery refresh", () => {
    const states = {
      "post-mistake": withReviewDue(
        createEmptyQuestionUserState("post-mistake"),
        {
          timesSeen: 3,
          timesCorrect: 1,
          timesWrong: 1,
          consecutiveCorrect: 1,
          lastSeenAt: daysAgoIso(4, now),
          lastCorrectAt: daysAgoIso(4, now),
          lastWrongAt: daysAgoIso(10, now),
          reviewDueAt: daysAgoIso(1, now),
        }
      ),
      "mastered-due": withReviewDue(
        createEmptyQuestionUserState("mastered-due"),
        {
          timesSeen: 5,
          timesCorrect: 5,
          consecutiveCorrect: 3,
          isMastered: true,
          lastSeenAt: daysAgoIso(20, now),
          lastCorrectAt: daysAgoIso(20, now),
          reviewDueAt: daysAgoIso(1, now),
        }
      ),
      "unresolved-wrong": withReviewDue(
        createEmptyQuestionUserState("unresolved-wrong"),
        {
          timesSeen: 2,
          timesWrong: 2,
          consecutiveCorrect: 0,
          lastSeenAt: daysAgoIso(3, now),
          lastWrongAt: daysAgoIso(3, now),
          reviewDueAt: daysAgoIso(2, now),
        }
      ),
    };

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "review_due",
        sessionKey: "test-order",
      },
      states,
      now
    );

    expect(session.questionIds[0]).toBe("unresolved-wrong");
    expect(session.questionIds.indexOf("post-mistake")).toBeLessThan(
      session.questionIds.indexOf("mastered-due")
    );
  });

  it("counts mastered due cards in reviewDue display stats", () => {
    const states = {
      "mastered-due": withReviewDue(
        createEmptyQuestionUserState("mastered-due"),
        {
          timesSeen: 5,
          timesCorrect: 5,
          consecutiveCorrect: 3,
          isMastered: true,
          lastSeenAt: daysAgoIso(20, now),
          lastCorrectAt: daysAgoIso(20, now),
          reviewDueAt: daysAgoIso(1, now),
        }
      ),
    };

    expect(getQuestionDisplayStats(states).reviewDue).toBe(1);
  });
});
