import type { QuestionSession } from "../../questions/types";

import {
  buildDebugHomeContextualResolution,
  cycleHomeContextualDebugPreview,
  estimateSessionMinutes,
  getCompletionKindForMode,
  getHomeContextualDebugPreviewLabel,
  getResumableHomeSession,
  isFreshHomeCompletion,
  pickWeakestOpenTopic,
  resolveHomeContextualBlock,
  type HomeCompletionEvent,
} from "../home-contextual";

function makeCompletion(
  overrides: Partial<HomeCompletionEvent> = {}
): HomeCompletionEvent {
  return {
    answeredCount: 12,
    completedAt: 1_000_000,
    examCountry: "PL",
    id: "session-1",
    kind: "training",
    mode: "learning",
    readinessDelta: 2,
    shownOnHome: false,
    topicId: null,
    totalCount: 12,
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<QuestionSession> & {
    request?: Partial<QuestionSession["request"]>;
  } = {}
): QuestionSession {
  const { request, ...rest } = overrides;

  return {
    answers: {
      q1: {
        answeredAt: "2026-09-20T10:00:00.000Z",
        isCorrect: true,
        questionId: "q1",
        selectedAnswer: "A",
      },
    },
    createdAt: "2026-09-20T09:55:00.000Z",
    currentIndex: 1,
    emptyReason: null,
    finishedAt: null,
    id: "session-resume",
    questionIds: ["q1", "q2", "q3"],
    request: {
      currentCategory: "B",
      mode: "learning",
      questionLimit: 3,
      sessionKey: "B-learning-all-abc",
      ...request,
    },
    ...rest,
  };
}

describe("home contextual resolver", () => {
  it("estimates review time at 30 seconds per question", () => {
    expect(estimateSessionMinutes(5)).toBe(3);
    expect(estimateSessionMinutes(8)).toBe(4);
    expect(estimateSessionMinutes(0)).toBe(0);
  });

  it("maps session modes to completion kinds and skips first-start diagnostic", () => {
    expect(getCompletionKindForMode("initial_diagnostic")).toBeNull();
    expect(getCompletionKindForMode("wrong_answers")).toBe("mistakes");
    expect(getCompletionKindForMode("review_due")).toBe("review");
    expect(getCompletionKindForMode("weak_spots")).toBe("weak_spot");
    expect(getCompletionKindForMode("learning", "intersections_priority")).toBe(
      "weak_spot"
    );
    expect(getCompletionKindForMode("learning")).toBe("training");
    expect(getCompletionKindForMode("exam")).toBe("exam");
    expect(getCompletionKindForMode("blitz")).toBe("training");
  });

  it("does not show any block to a new user", () => {
    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: true,
        pendingCompletion: makeCompletion(),
        resumeSession: {
          answered: 1,
          remaining: 2,
          request: makeSession().request,
          source: "active",
          total: 3,
        },
        reviewDue: 8,
        weakTopic: {
          progress: 10,
          remaining: 6,
          topicId: "intersections_priority",
        },
        wrongAnswers: 5,
      })
    ).toEqual({ type: "none" });
  });

  it("prefers a fresh unshown completion over next action", () => {
    const event = makeCompletion();

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        now: event.completedAt + 60_000,
        pendingCompletion: event,
        resumeSession: null,
        reviewDue: 8,
        weakTopic: null,
        wrongAnswers: 5,
      })
    ).toEqual({ type: "completion", event });
  });

  it("does not keep completion after it was shown, unless this Home visit is still open", () => {
    const event = makeCompletion({ shownOnHome: true });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        now: event.completedAt + 60_000,
        pendingCompletion: event,
        resumeSession: null,
        reviewDue: 0,
        weakTopic: null,
        wrongAnswers: 5,
      })
    ).toMatchObject({ type: "next_action", kind: "mistakes", count: 5 });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        keepCompletionVisible: true,
        now: event.completedAt + 60_000,
        pendingCompletion: event,
        resumeSession: null,
        reviewDue: 0,
        weakTopic: null,
        wrongAnswers: 5,
      })
    ).toEqual({ type: "completion", event });
  });

  it("drops stale or empty completion and falls through to next action", () => {
    expect(
      isFreshHomeCompletion({
        event: makeCompletion({
          completedAt: 1_000_000,
          shownOnHome: false,
        }),
        examCountry: "PL",
        now: 1_000_000 + 31 * 60 * 1000,
      })
    ).toBe(false);

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        now: 1_000_000 + 31 * 60 * 1000,
        pendingCompletion: makeCompletion({ answeredCount: 12 }),
        resumeSession: null,
        reviewDue: 4,
        weakTopic: null,
        wrongAnswers: 0,
      })
    ).toMatchObject({ type: "next_action", kind: "review", count: 4 });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: makeCompletion({ answeredCount: 0, totalCount: 0 }),
        resumeSession: null,
        reviewDue: 0,
        weakTopic: null,
        wrongAnswers: 0,
      })
    ).toEqual({ type: "none" });
  });

  it("hides completion when a higher-priority monetization flow is open", () => {
    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        hasHigherPriorityFlow: true,
        isNewUser: false,
        pendingCompletion: makeCompletion(),
        resumeSession: null,
        reviewDue: 0,
        weakTopic: null,
        wrongAnswers: 3,
      })
    ).toMatchObject({ type: "next_action", kind: "mistakes" });
  });

  it("orders next actions: resume, mistakes, review, weak topic, else nothing", () => {
    const resume = {
      answered: 12,
      remaining: 8,
      request: makeSession().request,
      source: "active" as const,
      total: 20,
    };

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: null,
        resumeSession: resume,
        reviewDue: 8,
        weakTopic: {
          progress: 20,
          remaining: 6,
          topicId: "intersections_priority",
        },
        wrongAnswers: 5,
      })
    ).toMatchObject({ type: "next_action", kind: "resume" });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: null,
        resumeSession: null,
        reviewDue: 8,
        weakTopic: {
          progress: 20,
          remaining: 6,
          topicId: "intersections_priority",
        },
        wrongAnswers: 5,
      })
    ).toMatchObject({ type: "next_action", kind: "mistakes", count: 5 });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: null,
        resumeSession: null,
        reviewDue: 8,
        weakTopic: {
          progress: 20,
          remaining: 6,
          topicId: "intersections_priority",
        },
        wrongAnswers: 0,
      })
    ).toMatchObject({ type: "next_action", kind: "review", count: 8 });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: null,
        resumeSession: null,
        reviewDue: 0,
        weakTopic: {
          progress: 20,
          remaining: 6,
          topicId: "intersections_priority",
        },
        wrongAnswers: 0,
      })
    ).toMatchObject({ type: "next_action", kind: "weak_topic" });

    expect(
      resolveHomeContextualBlock({
        examCountry: "PL",
        isNewUser: false,
        pendingCompletion: null,
        resumeSession: null,
        reviewDue: 0,
        weakTopic: null,
        wrongAnswers: 0,
      })
    ).toEqual({ type: "none" });
  });

  it("resumes an unfinished session with answers and remaining questions", () => {
    expect(
      getResumableHomeSession({
        activeSession: makeSession(),
        category: "B",
        homeDailySession: null,
        today: "2026-09-20",
      })
    ).toMatchObject({
      answered: 1,
      remaining: 2,
      source: "active",
      total: 3,
    });
  });

  it("does not resume finished, empty, or unanswered sessions", () => {
    expect(
      getResumableHomeSession({
        activeSession: makeSession({ finishedAt: "2026-09-20T10:05:00.000Z" }),
        category: "B",
        homeDailySession: null,
        today: "2026-09-20",
      })
    ).toBeNull();

    expect(
      getResumableHomeSession({
        activeSession: makeSession({ answers: {} }),
        category: "B",
        homeDailySession: null,
        today: "2026-09-20",
      })
    ).toBeNull();
  });

  it("picks the weakest started topic that still has remaining questions", () => {
    expect(
      pickWeakestOpenTopic([
        {
          progress: 90,
          remaining: 4,
          seen: 20,
          topicId: "signs_signals",
        },
        {
          progress: 12,
          remaining: 18,
          seen: 6,
          topicId: "intersections_priority",
        },
        {
          progress: 5,
          remaining: 40,
          seen: 0,
          topicId: "driving_maneuvers",
        },
      ])
    ).toEqual({
      progress: 12,
      remaining: 18,
      topicId: "intersections_priority",
    });

    expect(
      pickWeakestOpenTopic([
        {
          progress: 100,
          remaining: 0,
          seen: 12,
          topicId: "signs_signals",
        },
      ])
    ).toBeNull();
  });

  it("cycles debug previews and builds sample cards", () => {
    expect(cycleHomeContextualDebugPreview("auto")).toBe("resume");
    expect(cycleHomeContextualDebugPreview("hidden")).toBe("auto");
    expect(getHomeContextualDebugPreviewLabel("completion_mistakes")).toBe(
      "DEV card: done ✓"
    );

    expect(
      buildDebugHomeContextualResolution({
        examCountry: "PL",
        preview: "mistakes",
        topicId: "intersections_priority",
      })
    ).toMatchObject({ type: "next_action", kind: "mistakes", count: 5 });

    expect(
      buildDebugHomeContextualResolution({
        examCountry: "PL",
        preview: "completion_training",
        topicId: "intersections_priority",
      })
    ).toMatchObject({
      type: "completion",
      event: { kind: "training", answeredCount: 12, totalCount: 12 },
    });

    expect(
      buildDebugHomeContextualResolution({
        examCountry: "PL",
        preview: "hidden",
        topicId: "intersections_priority",
      })
    ).toEqual({ type: "none" });
  });
});
