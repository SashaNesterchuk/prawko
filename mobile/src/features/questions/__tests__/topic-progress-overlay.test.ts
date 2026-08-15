import {
  createEmptyQuestionUserState,
  getNextTopicQuestionProgressMapAfterAttempt,
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

describe("getTopicProgress training coverage", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("warn-1", "signs_signals"),
      makeQuestion("warn-2", "signs_signals"),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("requires attributed training coverage for catalog topics", () => {
    const userStates = {
      "warn-1": seenCorrect("warn-1"),
      "warn-2": seenCorrect("warn-2"),
    };

    const progress = getTopicProgress(
      "signs_signals",
      userStates
    );

    expect(progress).toMatchObject({
      total: 2,
      seen: 0,
      correct: 0,
      progress: 0,
    });
  });

  it("uses attributed training coverage for catalog topic readiness", () => {
    const userStates = {
      "warn-1": seenCorrect("warn-1"),
      "warn-2": seenCorrect("warn-2"),
    };
    const topicProgress = {
      signs_signals: {
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
      "signs_signals",
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

  it("attributes one training answer to every catalog topic on the question", () => {
    const progress = getNextTopicQuestionProgressMapAfterAttempt(
      {},
      ["signs_signals", "driving_maneuvers"],
      "shared-question",
      {
        answeredAt: "2026-08-12T12:00:00.000Z",
        isCorrect: true,
      }
    );

    expect(
      progress.signs_signals?.["shared-question"]
    ).toMatchObject({
      timesSeen: 1,
      timesCorrect: 1,
      timesWrong: 0,
    });
    expect(progress.driving_maneuvers?.["shared-question"]).toMatchObject({
      timesSeen: 1,
      timesCorrect: 1,
      timesWrong: 0,
    });
  });
});
