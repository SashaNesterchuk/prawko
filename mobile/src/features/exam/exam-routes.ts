import { isUuidString } from "../questions/question-routes";

import type { ExamSimulatorMode } from "./types";

export function buildExamRouteParams(input: {
  mode: ExamSimulatorMode;
  questionLimit?: number | null;
  studyPlanTaskId?: string | null;
}) {
  const params: Record<string, string> = {
    mode: input.mode,
  };

  if (
    typeof input.questionLimit === "number" &&
    Number.isFinite(input.questionLimit) &&
    input.questionLimit > 0
  ) {
    params.questionLimit = Math.floor(input.questionLimit).toString();
  }

  if (isUuidString(input.studyPlanTaskId)) {
    params.studyPlanTaskId = input.studyPlanTaskId;
  }

  return params;
}
