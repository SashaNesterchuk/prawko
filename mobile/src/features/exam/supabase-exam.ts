import { getCountryConfig, type CountryCode, type SupportedLocale } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import { getExamCountry } from "../../state/app-shell";
import type {
  RemoteExamSession,
  RemoteExamSessionStatus,
  RemoteExamSnapshot,
} from "./types";

type SubmitRemoteExamAnswerInput = {
  answerDurationMs?: number | null;
  answerGiven: string;
  locale: SupportedLocale;
  metadata?: Record<string, unknown>;
  questionOrder?: number | null;
  sessionId: string;
};

type SetRemoteExamSessionStatusInput = {
  metadata?: Record<string, unknown>;
  sessionId: string;
  status: Extract<RemoteExamSessionStatus, "abandoned" | "expired">;
};

export async function fetchExamSessionSnapshot(sessionId: string) {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_exam_session_snapshot_v2", {
    p_exam_session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

export async function fetchRecentExamSessions(
  limit = 5,
  country: CountryCode = getExamCountry()
): Promise<RemoteExamSession[]> {
  assertMobileSupabaseConfigured();

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("list_recent_exam_sessions_v2", {
    p_question_set_key: getCountryConfig(country).questionSetKey,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSessionList(data);
}

export async function submitRemoteExamAnswer(
  input: SubmitRemoteExamAnswerInput
): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("submit_exam_session_answer_v2", {
    p_exam_session_id: input.sessionId,
    p_answer_given: input.answerGiven,
    p_question_locale: input.locale,
    p_answer_duration_ms: input.answerDurationMs ?? null,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
    p_question_order: input.questionOrder ?? null,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

export async function setRemoteExamSessionStatus(
  input: SetRemoteExamSessionStatusInput
): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("set_exam_session_status_v2", {
    p_exam_session_id: input.sessionId,
    p_status: input.status,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

export async function setRemoteExamCurrentIndex(input: {
  questionOrder: number;
  sessionId: string;
}): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("set_exam_session_current_index_v2", {
    p_exam_session_id: input.sessionId,
    p_question_order: input.questionOrder,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

export async function setRemoteExamFlaggedOrders(input: {
  flaggedOrders: number[];
  sessionId: string;
}): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("set_exam_session_flags_v2", {
    p_exam_session_id: input.sessionId,
    p_flagged_orders: input.flaggedOrders,
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

export async function toggleRemoteExamFlag(input: {
  questionOrder: number;
  sessionId: string;
}): Promise<RemoteExamSnapshot> {
  const snapshot = await fetchExamSessionSnapshot(input.sessionId);
  const current = Array.isArray(snapshot.session.metadata.flaggedOrders)
    ? snapshot.session.metadata.flaggedOrders.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isInteger(entry)
      )
    : [];
  const flaggedOrders = current.includes(input.questionOrder)
    ? current.filter((order) => order !== input.questionOrder)
    : [...current, input.questionOrder];

  return setRemoteExamFlaggedOrders({
    flaggedOrders,
    sessionId: input.sessionId,
  });
}

export async function finishRemoteExamSession(input: {
  metadata?: Record<string, unknown>;
  sessionId: string;
}): Promise<RemoteExamSnapshot> {
  assertMobileSupabaseConfigured();

  const country = getExamCountry();
  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("finish_exam_session_v2", {
    p_exam_session_id: input.sessionId,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }

  return parseRemoteExamSnapshot(data, country);
}

function assertMobileSupabaseConfigured() {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
}

function parseRemoteExamSnapshot(value: unknown, country: CountryCode): RemoteExamSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Exam snapshot RPC returned an invalid payload.");
  }

  const snapshot = value as RemoteExamSnapshot;
  return { ...snapshot, session: {
    ...snapshot.session,
    metadata: { ...snapshot.session.metadata, exam_country: country },
  } };
}

function parseRemoteExamSessionList(value: unknown): RemoteExamSession[] {
  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Recent exam sessions RPC returned an invalid payload.");
  }

  return value as RemoteExamSession[];
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
