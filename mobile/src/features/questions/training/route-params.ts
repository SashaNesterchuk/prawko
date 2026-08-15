import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import type { LearningTopicId, QuestionSessionMode } from "@prawko/config";

import {
  createQuestionSessionKey,
  isQuestionSessionMode,
} from "../question-engine";
import { isLearningTopicId } from "../../question-topics/catalog";
import { isUuidString } from "../question-routes";
import { useAppShellStore } from "../../../state/app-shell";

export function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = Number.parseInt(value, 10);

  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

export type QuestionRouteParams = {
  mode: QuestionSessionMode;
  questionLimit?: number;
  routeSessionKey?: string;
  sessionKey: string;
  studyPlanTaskId?: string;
  timeLimitSeconds?: number;
  topic?: LearningTopicId;
};

export function useQuestionRouteParams(): QuestionRouteParams {
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    session?: string | string[];
    studyPlanTaskId?: string | string[];
    timeLimitSeconds?: string | string[];
    topic?: string | string[];
  }>();

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawTopic = getSingleParam(params.topic);
  const routeSessionKey = getSingleParam(params.session);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const rawTimeLimitSeconds = getSingleParam(params.timeLimitSeconds);
  const mode = rawMode && isQuestionSessionMode(rawMode) ? rawMode : "learning";
  const questionLimit = parsePositiveInteger(rawQuestionLimit);
  const timeLimitSeconds = parsePositiveInteger(rawTimeLimitSeconds);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const topic = rawTopic && isLearningTopicId(rawTopic) ? rawTopic : undefined;
  const sessionKey = useMemo(
    () =>
      routeSessionKey
        ? `${preferredCategory}:${routeSessionKey}`
        : createQuestionSessionKey({
            currentCategory: preferredCategory,
            mode,
            topic,
          }),
    [mode, preferredCategory, routeSessionKey, topic]
  );

  return {
    mode,
    questionLimit,
    routeSessionKey,
    sessionKey,
    studyPlanTaskId,
    timeLimitSeconds,
    topic,
  };
}
