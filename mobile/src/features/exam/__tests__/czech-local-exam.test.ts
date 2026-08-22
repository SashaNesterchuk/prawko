jest.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        memory.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        memory.delete(key);
      }),
      multiSet: jest.fn(async (entries: [string, string][]) => {
        for (const [key, value] of entries) {
          memory.set(key, value);
        }
      }),
      clear: jest.fn(async () => {
        memory.clear();
      }),
    },
  };
});

import { CZECH_EXAM_BASKETS, CZECH_EXAM_PROFILE } from "../exam-profile";
import {
  finishLocalExamSession,
  resetLocalExamSessionsForTests,
  setLocalExamCurrentIndex,
  startLocalExamSession,
  submitLocalExamAnswer,
  toggleLocalExamFlag,
} from "../local-exam";
import { resetExamSnapshotCacheForTests } from "../exam-snapshot-cache";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../../questions/question-bank";
import type { LocalQuestion } from "../../questions/types";
import { useQuestionProgressStore } from "../../../state/question-progress";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  examBasketId: number,
  points: number
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
    points,
    scope: "base",
    topicBlock: "signs",
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
    difficultySeed: 1,
    examBasketId,
  };
}

function startCzechExam() {
  return startLocalExamSession({
    category: "B",
    locale: "cs",
    mode: "exam",
    profile: CZECH_EXAM_PROFILE,
  });
}

describe("czech local exam free navigation", () => {
  beforeEach(async () => {
    const questions = CZECH_EXAM_BASKETS.flatMap((basket) =>
      Array.from({ length: basket.count + 2 }, (_, index) =>
        makeQuestion(
          `cz-${basket.scopeId}-${index}`,
          basket.scopeId,
          basket.points
        )
      )
    );
    hydrateQuestionBankFromLocalQuestions(questions);
    useQuestionProgressStore.getState().resetProgress();
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();
  });

  afterEach(async () => {
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();
    useQuestionProgressStore.getState().resetProgress();
    resetQuestionBankToMock();
  });

  it("starts a 25-question 50-point session with a 43-point pass mark", () => {
    const snapshot = startCzechExam();

    expect(snapshot.session.totalQuestionsTarget).toBe(25);
    expect(snapshot.session.totalPointsTarget).toBe(50);
    expect(snapshot.session.passPoints).toBe(43);
    expect(snapshot.session.metadata.navigation).toBe("free");
    expect(snapshot.session.currentQuestionIndex).toBe(1);
  });

  it("saves an answer without advancing", () => {
    const started = startCzechExam();
    const answered = submitLocalExamAnswer({
      answerGiven: "A",
      locale: "cs",
      sessionId: started.session.id,
    });

    expect(answered.session.currentQuestionIndex).toBe(1);
    expect(answered.session.status).toBe("active");
    expect(answered.session.totalQuestionsAnswered).toBe(1);
    expect(answered.answers).toHaveLength(1);
  });

  it("lets the learner jump back and change an answer", () => {
    const started = startCzechExam();
    submitLocalExamAnswer({
      answerGiven: "B",
      locale: "cs",
      sessionId: started.session.id,
    });
    setLocalExamCurrentIndex({
      questionOrder: 2,
      sessionId: started.session.id,
    });
    submitLocalExamAnswer({
      answerGiven: "A",
      locale: "cs",
      questionOrder: 2,
      sessionId: started.session.id,
    });
    setLocalExamCurrentIndex({
      questionOrder: 1,
      sessionId: started.session.id,
    });
    const changed = submitLocalExamAnswer({
      answerGiven: "A",
      locale: "cs",
      questionOrder: 1,
      sessionId: started.session.id,
    });

    expect(changed.session.currentQuestionIndex).toBe(1);
    expect(changed.answers).toHaveLength(2);
    expect(changed.answers.find((answer) => answer.order === 1)?.isCorrect).toBe(
      true
    );
    expect(changed.session.status).toBe("active");
  });

  it("flags a question to return later", () => {
    const started = startCzechExam();
    const flagged = toggleLocalExamFlag({
      questionOrder: 1,
      sessionId: started.session.id,
    });
    const unflagged = toggleLocalExamFlag({
      questionOrder: 1,
      sessionId: started.session.id,
    });

    expect(flagged.session.metadata.flaggedOrders).toEqual([1]);
    expect(unflagged.session.metadata.flaggedOrders).toEqual([]);
  });

  it("finishes with unanswered questions scoring zero", () => {
    const started = startCzechExam();
    submitLocalExamAnswer({
      answerGiven: "A",
      locale: "cs",
      sessionId: started.session.id,
    });
    const finished = finishLocalExamSession({ sessionId: started.session.id });

    expect(finished.session.status).toBe("completed");
    expect(finished.session.totalQuestionsAnswered).toBe(1);
    expect(finished.session.passed).toBe(false);
  });

  it("passes at 46 after one 4-point miss and fails at 42 after two", () => {
    const started = startCzechExam();
    const fourPointOrders = started.questions
      .filter((question) => question.points === 4)
      .map((question) => question.order);

    expect(fourPointOrders).toHaveLength(3);

    for (const question of started.questions) {
      const missFirstTwo =
        question.order === fourPointOrders[0] ||
        question.order === fourPointOrders[1];
      submitLocalExamAnswer({
        answerGiven: missFirstTwo ? "B" : "A",
        locale: "cs",
        questionOrder: question.order,
        sessionId: started.session.id,
      });
    }

    const failed = finishLocalExamSession({ sessionId: started.session.id });
    expect(failed.session.scorePoints).toBe(42);
    expect(failed.session.passed).toBe(false);

    const retry = startLocalExamSession({
      category: "B",
      locale: "cs",
      mode: "exam",
      profile: CZECH_EXAM_PROFILE,
      replaceExisting: true,
    });
    const missOne = retry.questions.find((question) => question.points === 4)!;
    for (const question of retry.questions) {
      submitLocalExamAnswer({
        answerGiven: question.order === missOne.order ? "B" : "A",
        locale: "cs",
        questionOrder: question.order,
        sessionId: retry.session.id,
      });
    }
    const passed = finishLocalExamSession({ sessionId: retry.session.id });
    expect(passed.session.scorePoints).toBe(46);
    expect(passed.session.passed).toBe(true);
  });
});
