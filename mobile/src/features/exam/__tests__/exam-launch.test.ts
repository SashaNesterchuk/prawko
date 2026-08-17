import { resolveExamLaunchDecision } from "../exam-launch";

const matchingActive = {
  session: {
    currentCategory: "B" as const,
    currentQuestionIndex: 2,
    id: "local-exam-1",
    totalQuestionsTarget: 20,
  },
};

describe("resolveExamLaunchDecision", () => {
  it("starts fresh when no active session exists", () => {
    expect(
      resolveExamLaunchDecision({
        activeSnapshot: null,
        preferredCategory: "B",
        totalQuestionsTarget: 20,
      })
    ).toEqual({ action: "start" });
  });

  it("resumes the matching in-progress exam at its current question", () => {
    expect(
      resolveExamLaunchDecision({
        activeSnapshot: matchingActive,
        preferredCategory: "B",
        totalQuestionsTarget: 20,
      })
    ).toEqual({
      action: "resume",
      currentQuestionIndex: 2,
      sessionId: "local-exam-1",
    });
  });

  it("abandons when the question count no longer matches", () => {
    expect(
      resolveExamLaunchDecision({
        activeSnapshot: matchingActive,
        preferredCategory: "B",
        totalQuestionsTarget: 32,
      })
    ).toEqual({
      action: "abandon",
      reason: "question_target_mismatch",
      sessionId: "local-exam-1",
    });
  });

  it("abandons when the category changed", () => {
    expect(
      resolveExamLaunchDecision({
        activeSnapshot: matchingActive,
        preferredCategory: "A",
        totalQuestionsTarget: 20,
      })
    ).toEqual({
      action: "abandon",
      reason: "category_mismatch",
      sessionId: "local-exam-1",
    });
  });

  it("prefers category mismatch when both size and category differ", () => {
    expect(
      resolveExamLaunchDecision({
        activeSnapshot: matchingActive,
        preferredCategory: "C",
        totalQuestionsTarget: 10,
      })
    ).toEqual({
      action: "abandon",
      reason: "category_mismatch",
      sessionId: "local-exam-1",
    });
  });
});
