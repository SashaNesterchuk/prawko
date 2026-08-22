export type VisibleQuestionStep = {
  index: number;
  questionId: string;
};

export type QuestionStepState =
  | "answered"
  | "correct"
  | "current"
  | "upcoming"
  | "wrong";

export function getVisibleQuestionSteps(
  questionIds: string[],
  currentIndex: number,
  windowSize = 24
): VisibleQuestionStep[] {
  const stepWindowStart =
    questionIds.length > windowSize
      ? Math.min(
          Math.max(0, currentIndex - Math.floor(windowSize / 2)),
          questionIds.length - windowSize
        )
      : 0;

  return questionIds
    .slice(stepWindowStart, stepWindowStart + windowSize)
    .map((questionId, offset) => ({
      questionId,
      index: stepWindowStart + offset,
    }));
}

export function getQuestionStepState(
  answer: { isCorrect: boolean } | undefined,
  index: number,
  currentIndex: number
): QuestionStepState {
  if (answer) {
    return answer.isCorrect ? "correct" : "wrong";
  }

  return index === currentIndex ? "current" : "upcoming";
}
