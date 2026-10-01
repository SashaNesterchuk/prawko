import type { CountryCode, DrivingCategory, SupportedLocale } from "@prawko/config";

import { getExamCountry } from "../../state/app-shell";
import {
  flushQuestionProgressPersist,
  useQuestionProgressStore,
} from "../../state/question-progress";
import { isFreeExamSessionMetadata } from "./exam-profile";
import { isLocalExamSessionId } from "./exam-session-id";
import {
  fetchLatestActiveLocalExamSession,
  fetchLocalExamSessionSnapshot,
  finishLocalExamSession,
  setLocalExamCurrentIndex,
  setLocalExamFlaggedOrders,
  setLocalExamSessionStatus,
  startLocalExamSession,
  submitLocalExamAnswer,
  toggleLocalExamFlag,
} from "./local-exam";
import {
  fetchExamSessionSnapshot as fetchRemoteExamSessionSnapshot,
  finishRemoteExamSession,
  setRemoteExamCurrentIndex,
  setRemoteExamFlaggedOrders,
  setRemoteExamSessionStatus,
  submitRemoteExamAnswer,
  toggleRemoteExamFlag,
} from "./supabase-exam";
import type {
  ExamSimulatorMode,
  RemoteExamSessionStatus,
  RemoteExamSnapshot,
} from "./types";

export { isExamSessionId, isLocalExamSessionId } from "./exam-session-id";

type StartExamSessionInput = {
  category: DrivingCategory;
  locale: SupportedLocale;
  mode: ExamSimulatorMode;
  replaceExisting?: boolean;
  requestedTotalQuestions?: number | null;
  studyPlanId?: string | null;
  studyPlanTaskId?: string | null;
};

type SubmitExamAnswerInput = {
  answerDurationMs?: number | null;
  answerGiven: string;
  locale: SupportedLocale;
  metadata?: Record<string, unknown>;
  questionOrder?: number | null;
  sessionId: string;
};

type SetExamSessionStatusInput = {
  metadata?: Record<string, unknown>;
  sessionId: string;
  status: Extract<RemoteExamSessionStatus, "abandoned" | "expired">;
};

export function startExamSession(
  input: StartExamSessionInput
): Promise<RemoteExamSnapshot> {
  // All new exams (PL/CZ/SK, guest/account, online/offline) use one local
  // engine. UUID routing below is only for pre-existing server sessions.
  return Promise.resolve(startLocalExamSession(input));
}

export function fetchExamSessionSnapshot(sessionId: string) {
  if (isLocalExamSessionId(sessionId)) {
    return fetchLocalExamSessionSnapshot(sessionId);
  }

  return fetchRemoteExamSessionSnapshot(sessionId);
}

export function fetchLatestActiveExamSession(
  mode?: ExamSimulatorMode | null
) {
  return fetchLatestActiveLocalExamSession(mode);
}

export function submitExamAnswer(input: SubmitExamAnswerInput) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(submitLocalExamAnswer(input));
  }

  const country = getExamCountry();
  return submitRemoteExamAnswer(input).then((snapshot) => {
    recordLegacyRemoteExamProgress(snapshot, country, input.questionOrder);
    return snapshot;
  });
}

export function setExamSessionStatus(input: SetExamSessionStatusInput) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(setLocalExamSessionStatus(input));
  }

  const country = getExamCountry();
  return setRemoteExamSessionStatus(input).then((snapshot) => {
    recordLegacyRemoteExamProgress(snapshot, country);
    return snapshot;
  });
}

export function setExamCurrentIndex(input: {
  questionOrder: number;
  sessionId: string;
}) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(setLocalExamCurrentIndex(input));
  }

  return setRemoteExamCurrentIndex(input);
}

export function setExamFlaggedOrders(input: {
  flaggedOrders: number[];
  sessionId: string;
}) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(setLocalExamFlaggedOrders(input));
  }

  return setRemoteExamFlaggedOrders(input);
}

export function toggleExamFlag(input: {
  questionOrder: number;
  sessionId: string;
}) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(toggleLocalExamFlag(input));
  }

  return toggleRemoteExamFlag(input);
}

export function finishExamSession(input: {
  metadata?: Record<string, unknown>;
  sessionId: string;
}) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(finishLocalExamSession(input));
  }

  const country = getExamCountry();
  return finishRemoteExamSession(input).then((snapshot) => {
    recordLegacyRemoteExamProgress(snapshot, country);
    return snapshot;
  });
}

/**
 * Preserve answer accounting for pre-existing server sessions without letting
 * a delayed response update a different country's store. New exams never use
 * this path. Old linear answers were already counted individually by the UI.
 */
function recordLegacyRemoteExamProgress(
  snapshot: RemoteExamSnapshot,
  country: CountryCode,
  questionOrder?: number | null
) {
  if (snapshot.session.metadata.exam_country !== country) {
    return;
  }
  const freeNavigation = isFreeExamSessionMetadata(snapshot.session.metadata);
  const finalized = snapshot.session.status !== "active";
  if (freeNavigation ? !finalized : questionOrder == null) {
    return;
  }
  const answers = freeNavigation
    ? snapshot.answers
    : snapshot.answers.filter((answer) => answer.order === questionOrder);
  const applied = useQuestionProgressStore.getState().applyExamAttemptBatch({
    country,
    sessionId: snapshot.session.id,
    startedAt: snapshot.session.startedAt,
    finalized: freeNavigation && finalized,
    attempts: answers.map((answer) => ({
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
