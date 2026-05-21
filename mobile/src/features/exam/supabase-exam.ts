import type { DrivingCategory, SupportedLocale } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import type {
  ExamSimulatorMode,
  RemoteExamSessionStatus,
  RemoteExamSnapshot,
} from "./types";

type StartRemoteExamInput = {
  category: DrivingCategory;
  locale: SupportedLocale;
  mode: ExamSimulatorMode;
  replaceExisting?: boolean;
  requestedTotalQuestions?: number | null;
  studyPlanId?: string | null;
  studyPlanTaskId?: string | null;
};

type SubmitRemoteExamAnswerInput = {
  answerDurationMs?: number | null;
  answerGiven: string;
  locale: SupportedLocale;
  metadata?: Record<string, unknown>;
  sessionId: string;
};

type SetRemoteExamSessionStatusInput = {
  metadata?: Record<string, unknown>;
  sessionId: string;
  status: Extract<RemoteExamSessionStatus, "abandoned" | "expired">;
};

export async function startRemoteExamSession(
  input: StartRemoteExamInput
): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("start_exam_session", {
    p_mode: input.mode,
    p_session_locale: input.locale,
    p_current_category: input.category,
    p_requested_total_questions: input.requestedTotalQuestions ?? null,
    p_study_plan_id: input.studyPlanId ?? null,
    p_metadata: toRpcJsonObject({
      source: "mobile_exam_flow",
      study_plan_task_id: input.studyPlanTaskId ?? null,
    }),
    p_replace_existing: input.replaceExisting ?? false,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data);
}

export async function fetchExamSessionSnapshot(sessionId: string) {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_exam_session_snapshot", {
    p_exam_session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data);
}

export async function fetchLatestActiveExamSession(mode?: ExamSimulatorMode | null) {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_latest_active_exam_session", {
    p_mode: mode ?? null,
  });

  if (error) {
    throw error;
  }

  if (data === null) {
    return null;
  }

  return parseRemoteExamSnapshot(data);
}

export async function submitRemoteExamAnswer(
  input: SubmitRemoteExamAnswerInput
): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("submit_exam_session_answer", {
    p_exam_session_id: input.sessionId,
    p_answer_given: input.answerGiven,
    p_question_locale: input.locale,
    p_answer_duration_ms: input.answerDurationMs ?? null,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data);
}

export async function setRemoteExamSessionStatus(
  input: SetRemoteExamSessionStatusInput
): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("set_exam_session_status", {
    p_exam_session_id: input.sessionId,
    p_status: input.status,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data);
}

function assertMobileSupabaseConfigured() {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
}

function parseRemoteExamSnapshot(value: unknown): RemoteExamSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Exam snapshot RPC returned an invalid payload.");
  }

  return value as RemoteExamSnapshot;
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
