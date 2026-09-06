import { hydrateQuestionBankFromLocalQuestions, resetQuestionBankToMock } from "../../question-bank";
import type { LocalQuestion, QuestionUserStateMap } from "../../types";
import { INITIAL_DIAGNOSTIC_QUESTION_COUNT } from "../mix";
import { getInitialDiagnosticQuestionIds } from "../selection";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  options: {
    mediaKey?: string;
    mediaType?: "image" | "video";
    primaryTopicId?: LocalQuestion["primaryTopicId"];
    scope?: LocalQuestion["scope"];
    topicBlock?: LocalQuestion["topicBlock"];
    timesSeen?: number;
  } = {}
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
    scope: options.scope ?? "base",
    topicBlock: options.topicBlock ?? "signs",
    primaryTopicId: options.primaryTopicId ?? "signs_signals",
    topicIds: [options.primaryTopicId ?? "signs_signals"],
    difficultySeed: 1,
    media: options.mediaType
      ? {
          type: options.mediaType,
          asset: {
            mediaKey: options.mediaKey ?? `${id}-media`,
            sourceKind: "primary",
            mediaType: options.mediaType,
            originalFilename: `${id}.mp4`,
            resolvedFilename: `${id}.mp4`,
            matchStrategy: "exact",
            storageBucket: "question-videos",
            storagePath: `${id}.mp4`,
            posterStorageBucket: null,
            posterStoragePath: null,
          },
        }
      : null,
  };
}

function bankForMix() {
  return [
    makeQuestion("signs-1", { primaryTopicId: "signs_signals" }),
    makeQuestion("signs-2", { primaryTopicId: "signs_signals" }),
    makeQuestion("signs-3", { primaryTopicId: "signs_signals" }),
    makeQuestion("int-1", {
      primaryTopicId: "intersections_priority",
      topicBlock: "intersections",
    }),
    makeQuestion("int-2", {
      primaryTopicId: "intersections_priority",
      topicBlock: "intersections",
    }),
    makeQuestion("man-1", {
      primaryTopicId: "driving_maneuvers",
      topicBlock: "overtaking",
    }),
    makeQuestion("users-1", {
      primaryTopicId: "other_road_users",
      topicBlock: "pedestrians",
    }),
    makeQuestion("aid-1", {
      primaryTopicId: "accidents_first_aid",
      topicBlock: "first_aid",
    }),
    makeQuestion("vehicle-1", {
      primaryTopicId: "vehicle_equipment",
      topicBlock: "technical",
    }),
    makeQuestion("transport-1", {
      primaryTopicId: "transport",
      topicBlock: "safety",
    }),
    makeQuestion("docs-1", {
      primaryTopicId: "documents_responsibility",
      topicBlock: "safety",
    }),
    makeQuestion("video-1", {
      primaryTopicId: "attention_risks",
      topicBlock: "safety",
      mediaType: "video",
      mediaKey: "scene-a",
    }),
    makeQuestion("video-dup", {
      primaryTopicId: "attention_risks",
      topicBlock: "safety",
      mediaType: "video",
      mediaKey: "scene-a",
    }),
  ];
}

describe("initial diagnostic selection", () => {
  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("returns 10 unique ids and includes a media situation when available", () => {
    hydrateQuestionBankFromLocalQuestions(bankForMix());

    const ids = getInitialDiagnosticQuestionIds({
      countryCode: "PL",
      userStates: {},
    });

    expect(ids).toHaveLength(INITIAL_DIAGNOSTIC_QUESTION_COUNT);
    expect(new Set(ids).size).toBe(INITIAL_DIAGNOSTIC_QUESTION_COUNT);
    expect(ids.some((id) => id === "video-1" || id === "video-dup")).toBe(true);
  });

  it("does not pick both questions that share a media key when an alternative exists", () => {
    hydrateQuestionBankFromLocalQuestions(bankForMix());
    const ids = getInitialDiagnosticQuestionIds({
      countryCode: "PL",
      userStates: {},
    });

    expect(ids.includes("video-1") && ids.includes("video-dup")).toBe(false);
  });

  it("prefers unseen base questions", () => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("seen-sign-a", { primaryTopicId: "signs_signals" }),
      makeQuestion("seen-sign-b", { primaryTopicId: "signs_signals" }),
      makeQuestion("fresh-sign", { primaryTopicId: "signs_signals" }),
      ...bankForMix().filter((question) => question.primaryTopicId !== "signs_signals"),
    ]);

    const userStates: QuestionUserStateMap = {
      "seen-sign-a": {
        questionId: "seen-sign-a",
        timesSeen: 4,
        timesCorrect: 1,
        timesWrong: 3,
        consecutiveCorrect: 0,
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        lastCorrectAt: null,
        lastWrongAt: "2026-01-01T00:00:00.000Z",
        reviewDueAt: null,
        masteryScore: 0,
        isHard: false,
        isBookmarked: false,
        isMastered: false,
      },
      "seen-sign-b": {
        questionId: "seen-sign-b",
        timesSeen: 4,
        timesCorrect: 1,
        timesWrong: 3,
        consecutiveCorrect: 0,
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        lastCorrectAt: null,
        lastWrongAt: "2026-01-01T00:00:00.000Z",
        reviewDueAt: null,
        masteryScore: 0,
        isHard: false,
        isBookmarked: false,
        isMastered: false,
      },
    };

    const ids = getInitialDiagnosticQuestionIds({
      countryCode: "PL",
      userStates,
    });

    expect(ids).toContain("fresh-sign");
  });

  it("still returns 10 questions when a preferred Czech topic is missing", () => {
    hydrateQuestionBankFromLocalQuestions(
      bankForMix().filter((question) => question.primaryTopicId !== "transport")
    );

    const ids = getInitialDiagnosticQuestionIds({
      countryCode: "CZ",
      userStates: {},
    });

    expect(ids).toHaveLength(INITIAL_DIAGNOSTIC_QUESTION_COUNT);
    expect(ids).toContain("docs-1");
  });
});
