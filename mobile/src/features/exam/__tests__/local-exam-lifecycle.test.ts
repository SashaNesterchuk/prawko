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

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useQuestionProgressStore } from "../../../state/question-progress";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../../questions/question-bank";
import type { LocalQuestion } from "../../questions/types";
import {
  resetExamSnapshotCacheForTests,
  seedPersistedExamSnapshot,
  waitForExamSnapshotPersistForTests,
} from "../exam-snapshot-cache";
import {
  fetchLatestActiveLocalExamSession,
  fetchLocalExamSessionSnapshot,
  resetLocalExamSessionsForTests,
  setLocalExamSessionStatus,
  startLocalExamSession,
  submitLocalExamAnswer,
} from "../local-exam";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  scope: LocalQuestion["scope"] = "base"
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
    scope,
    topicBlock: "signs",
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
    difficultySeed: 1,
  };
}

function startMiniExam() {
  return startLocalExamSession({
    category: "B",
    locale: "ua",
    mode: "mini_test",
    requestedTotalQuestions: 3,
  });
}

describe("local exam session lifecycle", () => {
  beforeEach(async () => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("base-1"),
      makeQuestion("base-2"),
      makeQuestion("base-3"),
      makeQuestion("base-4"),
      makeQuestion("spec-1", "specialist"),
      makeQuestion("spec-2", "specialist"),
    ]);
    useQuestionProgressStore.getState().resetProgress();
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();
    await AsyncStorage.clear();
    useQuestionProgressStore.getState().resetProgress();
    resetQuestionBankToMock();
  });

  it("starts at question 1 with no answers", () => {
    const snapshot = startMiniExam();

    expect(snapshot.session.status).toBe("active");
    expect(snapshot.session.currentQuestionIndex).toBe(1);
    expect(snapshot.answers).toEqual([]);
    expect(snapshot.session.totalQuestionsTarget).toBe(3);
  });

  it("advances to question 2 after the first answer", () => {
    const started = startMiniExam();
    const firstQuestionId = started.questions[0]!.questionSourceId;
    const answered = submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: started.session.id,
    });

    expect(answered.session.currentQuestionIndex).toBe(2);
    expect(answered.session.totalQuestionsAnswered).toBe(1);
    expect(answered.answers[0]?.questionSourceId).toBe(firstQuestionId);
    expect(answered.session.status).toBe("active");
  });

  it("resumes the unanswered follow-up when the active session was kept", async () => {
    const started = startMiniExam();
    submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: started.session.id,
    });

    const resumed = await fetchLatestActiveLocalExamSession("mini_test");

    expect(resumed?.session.id).toBe(started.session.id);
    expect(resumed?.session.currentQuestionIndex).toBe(2);
    expect(resumed?.answers).toHaveLength(1);
  });

  it("starts a new exam at question 1 after the previous one was abandoned", async () => {
    const started = startMiniExam();
    submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: started.session.id,
    });
    setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "abandoned",
    });

    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();

    const next = startMiniExam();

    expect(next.session.id).not.toBe(started.session.id);
    expect(next.session.currentQuestionIndex).toBe(1);
    expect(next.answers).toEqual([]);
    expect(next.session.status).toBe("active");
  });

  it("starts a new exam after completing every question", async () => {
    const started = startMiniExam();
    let current = started;

    while (current.session.status === "active") {
      current = submitLocalExamAnswer({
        answerGiven: "A",
        locale: "ua",
        sessionId: started.session.id,
      });
    }

    expect(current.session.status).toBe("completed");
    expect(current.session.totalQuestionsAnswered).toBe(3);
    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();

    const next = startMiniExam();

    expect(next.session.id).not.toBe(started.session.id);
    expect(next.session.currentQuestionIndex).toBe(1);
    expect(next.answers).toEqual([]);
  });

  it("starts a new exam after the timer expires", async () => {
    const started = startMiniExam();
    submitLocalExamAnswer({
      answerGiven: "A",
      locale: "ua",
      sessionId: started.session.id,
    });
    setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "expired",
    });

    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();

    const next = startMiniExam();

    expect(next.session.id).not.toBe(started.session.id);
    expect(next.session.currentQuestionIndex).toBe(1);
  });

  it("throws when another active exam already exists", () => {
    startMiniExam();

    expect(() => startMiniExam()).toThrow("An active exam session already exists.");
  });

  it("replaceExisting abandons the old attempt and starts at question 1", async () => {
    const first = startMiniExam();
    submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: first.session.id,
    });

    const next = startLocalExamSession({
      category: "B",
      locale: "ua",
      mode: "mini_test",
      replaceExisting: true,
      requestedTotalQuestions: 3,
    });

    expect(next.session.id).not.toBe(first.session.id);
    expect(next.session.currentQuestionIndex).toBe(1);
    expect(next.answers).toEqual([]);

    const previous = await fetchLocalExamSessionSnapshot(first.session.id);
    expect(previous.session.status).toBe("abandoned");
    expect((await fetchLatestActiveLocalExamSession("mini_test"))?.session.id).toBe(
      next.session.id
    );
  });

  it("does not resume a mini test when fetching the official exam mode", async () => {
    startMiniExam();

    expect(await fetchLatestActiveLocalExamSession("exam")).toBeNull();
  });

  it("restores an in-progress exam after the in-memory store is cleared", async () => {
    const started = startMiniExam();
    const answered = submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: started.session.id,
    });

    await seedPersistedExamSnapshot(answered);
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();

    const restored = await fetchLatestActiveLocalExamSession("mini_test");

    expect(restored?.session.id).toBe(started.session.id);
    expect(restored?.session.currentQuestionIndex).toBe(2);
    expect(restored?.answers).toHaveLength(1);
  });

  it("does not restore an abandoned exam after the in-memory store is cleared", async () => {
    const started = startMiniExam();
    submitLocalExamAnswer({
      answerGiven: "B",
      locale: "ua",
      sessionId: started.session.id,
    });
    const abandoned = setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "abandoned",
    });

    await seedPersistedExamSnapshot(abandoned);
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();

    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();
  });

  it("expires a persisted session whose clock already ran out", async () => {
    const started = startMiniExam();
    const live = await fetchLocalExamSessionSnapshot(started.session.id);
    const expiredClock = {
      ...live,
      session: {
        ...live.session,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        remainingSeconds: 0,
      },
    };

    await seedPersistedExamSnapshot(expiredClock);
    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();

    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();

    const stored = await fetchLocalExamSessionSnapshot(started.session.id);
    expect(stored.session.status).toBe("expired");
  });

  it("keeps a finished snapshot finished if status is set again", async () => {
    const started = startMiniExam();
    const abandoned = setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "abandoned",
    });
    const again = setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "expired",
    });

    expect(abandoned.session.status).toBe("abandoned");
    expect(again.session.status).toBe("abandoned");
  });

  it("clears the persisted active pointer after abandon", async () => {
    const started = startMiniExam();
    setLocalExamSessionStatus({
      sessionId: started.session.id,
      status: "abandoned",
    });
    await waitForExamSnapshotPersistForTests();

    resetLocalExamSessionsForTests();
    await resetExamSnapshotCacheForTests();

    expect(await fetchLatestActiveLocalExamSession("mini_test")).toBeNull();
  });
});
