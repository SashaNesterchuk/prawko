import {
  createEmptyQuestionUserState,
  getOverallMistakesStats,
  getQuestionPrimaryTopicId,
  getTopicMistakeProgress,
  isQuestionUnresolvedWrong,
} from "../question-engine";
import { listCatalogTopicsWithMistakes } from "../mistakes-topics";
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

function fixedAfterWrong(questionId: string): QuestionUserState {
  return {
    ...createEmptyQuestionUserState(questionId),
    timesSeen: 3,
    timesWrong: 1,
    timesCorrect: 1,
    consecutiveCorrect: 1,
    lastSeenAt: "2026-08-02T12:00:00.000Z",
    lastWrongAt: "2026-08-01T12:00:00.000Z",
    lastCorrectAt: "2026-08-02T12:00:00.000Z",
  };
}

describe("catalog mistakes monitor", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("warn-1", {
        primaryTopicId: "road_markings_and_warning_signs",
        topicIds: ["road_markings_and_warning_signs"],
        topicBlock: "signs",
      }),
      makeQuestion("warn-2", {
        primaryTopicId: "road_markings_and_warning_signs",
        topicIds: ["road_markings_and_warning_signs"],
        topicBlock: "signs",
      }),
      makeQuestion("overtake-1", {
        primaryTopicId: "overtaking_and_maneuvers",
        topicIds: ["overtaking_and_maneuvers"],
        // Deliberately different legacy block than catalog topic.
        topicBlock: "safety",
      }),
      makeQuestion("priority-1", {
        primaryTopicId: "right_of_way_and_intersections",
        topicIds: ["right_of_way_and_intersections"],
        topicBlock: "priority",
      }),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("resolves primary catalog topic even when topicBlock differs", () => {
    const question = makeQuestion("x", {
      primaryTopicId: "overtaking_and_maneuvers",
      topicIds: ["overtaking_and_maneuvers"],
      topicBlock: "safety",
    });

    expect(getQuestionPrimaryTopicId(question)).toBe("overtaking_and_maneuvers");
  });

  it("counts only unresolved wrongs overall and per catalog topic", () => {
    const states = {
      "warn-1": unresolvedWrong("warn-1"),
      "warn-2": fixedAfterWrong("warn-2"),
      "overtake-1": unresolvedWrong("overtake-1"),
      "priority-1": createEmptyQuestionUserState("priority-1"),
    };

    expect(isQuestionUnresolvedWrong(states["warn-1"])).toBe(true);
    expect(isQuestionUnresolvedWrong(states["warn-2"])).toBe(false);

    const overall = getOverallMistakesStats(states);
    expect(overall.wrong).toBe(2);
    expect(overall.total).toBe(4);

    expect(
      getTopicMistakeProgress("road_markings_and_warning_signs", states).wrong
    ).toBe(1);
    expect(getTopicMistakeProgress("overtaking_and_maneuvers", states).wrong).toBe(
      1
    );
    expect(
      getTopicMistakeProgress(
        "right_of_way_and_intersections",
        states
      ).wrong
    ).toBe(0);

    // Monitor rows come from catalog ids only (see listCatalogTopicsWithMistakes).
    expect(
      listCatalogTopicsWithMistakes(states).some((row) => row.topicId === "safety")
    ).toBe(false);
  });

  it("lists catalog topics with mistakes sorted by wrong count", () => {
    const states = {
      "warn-1": unresolvedWrong("warn-1"),
      "warn-2": unresolvedWrong("warn-2"),
      "overtake-1": unresolvedWrong("overtake-1"),
      "priority-1": createEmptyQuestionUserState("priority-1"),
    };

    const rows = listCatalogTopicsWithMistakes(states);

    expect(rows.map((row) => row.topicId)).toEqual([
      "road_markings_and_warning_signs",
      "overtaking_and_maneuvers",
    ]);
    expect(rows[0]?.progress.wrong).toBe(2);
    expect(rows[1]?.progress.wrong).toBe(1);
    expect(rows.every((row) => row.topicId !== "safety")).toBe(true);
  });

  it("drops topics once wrongs are fixed by a newer correct answer", () => {
    const states = {
      "warn-1": fixedAfterWrong("warn-1"),
      "warn-2": fixedAfterWrong("warn-2"),
      "overtake-1": fixedAfterWrong("overtake-1"),
      "priority-1": createEmptyQuestionUserState("priority-1"),
    };

    expect(getOverallMistakesStats(states).wrong).toBe(0);
    expect(listCatalogTopicsWithMistakes(states)).toEqual([]);
  });

  it("matches catalog memberships instead of unrelated legacy blocks", () => {
    const states = {
      "overtake-1": unresolvedWrong("overtake-1"),
    };

    expect(
      getTopicMistakeProgress("overtaking_and_maneuvers", states)
    ).toMatchObject({
      wrong: 1,
      total: 1,
    });
    expect(listCatalogTopicsWithMistakes(states).map((row) => row.topicId)).toEqual([
      "overtaking_and_maneuvers",
    ]);
  });
});
