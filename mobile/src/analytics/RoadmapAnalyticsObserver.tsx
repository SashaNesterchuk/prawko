import { useEffect } from "react";
import { useAnalytics } from "../hooks/useAnalytics";
import { useRoadmapProgressStore } from "../features/home/roadmap-progress";
import { useQuestionProgressStore } from "../state/question-progress";
import { observeRoadmapProgress } from "./roadmap-progress-observation";

export function RoadmapAnalyticsObserver() {
  const { track } = useAnalytics();
  useEffect(() => useRoadmapProgressStore.subscribe((next, previous) => {
    try {
      observeRoadmapProgress(previous, next, track, useQuestionProgressStore.getState().activeSession);
    } catch { /* Optional observation must never interrupt local learning. */ }
  }), [track]);
  return null;
}
