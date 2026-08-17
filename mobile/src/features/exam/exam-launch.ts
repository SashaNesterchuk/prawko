import type { DrivingCategory } from "@prawko/config";

type ActiveExamLaunchSnapshot = {
  session: {
    currentCategory: DrivingCategory;
    currentQuestionIndex: number;
    id: string;
    totalQuestionsTarget: number;
  };
};

export type ExamLaunchDecision =
  | {
      action: "resume";
      currentQuestionIndex: number;
      sessionId: string;
    }
  | {
      action: "abandon";
      reason: "category_mismatch" | "question_target_mismatch";
      sessionId: string;
    }
  | { action: "start" };

/**
 * Opening Exam from Home / Practice should resume only the still-active
 * matching attempt. A confirmed close, size change, or category change
 * must start a new session at question 1 — not reopen question 2.
 */
export function resolveExamLaunchDecision(input: {
  activeSnapshot: ActiveExamLaunchSnapshot | null;
  preferredCategory: DrivingCategory;
  totalQuestionsTarget: number;
}): ExamLaunchDecision {
  const activeSnapshot = input.activeSnapshot;

  if (!activeSnapshot) {
    return { action: "start" };
  }

  if (
    activeSnapshot.session.totalQuestionsTarget === input.totalQuestionsTarget &&
    activeSnapshot.session.currentCategory === input.preferredCategory
  ) {
    return {
      action: "resume",
      currentQuestionIndex: activeSnapshot.session.currentQuestionIndex,
      sessionId: activeSnapshot.session.id,
    };
  }

  return {
    action: "abandon",
    reason:
      activeSnapshot.session.currentCategory === input.preferredCategory
        ? "question_target_mismatch"
        : "category_mismatch",
    sessionId: activeSnapshot.session.id,
  };
}
