jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    multiSet: jest.fn(async () => undefined),
  },
}));

import { useQuestionProgressStore } from "../../../state/question-progress";
import {
  canResumeQuestionSession,
  resumeQuestionSession,
} from "../question-engine";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type {
  LocalQuestion,
  QuestionSession,
  QuestionSessionRequest,
} from "../types";

const baseRequest: QuestionSessionRequest = {
  currentCategory: "B",
  mode: "learning",
  questionLimit: 20,
  sessionKey: "session-a",
};

function makeSession(
  overrides: Partial<QuestionSession> & {
    request?: Partial<QuestionSessionRequest>;
    answers?: QuestionSession["answers"];
  } = {}
): QuestionSession {
  const { request, answers, ...rest } = overrides;

  return {
    id: "session-test",
    request: {
      ...baseRequest,
      ...request,
    },
    questionIds: ["q1", "q2", "q3"],
    currentIndex: 0,
    answers: answers ?? {},
    createdAt: "2026-08-15T12:00:00.000Z",
    finishedAt: null,
    emptyReason: null,
    ...rest,
  };
}

const answeredFirstWrong: QuestionSession["answers"] = {
  q1: {
    questionId: "q1",
    selectedAnswer: "B",
    isCorrect: false,
    answeredAt: "2026-08-15T12:01:00.000Z",
  },
};

describe("question session resume", () => {
  it("resumes the same mode at the first unanswered question", () => {
    const session = makeSession({
      currentIndex: 0,
      answers: answeredFirstWrong,
    });
    const nextRequest = {
      ...baseRequest,
      sessionKey: "session-b",
    };

    expect(canResumeQuestionSession(session, nextRequest)).toBe(true);

    const resumed = resumeQuestionSession(session, nextRequest);

    expect(resumed.currentIndex).toBe(1);
    expect(resumed.answers.q1?.isCorrect).toBe(false);
    expect(resumed.request.sessionKey).toBe("session-b");
    expect(resumed.questionIds).toEqual(session.questionIds);
  });

  it("does not resume a session with no answers", () => {
    const nextRequest = {
      ...baseRequest,
      sessionKey: "session-b",
    };

    expect(
      canResumeQuestionSession(makeSession({ answers: {} }), nextRequest)
    ).toBe(false);
  });

  it("does not resume a finished session", () => {
    const session = makeSession({
      answers: answeredFirstWrong,
      finishedAt: "2026-08-15T12:02:00.000Z",
    });

    expect(
      canResumeQuestionSession(session, {
        ...baseRequest,
        sessionKey: "session-b",
      })
    ).toBe(false);
  });

  it("does not resume when the question limit changed", () => {
    const session = makeSession({ answers: answeredFirstWrong });

    expect(
      canResumeQuestionSession(session, {
        ...baseRequest,
        questionLimit: 10,
        sessionKey: "session-b",
      })
    ).toBe(false);
  });

  it("does not resume when the blitz duration changed", () => {
    const session = makeSession({
      answers: answeredFirstWrong,
      request: { timeLimitSeconds: 300 },
    });

    expect(
      canResumeQuestionSession(session, {
        ...baseRequest,
        timeLimitSeconds: 600,
        sessionKey: "session-b",
      })
    ).toBe(false);
  });
});

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
    difficultySeed: 1,
  };
}

describe("startOrResumeSession after exit", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("q1"),
      makeQuestion("q2"),
      makeQuestion("q3"),
    ]);
    useQuestionProgressStore.getState().resetProgress();
  });

  afterEach(() => {
    useQuestionProgressStore.getState().resetProgress();
    resetQuestionBankToMock();
  });

  it("resumes at Q2 with Q1 marked wrong if the abandoned session was kept", () => {
    const store = useQuestionProgressStore.getState();
    store.startOrResumeSession({
      ...baseRequest,
      questionLimit: 3,
      sessionKey: "session-a",
    });
    store.answerCurrentQuestion("B");

    const resumed = store.startOrResumeSession({
      ...baseRequest,
      questionLimit: 3,
      sessionKey: "session-b",
    });

    expect(resumed.currentIndex).toBe(1);
    expect(resumed.answers[resumed.questionIds[0]!]?.isCorrect).toBe(false);
  });

  it("starts at Q1 unanswered after the previous session was cleared", () => {
    const store = useQuestionProgressStore.getState();
    store.startOrResumeSession({
      ...baseRequest,
      questionLimit: 3,
      sessionKey: "session-a",
    });
    store.answerCurrentQuestion("B");
    store.clearActiveSession();

    const next = store.startOrResumeSession({
      ...baseRequest,
      questionLimit: 3,
      sessionKey: "session-b",
    });

    expect(next.currentIndex).toBe(0);
    expect(next.answers).toEqual({});
    expect(next.request.sessionKey).toBe("session-b");
  });
});
