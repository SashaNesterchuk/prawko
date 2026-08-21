import {
  buildQuestionSession,
  createEmptyQuestionUserState,
  finishQuestionSession,
  getQuestionSessionSummary,
  getRemainingSessionSeconds,
  isQuestionSessionExpired,
  pauseQuestionSessionTimer,
  resumeQuestionSessionTimer,
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

describe("blitz session", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("unseen-a"),
      makeQuestion("unseen-b"),
      makeQuestion("wrong-1"),
      makeQuestion("wrong-saved"),
      makeQuestion("review-1"),
      makeQuestion("saved-1"),
      makeQuestion("filler-1"),
    ]);
  });

  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("orders unseen → mistakes → smart review → saved → remaining", () => {
    const states: Record<string, QuestionUserState> = {
      "wrong-1": unresolvedWrong("wrong-1"),
      "wrong-saved": {
        ...unresolvedWrong("wrong-saved"),
        isBookmarked: true,
      },
      "review-1": {
        ...createEmptyQuestionUserState("review-1"),
        timesSeen: 1,
        timesCorrect: 1,
        consecutiveCorrect: 1,
        lastSeenAt: "2026-08-01T12:00:00.000Z",
        lastCorrectAt: "2026-08-01T12:00:00.000Z",
        reviewDueAt: "2026-08-14T12:00:00.000Z",
      },
      "saved-1": {
        ...createEmptyQuestionUserState("saved-1"),
        timesSeen: 1,
        timesCorrect: 1,
        consecutiveCorrect: 1,
        lastSeenAt: "2026-08-10T12:00:00.000Z",
        lastCorrectAt: "2026-08-10T12:00:00.000Z",
        reviewDueAt: "2026-09-01T12:00:00.000Z",
        isBookmarked: true,
      },
      "filler-1": {
        ...createEmptyQuestionUserState("filler-1"),
        timesSeen: 5,
        timesCorrect: 5,
        consecutiveCorrect: 3,
        isMastered: true,
        lastSeenAt: "2026-08-14T12:00:00.000Z",
        lastCorrectAt: "2026-08-14T12:00:00.000Z",
        reviewDueAt: "2026-09-01T12:00:00.000Z",
      },
    };

    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "blitz",
        sessionKey: "blitz-order",
        timeLimitSeconds: 300,
      },
      states,
      now
    );

    const position = (id: string) => session.questionIds.indexOf(id);
    const lastUnseen = Math.max(position("unseen-a"), position("unseen-b"));
    const lastWrong = Math.max(position("wrong-1"), position("wrong-saved"));

    expect(session.questionIds).toHaveLength(7);
    expect(lastUnseen).toBeLessThan(position("wrong-1"));
    expect(lastUnseen).toBeLessThan(position("wrong-saved"));
    expect(lastWrong).toBeLessThan(position("review-1"));
    expect(position("review-1")).toBeLessThan(position("saved-1"));
    expect(position("saved-1")).toBeLessThan(position("filler-1"));
    expect(session.expiresAt).toBe("2026-08-15T12:05:00.000Z");
  });

  it("scores only answered questions when the timer ends", () => {
    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "blitz",
        sessionKey: "blitz-finish",
        timeLimitSeconds: 180,
      },
      {},
      now
    );
    const firstId = session.questionIds[0]!;
    const secondId = session.questionIds[1]!;
    const withAnswers = {
      ...session,
      currentIndex: 1,
      answers: {
        [firstId]: {
          questionId: firstId,
          selectedAnswer: "A" as const,
          isCorrect: true,
          answeredAt: "2026-08-15T12:01:00.000Z",
        },
        [secondId]: {
          questionId: secondId,
          selectedAnswer: "B" as const,
          isCorrect: false,
          answeredAt: "2026-08-15T12:02:00.000Z",
        },
      },
    };

    const finished = finishQuestionSession(
      withAnswers,
      new Date("2026-08-15T12:03:00.000Z")
    );
    const summary = getQuestionSessionSummary(finished);

    expect(finished.questionIds).toEqual([firstId, secondId]);
    expect(finished.finishedAt).toBe("2026-08-15T12:03:00.000Z");
    expect(summary).toEqual({
      total: 2,
      answered: 2,
      correct: 1,
      wrong: 1,
    });
  });

  it("treats a timed session as expired after the budget elapses", () => {
    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "blitz",
        sessionKey: "blitz-expire",
        timeLimitSeconds: 180,
      },
      {},
      now
    );

    expect(isQuestionSessionExpired(session, now)).toBe(false);
    expect(
      isQuestionSessionExpired(session, new Date("2026-08-15T12:03:00.000Z"))
    ).toBe(true);
  });

  it("freezes remaining time while the session timer is paused", () => {
    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "blitz",
        sessionKey: "blitz-pause",
        timeLimitSeconds: 180,
      },
      {},
      now
    );
    const pausedAt = new Date("2026-08-15T12:01:00.000Z");
    const paused = pauseQuestionSessionTimer(session, pausedAt);

    expect(getRemainingSessionSeconds(paused, pausedAt)).toBe(120);
    expect(
      getRemainingSessionSeconds(paused, new Date("2026-08-15T12:02:30.000Z"))
    ).toBe(120);
    expect(
      isQuestionSessionExpired(paused, new Date("2026-08-15T12:05:00.000Z"))
    ).toBe(false);

    const resumedAt = new Date("2026-08-15T12:02:00.000Z");
    const resumed = resumeQuestionSessionTimer(paused, resumedAt);

    expect(resumed.timerPausedAt).toBeNull();
    expect(getRemainingSessionSeconds(resumed, resumedAt)).toBe(120);
    expect(
      getRemainingSessionSeconds(resumed, new Date("2026-08-15T12:02:30.000Z"))
    ).toBe(90);
  });

  it("clears a paused timer when the session finishes", () => {
    const session = buildQuestionSession(
      {
        currentCategory: "B",
        mode: "blitz",
        sessionKey: "blitz-pause-finish",
        timeLimitSeconds: 180,
      },
      {},
      now
    );
    const paused = pauseQuestionSessionTimer(
      session,
      new Date("2026-08-15T12:01:00.000Z")
    );
    const finished = finishQuestionSession(
      paused,
      new Date("2026-08-15T12:02:00.000Z")
    );

    expect(finished.timerPausedAt).toBeNull();
    expect(finished.finishedAt).toBe("2026-08-15T12:02:00.000Z");
  });
});
