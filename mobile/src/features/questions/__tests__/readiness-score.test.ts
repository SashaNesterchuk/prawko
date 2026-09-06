import type { QuestionAttempt } from "../types";
import {
  computeLocalReadinessScore,
  computeLocalReadinessScoreComponents,
  resolveReadinessScore,
} from "../readiness-score";

function makeAttempt(
  overrides: Partial<QuestionAttempt> & Pick<QuestionAttempt, "questionId">
): QuestionAttempt {
  return {
    id: `attempt-${overrides.questionId}`,
    sessionId: "session-1",
    sessionMode: "mini_test",
    topicBlock: "safety",
    selectedAnswer: "A",
    isCorrect: true,
    answeredAt: "2026-09-06T12:00:00.000Z",
    ...overrides,
  };
}

function makeMiniTest(correct: number, wrong: number): QuestionAttempt[] {
  const attempts: QuestionAttempt[] = [];

  for (let index = 0; index < correct; index += 1) {
    attempts.push(
      makeAttempt({
        id: `correct-${index}`,
        questionId: `correct-${index}`,
        isCorrect: true,
      })
    );
  }

  for (let index = 0; index < wrong; index += 1) {
    attempts.push(
      makeAttempt({
        id: `wrong-${index}`,
        questionId: `wrong-${index}`,
        isCorrect: false,
      })
    );
  }

  return attempts;
}

describe("computeLocalReadinessScore", () => {
  it("stays at 0 before any answers", () => {
    expect(
      computeLocalReadinessScore({
        attempts: [],
        userStates: {},
      })
    ).toBe(0);
  });

  it("does not treat a first 10-question session score as the whole index", () => {
    const attempts = makeMiniTest(3, 7);
    const components = computeLocalReadinessScoreComponents({
      attempts,
      now: new Date("2026-09-06T12:00:00.000Z"),
    });

    expect(components.accuracyPercent).toBe(30);
    expect(components.accuracyComponent).toBe(13);
    expect(components.recentExamScorePercent).toBe(30);
    expect(components.recentExamComponent).toBe(6);
    expect(components.unresolvedWeakSpots).toBe(7);
    expect(components.weakSpotComponent).toBe(0);
    expect(components.reviewHygieneComponent).toBe(5);
    expect(components.qualityScore).toBe(24);
    expect(components.readinessScore).toBe(24);
    expect(components.readinessScore).not.toBe(30);
  });

  it("does not show 24% ready after 10 questions in a 2142-question bank", () => {
    const components = computeLocalReadinessScoreComponents({
      attempts: makeMiniTest(3, 7),
      totalQuestions: 2142,
      now: new Date("2026-09-06T12:00:00.000Z"),
    });

    expect(components.uniqueSeen).toBe(10);
    expect(components.qualityScore).toBe(24);
    expect(components.readinessScore).toBe(1);
  });

  it("weights a perfect mini_test by the readinessScore formula, not 100%", () => {
    const components = computeLocalReadinessScoreComponents({
      attempts: makeMiniTest(10, 0),
      now: new Date("2026-09-06T12:00:00.000Z"),
    });

    expect(components.accuracyComponent).toBe(45);
    expect(components.recentExamComponent).toBe(20);
    expect(components.weakSpotComponent).toBe(5);
    expect(components.reviewHygieneComponent).toBe(5);
    expect(components.qualityScore).toBe(75);
    expect(components.readinessScore).toBe(75);
  });

  it("counts learning accuracy without treating it as a recent exam", () => {
    const components = computeLocalReadinessScoreComponents({
      attempts: makeMiniTest(8, 2).map((attempt) => ({
        ...attempt,
        sessionMode: "learning",
      })),
      now: new Date("2026-09-06T12:00:00.000Z"),
    });

    expect(components.accuracyPercent).toBe(80);
    expect(components.recentExamScorePercent).toBeNull();
    expect(components.recentExamComponent).toBe(0);
    expect(components.unresolvedWeakSpots).toBe(2);
    expect(components.weakSpotComponent).toBe(3);
    expect(components.reviewHygieneComponent).toBe(5);
    expect(components.qualityScore).toBe(44);
    expect(components.readinessScore).toBe(44);
  });

  it("adds the plan component using the same 25-point cap as the RPC", () => {
    expect(
      computeLocalReadinessScore({
        attempts: makeMiniTest(10, 0),
        planCompletionPercent: 100,
        now: new Date("2026-09-06T12:00:00.000Z"),
      })
    ).toBe(100);
  });
});

describe("resolveReadinessScore", () => {
  it("prefers the remote readinessScore when present", () => {
    expect(
      resolveReadinessScore(41, {
        attempts: makeMiniTest(3, 7),
      })
    ).toBe(41);
  });

  it("falls back to the local formula when remote is missing", () => {
    expect(
      resolveReadinessScore(null, {
        attempts: makeMiniTest(3, 7),
        now: new Date("2026-09-06T12:00:00.000Z"),
      })
    ).toBe(24);
  });

  it("scales a remote score by unique coverage so a first session is not 24%", () => {
    expect(
      resolveReadinessScore(24, {
        attempts: makeMiniTest(3, 7),
        totalQuestions: 2142,
        now: new Date("2026-09-06T12:00:00.000Z"),
      })
    ).toBe(1);
  });
});
