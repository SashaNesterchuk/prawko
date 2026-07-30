import type { DrivingCategory, SupportedLocale } from "@prawko/config";

import { isLocalExamSessionId } from "./exam-session-id";
import {
  fetchLatestActiveLocalExamSession,
  fetchLocalExamSessionSnapshot,
  setLocalExamSessionStatus,
  startLocalExamSession,
  submitLocalExamAnswer,
} from "./local-exam";
import {
  fetchExamSessionSnapshot as fetchRemoteExamSessionSnapshot,
  fetchLatestActiveExamSession as fetchRemoteLatestActiveExamSession,
  setRemoteExamSessionStatus,
  startRemoteExamSession,
  submitRemoteExamAnswer,
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
  sessionId: string;
};

type SetExamSessionStatusInput = {
  metadata?: Record<string, unknown>;
  sessionId: string;
  status: Extract<RemoteExamSessionStatus, "abandoned" | "expired">;
};

export function startExamSession(
  input: StartExamSessionInput,
  options: { useRemote: boolean }
): Promise<RemoteExamSnapshot> {
  if (options.useRemote) {
    return startRemoteExamSession(input);
  }

  return Promise.resolve(startLocalExamSession(input));
}

export function fetchExamSessionSnapshot(sessionId: string) {
  if (isLocalExamSessionId(sessionId)) {
    return fetchLocalExamSessionSnapshot(sessionId);
  }

  return fetchRemoteExamSessionSnapshot(sessionId);
}

export function fetchLatestActiveExamSession(
  mode: ExamSimulatorMode | null | undefined,
  options: { useRemote: boolean }
) {
  if (options.useRemote) {
    return fetchRemoteLatestActiveExamSession(mode);
  }

  return fetchLatestActiveLocalExamSession(mode);
}

export function submitExamAnswer(input: SubmitExamAnswerInput) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(submitLocalExamAnswer(input));
  }

  return submitRemoteExamAnswer(input);
}

export function setExamSessionStatus(input: SetExamSessionStatusInput) {
  if (isLocalExamSessionId(input.sessionId)) {
    return Promise.resolve(setLocalExamSessionStatus(input));
  }

  return setRemoteExamSessionStatus(input);
}
