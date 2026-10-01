import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import {
  isQuestionTopicId,
  type LearningTopicId,
  type QuestionSessionMode,
  type QuestionTopicId,
} from "@prawko/config";

import {
  createQuestionSessionKey,
  isQuestionSessionMode,
} from "../question-engine";
import { isLearningTopicId } from "../../question-topics/catalog";
import { isRoadmapStepId } from "../../home/roadmap-progress";
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
  title?: string;
  topic?: LearningTopicId;
  topics?: QuestionTopicId[];
  roadmapStepId?: string;
};

export function useQuestionRouteParams(): QuestionRouteParams {
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    session?: string | string[];
    studyPlanTaskId?: string | string[];
    timeLimitSeconds?: string | string[];
    title?: string | string[];
    topic?: string | string[];
    topics?: string | string[];
    roadmapStepId?: string | string[];
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
  const rawTitle = getSingleParam(params.title)?.trim();
  const title = rawTitle ? rawTitle : undefined;
  const rawRoadmapStepId = getSingleParam(params.roadmapStepId);
  const roadmapStepId = isRoadmapStepId(rawRoadmapStepId)
    ? rawRoadmapStepId
    : undefined;
  const rawTopics = getSingleParam(params.topics);
  const topics = useMemo(() => {
    if (!rawTopics) {
      return undefined;
    }

    const parsed = rawTopics
      .split(",")
      .map((value) => value.trim())
      .filter(isQuestionTopicId);

    return parsed.length > 0 ? parsed : undefined;
  }, [rawTopics]);
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
    title,
    roadmapStepId,
    topic,
    topics,
  };
}
