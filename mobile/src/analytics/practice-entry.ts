export type PracticeEntry = "random" | "topic" | "roadmap";

/**
 * `mode: learning` is three different openings. The entry says which one,
 * without renaming the mode that existing funnels already split on.
 */
export function trainingPracticeEntry(input: {
  mode: string | null | undefined;
  roadmapStepId?: string | null;
  topicId?: string | null;
}): { practice_entry: PracticeEntry } | Record<string, never> {
  if (input.mode !== "learning") {
    return {};
  }

  if (input.roadmapStepId) {
    return { practice_entry: "roadmap" };
  }

  if (input.topicId) {
    return { practice_entry: "topic" };
  }

  return { practice_entry: "random" };
}
