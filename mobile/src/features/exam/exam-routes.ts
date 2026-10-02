import { isUuidString } from "../questions/question-routes";

import type { ExamEntry } from "./exam-entry";
import type { ExamSimulatorMode } from "./types";

export function buildExamRouteParams(input: {
  entry: ExamEntry;
  mode: ExamSimulatorMode;
  questionLimit?: number | null;
  roadmapStepId?: string | null;
  studyPlanTaskId?: string | null;
}) {
  const params: Record<string, string> = {
    entry: input.entry,
    mode: input.mode,
  };

  if (input.roadmapStepId) {
    params.roadmapStepId = input.roadmapStepId;
  }

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
