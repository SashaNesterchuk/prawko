import type { LearningTopicId, QuestionSessionMode } from "@prawko/config";

import { createQuestionSessionKey } from "./question-engine";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    UUID_PATTERN.test(value)
  );
}

export function buildQuestionRouteParams(input: {
  mode: QuestionSessionMode;
  questionLimit?: number | null;
  sessionKey?: string;
  studyPlanTaskId?: string | null;
  timeLimitSeconds?: number | null;
  title?: string | null;
  topic?: LearningTopicId;
  topics?: readonly string[] | null;
  roadmapStepId?: string | null;
}) {
  const params: Record<string, string> = {
    mode: input.mode,
    session: input.sessionKey ?? createQuestionSessionKey(input),
  };

  if (
    typeof input.questionLimit === "number" &&
    Number.isFinite(input.questionLimit) &&
    input.questionLimit > 0
  ) {
    params.questionLimit = Math.floor(input.questionLimit).toString();
  }

  if (
    typeof input.timeLimitSeconds === "number" &&
    Number.isFinite(input.timeLimitSeconds) &&
    input.timeLimitSeconds > 0
  ) {
    params.timeLimitSeconds = Math.floor(input.timeLimitSeconds).toString();
  }

  if (isUuidString(input.studyPlanTaskId)) {
    params.studyPlanTaskId = input.studyPlanTaskId;
  }

  const title = input.title?.trim();
  if (title) {
    params.title = title;
  }

  const roadmapStepId = input.roadmapStepId?.trim();
  if (roadmapStepId) {
    params.roadmapStepId = roadmapStepId;
  }

  if (input.topics?.length) {
    params.topics = input.topics.join(",");
  }

  return input.topic
    ? {
        ...params,
        topic: input.topic,
      }
    : params;
}
