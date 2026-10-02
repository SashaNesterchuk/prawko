export const EXAM_ENTRIES = [
  "home",
  "learn",
  "practice",
  "roadmap_step",
  "roadmap_simulator",
  "result_restart",
  "home_contextual",
  "paywall",
] as const;

export type ExamEntry = (typeof EXAM_ENTRIES)[number];

export function isExamEntry(value: string | null | undefined): value is ExamEntry {
  return EXAM_ENTRIES.some((entry) => entry === value);
}

export function examAnalyticsFromRoute(input: {
  entry: string | null | undefined;
  roadmapStepId?: string | null;
}): { exam_entry: ExamEntry | "unspecified"; roadmap_step_id?: string } {
  return {
    exam_entry: isExamEntry(input.entry) ? input.entry : "unspecified",
    ...(input.roadmapStepId ? { roadmap_step_id: input.roadmapStepId } : {}),
  };
}

export function examAnalyticsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  const entry = metadata?.exam_entry;
  const roadmapStepId = metadata?.roadmap_step_id;

  return {
    ...(typeof entry === "string" && entry ? { exam_entry: entry } : {}),
    ...(typeof roadmapStepId === "string" && roadmapStepId
      ? { roadmap_step_id: roadmapStepId }
      : {}),
  };
}

/** Opening a stored result is not a finish. Only a session that just completed emits the event. */
export function examCompletionAnalytics(input: {
  justFinished: boolean;
  metadata: Record<string, unknown> | null | undefined;
}) {
  if (!input.justFinished) {
    return null;
  }

  return examAnalyticsFromMetadata(input.metadata);
}
