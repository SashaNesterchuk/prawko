import {
  buildExamTopicStats,
  getWeakestTopic,
} from "../../exam/exam-result-stats";
import {
  buildTrainingTopicStats,
  getWeakestTrainingTopic,
} from "../training/training-result-stats";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type { LocalQuestion, QuestionSession } from "../types";
import type { RemoteExamSnapshot } from "../../exam/types";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  primaryTopicId: NonNullable<LocalQuestion["primaryTopicId"]>,
  topicBlock: LocalQuestion["topicBlock"]
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
    topicBlock,
    primaryTopicId,
    topicIds: [primaryTopicId],
    difficultySeed: 40,
  };
}

describe("result topic stats use catalog primaryTopicId", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("a1", "warning_signs", "signs"),
      makeQuestion("a2", "warning_signs", "signs"),
      makeQuestion("b1", "overtaking", "safety"),
      makeQuestion("c1", "external_lighting", "technical"),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("buckets training session stats by catalog topic, not topicBlock", () => {
    const session: QuestionSession = {
      id: "session-1",
      request: {
        currentCategory: "B",
        mode: "random",
        sessionKey: "test",
      },
      questionIds: ["a1", "a2", "b1", "c1"],
      currentIndex: 3,
      answers: {
        a1: {
          questionId: "a1",
          selectedAnswer: "A",
          isCorrect: true,
          answeredAt: "2026-08-08T10:00:00.000Z",
        },
        a2: {
          questionId: "a2",
          selectedAnswer: "B",
          isCorrect: false,
          answeredAt: "2026-08-08T10:01:00.000Z",
        },
        b1: {
          questionId: "b1",
          selectedAnswer: "B",
          isCorrect: false,
          answeredAt: "2026-08-08T10:02:00.000Z",
        },
        c1: {
          questionId: "c1",
          selectedAnswer: "A",
          isCorrect: true,
          answeredAt: "2026-08-08T10:03:00.000Z",
        },
      },
      createdAt: "2026-08-08T10:00:00.000Z",
      finishedAt: "2026-08-08T10:04:00.000Z",
      emptyReason: null,
    };

    const stats = buildTrainingTopicStats(session);

    expect(stats.map((row) => row.topicId)).toEqual([
      "warning_signs",
      "overtaking",
      "external_lighting",
    ]);
    expect(stats.find((row) => row.topicId === "warning_signs")).toMatchObject({
      correctCount: 1,
      totalCount: 2,
      percent: 50,
    });
    expect(stats.some((row) => (row as { topicBlock?: string }).topicBlock)).toBe(
      false
    );
    expect(getWeakestTrainingTopic(stats)).toBe("overtaking");
  });

  it("buckets exam result stats by catalog topic", () => {
    const snapshot = {
      answers: [
        {
          answerGiven: "A",
          answeredAt: "2026-08-08T10:00:00.000Z",
          isCorrect: true,
          order: 1,
          pointsAwarded: 1,
          questionAttemptId: null,
          questionId: "a1",
          questionSourceId: "a1",
        },
        {
          answerGiven: "B",
          answeredAt: "2026-08-08T10:01:00.000Z",
          isCorrect: false,
          order: 2,
          pointsAwarded: 0,
          questionAttemptId: null,
          questionId: "b1",
          questionSourceId: "b1",
        },
        {
          answerGiven: "A",
          answeredAt: "2026-08-08T10:02:00.000Z",
          isCorrect: true,
          order: 3,
          pointsAwarded: 1,
          questionAttemptId: null,
          questionId: "c1",
          questionSourceId: "c1",
        },
      ],
      questions: [
        {
          order: 1,
          points: 1,
          questionId: "a1",
          questionSourceId: "a1",
          scope: "base",
        },
        {
          order: 2,
          points: 1,
          questionId: "b1",
          questionSourceId: "b1",
          scope: "base",
        },
        {
          order: 3,
          points: 1,
          questionId: "c1",
          questionSourceId: "c1",
          scope: "base",
        },
      ],
      session: {} as RemoteExamSnapshot["session"],
    } satisfies RemoteExamSnapshot;

    const stats = buildExamTopicStats(snapshot);

    expect(stats.map((row) => row.topicId).sort()).toEqual([
      "external_lighting",
      "overtaking",
      "warning_signs",
    ].sort());
    expect(getWeakestTopic(stats)).toBe("overtaking");
  });
});
