import type { QuestionSessionMode, SupportedLocale } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import type { QuestionOptionValue } from "./types";

type RecordQuestionAttemptInput = {
  aiChatUsed?: boolean;
  answerDurationMs?: number | null;
  explanationOpened?: boolean;
  isCorrect: boolean;
  locale: SupportedLocale;
  metadata?: Record<string, unknown>;
  mode: QuestionSessionMode;
  questionSourceId: string;
  selectedAnswer: QuestionOptionValue;
  studyPlanId?: string | null;
};

export async function recordQuestionAttemptBySourceId(
  input: RecordQuestionAttemptInput
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("record_question_attempt_by_source_id", {
    p_question_source_id: input.questionSourceId,
    p_mode: input.mode,
    p_answer_given: input.selectedAnswer,
    p_is_correct: input.isCorrect,
    p_question_locale: input.locale,
    p_study_plan_id: input.studyPlanId ?? null,
    p_answer_duration_ms: input.answerDurationMs ?? null,
    p_explanation_opened: input.explanationOpened ?? false,
    p_ai_chat_used: input.aiChatUsed ?? false,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || data.trim().length === 0) {
    throw new Error(
      "record_question_attempt_by_source_id returned an empty response."
    );
  }

  return data;
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
