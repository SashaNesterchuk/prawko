import { getFreeRoadmapTopicIds } from "../home/roadmap";

export type LearnerExplanationAccess = "open" | "preview" | "locked";

/**
 * Poland's free Learn topics show the explanation and only mark it as Premium.
 * Czechia, Slovakia, and every other topic stay locked until Premium.
 */
export function resolveLearnerExplanationAccess(input: {
  country: string | null | undefined;
  hasPlusAccess: boolean;
  topicIds: readonly string[];
}): LearnerExplanationAccess {
  if (input.hasPlusAccess) {
    return "open";
  }

  if (input.country !== "PL") {
    return "locked";
  }

  const freeTopicIds = new Set<string>(getFreeRoadmapTopicIds("PL"));

  if (input.topicIds.some((topicId) => freeTopicIds.has(topicId))) {
    return "preview";
  }

  return "locked";
}
