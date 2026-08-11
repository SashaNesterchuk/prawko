import {
  createEmptyQuestionUserState,
  getTopicProgress,
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
  primaryTopicId: NonNullable<LocalQuestion["primaryTopicId"]>
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
    primaryTopicId,
    topicIds: [primaryTopicId],
    difficultySeed: 40,
  };
}

function seenCorrect(questionId: string): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen: 2,
    timesCorrect: 1,
    timesWrong: 0,
    consecutiveCorrect: 1,
    lastSeenAt: "2026-08-01T12:00:00.000Z",
    lastCorrectAt: "2026-08-01T12:00:00.000Z",
  };
}

describe("getTopicProgress catalog overlay", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("warn-1", "warning_signs"),
      makeQuestion("warn-2", "warning_signs"),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("ignores global user state for catalog topics without topic overlay", () => {
    const userStates = {
      "warn-1": seenCorrect("warn-1"),
      "warn-2": seenCorrect("warn-2"),
    };

    const progress = getTopicProgress("warning_signs", userStates);

    expect(progress).toMatchObject({
      total: 2,
      seen: 0,
      correct: 0,
      progress: 0,
    });
  });

  it("uses topicQuestionProgress overlay for catalog topic readiness", () => {
    const userStates = {
      "warn-1": seenCorrect("warn-1"),
      "warn-2": seenCorrect("warn-2"),
    };
    const topicProgress = {
      warning_signs: {
        "warn-1": {
          timesSeen: 1,
          timesCorrect: 1,
          timesWrong: 0,
          lastCorrectAt: "2026-08-01T12:00:00.000Z",
          lastWrongAt: null,
        },
      },
    };

    const progress = getTopicProgress(
      "warning_signs",
      userStates,
      topicProgress
    );

    expect(progress).toMatchObject({
      total: 2,
      seen: 1,
      correct: 1,
      progress: 50,
    });
  });
});
