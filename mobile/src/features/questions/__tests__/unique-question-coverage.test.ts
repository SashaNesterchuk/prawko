import {
  createEmptyQuestionUserState,
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

function makeQuestion(id: string): LocalQuestion {
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
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
    difficultySeed: 50,
  };
}

function seenCorrect(questionId: string, timesSeen = 1): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen,
    timesCorrect: timesSeen,
    timesWrong: 0,
    consecutiveCorrect: timesSeen,
    lastSeenAt: "2026-08-01T12:00:00.000Z",
    lastCorrectAt: "2026-08-01T12:00:00.000Z",
  };
}

function unresolvedWrong(questionId: string): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen: 2,
    timesCorrect: 0,
    timesWrong: 2,
    lastSeenAt: "2026-08-02T12:00:00.000Z",
    lastWrongAt: "2026-08-02T12:00:00.000Z",
  };
}

function fixedAfterWrong(questionId: string): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen: 3,
    timesCorrect: 1,
    timesWrong: 2,
    consecutiveCorrect: 1,
    lastSeenAt: "2026-08-03T12:00:00.000Z",
    lastWrongAt: "2026-08-02T12:00:00.000Z",
    lastCorrectAt: "2026-08-03T12:00:00.000Z",
  };
}

describe("unique question coverage", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("q1"),
      makeQuestion("q2"),
      makeQuestion("q3"),
      makeQuestion("q4"),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("counts each question once even after many attempts", () => {
    const stats = getQuestionDisplayStats({
      q1: seenCorrect("q1", 12),
    });

    expect(stats.total).toBe(4);
    expect(stats.seen).toBe(1);
    expect(stats.seenCorrect).toBe(1);
    expect(stats.seenWrong).toBe(0);
  });

  it("splits unique seen questions into current correct vs unresolved wrong", () => {
    const stats = getQuestionDisplayStats({
      q1: seenCorrect("q1"),
      q2: unresolvedWrong("q2"),
      q3: fixedAfterWrong("q3"),
    });

    expect(stats.seen).toBe(3);
    expect(stats.seenCorrect).toBe(2);
    expect(stats.seenWrong).toBe(1);
    expect(stats.seenCorrect + stats.seenWrong).toBe(stats.seen);
  });

  it("leaves unseen questions out of coverage", () => {
    const stats = getQuestionDisplayStats({});

    expect(stats.seen).toBe(0);
    expect(stats.seenCorrect).toBe(0);
    expect(stats.seenWrong).toBe(0);
    expect(stats.total).toBe(4);
  });
});
