import {
  buildReadinessAssessmentResult,
  READINESS_ASSESSMENT_QUESTION_COUNT,
  isReadinessAssessmentSession,
} from "../readiness-assessment";
import type { QuestionSession } from "../types";

function makeSession(
  overrides: Partial<Omit<QuestionSession, "request">> & {
    request?: Partial<QuestionSession["request"]>;
  } = {}
): QuestionSession {
  const { request: requestOverrides, ...rest } = overrides;

  return {
    id: "session-test",
    request: {
      currentCategory: "B",
      mode: "mini_test",
      questionLimit: READINESS_ASSESSMENT_QUESTION_COUNT,
      sessionKey: "B:mini_test",
      ...requestOverrides,
    },
    questionIds: ["q1", "q2", "q3"],
    currentIndex: 2,
    answers: {
      q1: {
        questionId: "q1",
        selectedAnswer: "A",
        isCorrect: true,
        answeredAt: "2026-01-01T00:00:00.000Z",
      },
      q2: {
        questionId: "q2",
        selectedAnswer: "B",
        isCorrect: false,
        answeredAt: "2026-01-01T00:01:00.000Z",
      },
      q3: {
        questionId: "q3",
        selectedAnswer: "A",
        isCorrect: true,
        answeredAt: "2026-01-01T00:02:00.000Z",
      },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:03:00.000Z",
    emptyReason: null,
    ...rest,
  };
}

describe("readiness-assessment", () => {
  it("treats a 10-question mini_test as the readiness assessment", () => {
    expect(
      isReadinessAssessmentSession(
        makeSession({
          request: { questionLimit: READINESS_ASSESSMENT_QUESTION_COUNT },
        })
      )
    ).toBe(true);
    expect(
      isReadinessAssessmentSession(
        makeSession({ request: { mode: "learning", questionLimit: 10 } })
      )
    ).toBe(false);
    expect(
      isReadinessAssessmentSession(
        makeSession({ request: { questionLimit: 12 } })
      )
    ).toBe(false);
    expect(
      isReadinessAssessmentSession(
        makeSession({ request: { questionLimit: 30 } })
      )
    ).toBe(false);
  });

  it("builds a persisted assessment score from a finished session", () => {
    const result = buildReadinessAssessmentResult(makeSession());

    expect(result).toEqual({
      completedAt: "2026-01-01T00:03:00.000Z",
      correct: 2,
      scorePercent: 67,
      sessionId: "session-test",
      total: 3,
    });
  });
});
