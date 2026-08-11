import {
  buildQuestionSession,
  createEmptyQuestionUserState,
  getQuestionCountForMode,
  getTopicMistakeProgress,
  getTrainerModeStats,
  isQuestionUnresolvedWrong,
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
  input: {
    primaryTopicId: LocalQuestion["primaryTopicId"];
    topicBlock?: LocalQuestion["topicBlock"];
    topicIds?: LocalQuestion["topicIds"];
  }
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
    topicBlock: input.topicBlock ?? "signs",
    primaryTopicId: input.primaryTopicId,
    topicIds: input.topicIds ?? (input.primaryTopicId ? [input.primaryTopicId] : []),
    difficultySeed: 50,
  };
}

function unresolvedWrong(questionId: string): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen: 2,
    timesWrong: 1,
    timesCorrect: 0,
    consecutiveCorrect: 0,
    lastSeenAt: "2026-08-01T12:00:00.000Z",
    lastWrongAt: "2026-08-01T12:00:00.000Z",
  };
}

describe("mistakes session edge cases", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("warn-1", {
        primaryTopicId: "warning_signs",
        topicIds: ["warning_signs"],
        topicBlock: "signs",
      }),
      makeQuestion("warn-2", {
        primaryTopicId: "warning_signs",
        topicIds: ["warning_signs", "prohibition_and_mandatory_signs"],
        topicBlock: "signs",
      }),
      // Legacy block id matches a catalog topic id, but catalog membership differs.
      makeQuestion("legacy-overtake-block", {
        primaryTopicId: "warning_signs",
        topicIds: ["warning_signs"],
        topicBlock: "overtaking",
      }),
      makeQuestion("catalog-overtake", {
        primaryTopicId: "overtaking",
        topicIds: ["overtaking"],
        topicBlock: "safety",
      }),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("queues global wrongs for catalog-topic wrong_answers even with empty overlay", () => {
    const states = {
      "warn-1": unresolvedWrong("warn-1"),
    };
    // Empty topic overlay — typical after exam / random practice.
    const topicProgress = {};

    expect(getTopicMistakeProgress("warning_signs", states, topicProgress).wrong).toBe(
      1
    );

    const count = getQuestionCountForMode(
      {
        currentCategory: "B",
        mode: "wrong_answers",
        topic: "warning_signs",
      },
      states,
      topicProgress
    );
    expect(count).toBe(1);

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "wrong_answers",
        sessionKey: "mistakes-warn",
        topic: "warning_signs",
      },
      states,
      new Date("2026-08-08T12:00:00.000Z"),
      topicProgress
    );

    expect(session.emptyReason).toBeNull();
    expect(session.questionIds).toEqual(["warn-1"]);

    expect(
      getTrainerModeStats(states, "warning_signs", topicProgress).wrongAnswers
    ).toBe(1);
  });

  it("does not zero wrong_answers when overlay has timesWrong: 0 for the same question", () => {
    const states = {
      "warn-1": unresolvedWrong("warn-1"),
    };
    const topicProgress = {
      warning_signs: {
        "warn-1": {
          timesSeen: 1,
          timesCorrect: 1,
          timesWrong: 0,
          lastCorrectAt: "2026-08-02T12:00:00.000Z",
          lastWrongAt: null,
        },
      },
    };

    // Monitor still uses global unresolved wrong.
    expect(getTopicMistakeProgress("warning_signs", states, topicProgress).wrong).toBe(
      1
    );

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "wrong_answers",
        sessionKey: "mistakes-overlay-conflict",
        topic: "warning_signs",
      },
      states,
      new Date("2026-08-08T12:00:00.000Z"),
      topicProgress
    );

    expect(session.questionIds).toEqual(["warn-1"]);
  });

  it("excludes legacy topicBlock-only matches from dual-id catalog topics", () => {
    const states = {
      "legacy-overtake-block": unresolvedWrong("legacy-overtake-block"),
      "catalog-overtake": unresolvedWrong("catalog-overtake"),
    };

    // "overtaking" is both a block and a catalog id — catalog membership wins.
    expect(getTopicMistakeProgress("overtaking", states).wrong).toBe(1);

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "wrong_answers",
        sessionKey: "mistakes-dual-id",
        topic: "overtaking",
      },
      states,
      new Date("2026-08-08T12:00:00.000Z"),
      {}
    );

    expect(session.questionIds).toEqual(["catalog-overtake"]);
    expect(session.questionIds).not.toContain("legacy-overtake-block");
  });

  it("includes multi-topic questions under each catalog membership", () => {
    const states = {
      "warn-2": unresolvedWrong("warn-2"),
    };

    expect(getTopicMistakeProgress("warning_signs", states).wrong).toBe(1);
    expect(
      getTopicMistakeProgress("prohibition_and_mandatory_signs", states).wrong
    ).toBe(1);

    const secondarySession = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "wrong_answers",
        sessionKey: "mistakes-secondary",
        topic: "prohibition_and_mandatory_signs",
      },
      states,
      new Date("2026-08-08T12:00:00.000Z"),
      {}
    );

    expect(secondarySession.questionIds).toEqual(["warn-2"]);
  });

  it("treats equal wrong/correct timestamps as still unresolved", () => {
    const tied: QuestionUserState = {
      ...createEmptyQuestionUserState("tied"),
      timesSeen: 2,
      timesWrong: 1,
      timesCorrect: 1,
      consecutiveCorrect: 1,
      lastWrongAt: "2026-08-01T12:00:00.000Z",
      lastCorrectAt: "2026-08-01T12:00:00.000Z",
    };

    expect(isQuestionUnresolvedWrong(tied)).toBe(true);
  });

  it("treats missing lastWrongAt as unresolved only when wrongs dominate corrects", () => {
    const moreWrongs: QuestionUserState = {
      ...createEmptyQuestionUserState("a"),
      timesWrong: 2,
      timesCorrect: 1,
      lastWrongAt: null,
      lastCorrectAt: "2026-08-01T12:00:00.000Z",
    };
    const moreCorrects: QuestionUserState = {
      ...createEmptyQuestionUserState("b"),
      timesWrong: 1,
      timesCorrect: 2,
      lastWrongAt: null,
      lastCorrectAt: "2026-08-01T12:00:00.000Z",
    };

    expect(isQuestionUnresolvedWrong(moreWrongs)).toBe(true);
    expect(isQuestionUnresolvedWrong(moreCorrects)).toBe(false);
  });
});
