import type { QuestionSession } from "../../types";
import {
  buildDiagnosticTopicStats,
  getDiagnosticStartLabel,
  getDiagnosticStrongArea,
  getDiagnosticWeakAreas,
} from "../result-stats";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../../question-bank";
import type { LocalQuestion } from "../../types";

const txt = { pl: "q", ua: "q", en: "q", de: "q" };

function makeQuestion(
  id: string,
  primaryTopicId: LocalQuestion["primaryTopicId"]
): LocalQuestion {
  return {
    id,
    sourceRowNumber: 1,
    prompt: txt,
    explanation: txt,
    answerType: "boolean",
    correctAnswer: "true",
    points: 1,
    scope: "base",
    topicBlock: "signs",
    primaryTopicId,
    topicIds: primaryTopicId ? [primaryTopicId] : [],
    difficultySeed: 1,
  };
}

function makeSession(answers: Record<string, boolean>): QuestionSession {
  const questionIds = Object.keys(answers);

  return {
    id: "session-diagnostic",
    request: {
      currentCategory: "B",
      mode: "initial_diagnostic",
      questionLimit: 10,
      sessionKey: "B:initial_diagnostic",
    },
    questionIds,
    currentIndex: questionIds.length - 1,
    answers: Object.fromEntries(
      questionIds.map((questionId) => [
        questionId,
        {
          questionId,
          selectedAnswer: "true" as const,
          isCorrect: answers[questionId]!,
          answeredAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    ),
    createdAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:10:00.000Z",
    emptyReason: null,
  };
}

describe("initial diagnostic result stats", () => {
  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("hides untested topics and keeps 0% only when the topic was asked", () => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("signs-1", "signs_signals"),
      makeQuestion("signs-2", "signs_signals"),
      makeQuestion("int-1", "intersections_priority"),
      makeQuestion("aid-1", "accidents_first_aid"),
    ]);

    const stats = buildDiagnosticTopicStats(
      makeSession({
        "signs-1": false,
        "signs-2": false,
        "int-1": true,
      })
    );

    expect(stats.map((stat) => stat.topicId).sort()).toEqual([
      "intersections_priority",
      "signs_signals",
    ]);
    expect(stats.find((stat) => stat.topicId === "signs_signals")).toMatchObject({
      percent: 0,
      totalCount: 2,
    });
    expect(stats.find((stat) => stat.topicId === "accidents_first_aid")).toBeUndefined();
  });

  it("picks up to two weak areas by wrong count then lower percent", () => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("a1", "signs_signals"),
      makeQuestion("a2", "signs_signals"),
      makeQuestion("b1", "intersections_priority"),
      makeQuestion("c1", "vehicle_equipment"),
    ]);

    const weak = getDiagnosticWeakAreas(
      buildDiagnosticTopicStats(
        makeSession({
          a1: false,
          a2: false,
          b1: false,
          c1: true,
        })
      )
    );

    expect(weak.map((stat) => stat.topicId)).toEqual([
      "signs_signals",
      "intersections_priority",
    ]);
  });

  it("shows a strongest area only when the leader is unambiguous", () => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("a1", "signs_signals"),
      makeQuestion("b1", "intersections_priority"),
      makeQuestion("c1", "vehicle_equipment"),
    ]);

    expect(
      getDiagnosticStrongArea(
        buildDiagnosticTopicStats(
          makeSession({
            a1: true,
            b1: false,
            c1: false,
          })
        )
      )?.topicId
    ).toBe("signs_signals");

    expect(
      getDiagnosticStrongArea(
        buildDiagnosticTopicStats(
          makeSession({
            a1: true,
            b1: true,
            c1: false,
          })
        )
      )
    ).toBeNull();
  });

  it("maps correct count to a starting-point label, not a score", () => {
    expect(getDiagnosticStartLabel(0, 10)).toBe("nowWeKnow");
    expect(getDiagnosticStartLabel(3, 10)).toBe("nowWeKnow");
    expect(getDiagnosticStartLabel(4, 10)).toBe("goodStartingPoint");
    expect(getDiagnosticStartLabel(6, 10)).toBe("goodStartingPoint");
    expect(getDiagnosticStartLabel(7, 10)).toBe("goodStart");
    expect(getDiagnosticStartLabel(8, 10)).toBe("goodStart");
    expect(getDiagnosticStartLabel(9, 10)).toBe("strongStart");
    expect(getDiagnosticStartLabel(10, 10)).toBe("strongStart");
  });
});
