import { isCountryCode, type CountryCode } from "@prawko/config";

import {
  flushQuestionProgressPersist,
  useQuestionProgressStore,
} from "../../state/question-progress";
import { isLocalExamSessionId } from "./exam-session-id";
import { isFreeExamSessionMetadata } from "./exam-profile";
import type { RemoteExamSnapshot } from "./types";

export const LOCAL_EXAM_PROGRESS_VERSION = 1;

/**
 * Legacy finished sessions have no reliable indication of which answers were
 * already counted by the screen. Do not replay them. An active free-navigation
 * exam has not been counted yet; linear exams need a baseline of old answers.
 */
export function prepareLocalExamProgress(
  snapshot: RemoteExamSnapshot,
  country: CountryCode
): RemoteExamSnapshot {
  const metadata = snapshot.session.metadata;
  const storedCountry = metadata.exam_country;
  if (
    typeof storedCountry === "string" &&
    isCountryCode(storedCountry) &&
    storedCountry !== country
  ) {
    throw new Error("Local exam belongs to another country.");
  }
  if (
    metadata.learning_progress_version === LOCAL_EXAM_PROGRESS_VERSION ||
    snapshot.session.status !== "active"
  ) {
    return metadata.exam_country === country
      ? snapshot
      : {
          ...snapshot,
          session: {
            ...snapshot.session,
            metadata: { ...metadata, exam_country: country },
          },
        };
  }
  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      metadata: {
        ...metadata,
        exam_country: country,
        learning_progress_version: LOCAL_EXAM_PROGRESS_VERSION,
        learning_progress_baseline_orders: isFreeExamSessionMetadata(metadata)
          ? []
          : snapshot.answers.map((answer) => answer.order),
      },
    },
  };
}

export function recordLocalExamProgress(
  snapshot: RemoteExamSnapshot,
  country: CountryCode
) {
  const metadata = snapshot.session.metadata;
  if (
    !isLocalExamSessionId(snapshot.session.id) ||
    metadata.exam_country !== country ||
    metadata.learning_progress_version !== LOCAL_EXAM_PROGRESS_VERSION
  ) {
    return;
  }
  const finalized = snapshot.session.status !== "active";
  if (!finalized && isFreeExamSessionMetadata(metadata)) {
    // CZ/SK permit revising answers: only the final selection is an attempt.
    return;
  }
  const baseline = new Set(
    Array.isArray(metadata.learning_progress_baseline_orders)
      ? metadata.learning_progress_baseline_orders
      : []
  );
  const finalAnswers = new Map(
    snapshot.answers.map((answer) => [answer.order, answer])
  );
  const applied = useQuestionProgressStore.getState().applyExamAttemptBatch({
    country,
    sessionId: snapshot.session.id,
    startedAt: snapshot.session.startedAt,
    finalized,
    attempts: [...finalAnswers.values()]
      .filter((answer) => !baseline.has(answer.order))
      .map((answer) => ({
        id: answer.questionAttemptId ?? `order:${answer.order}`,
        questionId: answer.questionSourceId,
        answeredAt: answer.answeredAt,
        isCorrect: answer.isCorrect,
      })),
  });
  if (applied && finalized) {
    void flushQuestionProgressPersist();
  }
}
