import type { QuestionSessionMode } from "@prawko/config";

import { getExamCountry } from "../../state/app-shell";
import { useQuestionProgressStore } from "../../state/question-progress";
import { useReadinessSnapshotStore } from "../../state/readiness-snapshot";
import { computeLocalReadinessScore } from "../questions/readiness-score";
import { getQuestionDisplayStats } from "../questions/question-engine";

import {
  getCompletionKindForMode,
} from "./home-contextual";
import { useHomeContextualStore } from "./home-contextual-store";

export function captureHomeContextualCompletion(input: {
  answeredCount: number;
  mode: QuestionSessionMode;
  sessionId: string;
  topicId?: string | null;
  totalCount: number;
}) {
  const kind = getCompletionKindForMode(input.mode, input.topicId);
  if (kind == null || input.answeredCount <= 0) {
    return;
  }

  const snapshot = useReadinessSnapshotStore.getState().snapshot;
  const progress = useQuestionProgressStore.getState();
  const stats = getQuestionDisplayStats(progress.questionUserState);
  const currentReadiness = computeLocalReadinessScore({
    attempts: progress.attempts,
    totalQuestions: stats.total,
    userStates: progress.questionUserState,
  });
  const readinessDelta =
    snapshot != null && !snapshot.isEmpty
      ? currentReadiness - snapshot.percent
      : null;

  useHomeContextualStore.getState().recordCompletion({
    answeredCount: input.answeredCount,
    examCountry: getExamCountry(),
    id: input.sessionId,
    kind,
    mode: input.mode,
    readinessDelta,
    topicId: input.topicId ?? null,
    totalCount: Math.max(input.totalCount, input.answeredCount),
  });
}
