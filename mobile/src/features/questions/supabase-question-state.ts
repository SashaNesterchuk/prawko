import type { QuestionSessionMode, SupportedLocale } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getQuestionSetKey } from "../../countries/runtime";
import { fetchAllSupabasePages } from "../../lib/fetch-all-supabase-pages";
import { getMobileSupabaseClient } from "../../lib/supabase";
import { createEmptyQuestionUserState } from "./question-engine";
import type { QuestionUserStateMap } from "./types";

type RelatedQuestionRef =
  | {
      question_source_id?: string | null;
      source_id?: string | null;
    }
  | Array<{
      question_source_id?: string | null;
      source_id?: string | null;
    }>
  | null;

type RemoteQuestionUserStateRow = {
  consecutive_correct: number;
  is_hard: boolean;
  is_mastered: boolean;
  last_correct_at: string | null;
  last_seen_at: string | null;
  last_wrong_at: string | null;
  mastery_score: number;
  question: RelatedQuestionRef;
  review_due_at: string | null;
  times_correct: number;
  times_seen: number;
  times_wrong: number;
};

type RemoteBookmarkRow = {
  question: RelatedQuestionRef;
};

type SyncBookmarkInput = {
  isBookmarked: boolean;
  metadata?: Record<string, unknown>;
  questionSourceId: string;
  savedFromMode?: QuestionSessionMode;
};

type SyncHardStateInput = {
  isHard: boolean;
  questionSourceId: string;
  reviewDueAt?: string | null;
};

export async function fetchRemoteQuestionUserStateMap() {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data: set, error: setError } = await client
    .from("question_sets")
    .select("id")
    .eq("key", getQuestionSetKey())
    .eq("is_active", true)
    .single();
  if (setError) throw setError;
  const questionStateSelect = [
    "times_seen",
    "times_correct",
    "times_wrong",
    "consecutive_correct",
    "last_seen_at",
    "last_correct_at",
    "last_wrong_at",
    "review_due_at",
    "is_hard",
    "is_mastered",
    "mastery_score",
    "question:questions_v2!inner(source_id)",
  ].join(", ");

  const [questionStateRows, bookmarkRows] = await Promise.all([
    fetchAllSupabasePages(async (from, to) => {
      const { data, error } = await client
        .from("question_user_state_v2")
        .select(questionStateSelect)
        .eq("question.question_set_id", set.id)
        .order("question_id", { ascending: true })
        .range(from, to);

      return {
        data: ((data ?? []) as unknown) as RemoteQuestionUserStateRow[],
        error,
      };
    }),
    fetchAllSupabasePages(async (from, to) => {
      const { data, error } = await client
        .from("bookmarks_v2")
        .select("question:questions_v2!inner(source_id)")
        .eq("question.question_set_id", set.id)
        .order("question_id", { ascending: true })
        .range(from, to);

      return {
        data: ((data ?? []) as unknown) as RemoteBookmarkRow[],
        error,
      };
    }),
  ]);

  return buildQuestionUserStateMap(questionStateRows, bookmarkRows);
}

export async function syncQuestionBookmarkState(input: SyncBookmarkInput) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { error } = await client.rpc("set_question_bookmark_state_by_source_id_v2", {
    p_question_set_key: getQuestionSetKey(),
    p_question_source_id: input.questionSourceId,
    p_is_bookmarked: input.isBookmarked,
    p_saved_from_mode: input.savedFromMode ?? null,
    p_metadata: toRpcJsonObject(input.metadata ?? {}),
  });

  if (error) {
    throw error;
  }
}

export async function syncQuestionHardState(input: SyncHardStateInput) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { error } = await client.rpc("set_question_hard_state_by_source_id_v2", {
    p_question_set_key: getQuestionSetKey(),
    p_question_source_id: input.questionSourceId,
    p_is_hard: input.isHard,
    p_review_due_at: input.reviewDueAt ?? null,
  });

  if (error) {
    throw error;
  }
}

function buildQuestionUserStateMap(
  questionStateRows: RemoteQuestionUserStateRow[],
  bookmarkRows: RemoteBookmarkRow[]
) {
  const questionUserState: QuestionUserStateMap = {};

  for (const row of questionStateRows) {
    const questionSourceId = getRelatedQuestionSourceId(row.question);

    if (!questionSourceId) {
      continue;
    }

    questionUserState[questionSourceId] = {
      ...createEmptyQuestionUserState(questionSourceId),
      consecutiveCorrect: row.consecutive_correct,
      isHard: row.is_hard,
      isMastered: row.is_mastered,
      lastCorrectAt: row.last_correct_at,
      lastSeenAt: row.last_seen_at,
      lastWrongAt: row.last_wrong_at,
      masteryScore: row.mastery_score,
      reviewDueAt: row.review_due_at,
      timesCorrect: row.times_correct,
      timesSeen: row.times_seen,
      timesWrong: row.times_wrong,
    };
  }

  for (const row of bookmarkRows) {
    const questionSourceId = getRelatedQuestionSourceId(row.question);

    if (!questionSourceId) {
      continue;
    }

    const currentState =
      questionUserState[questionSourceId] ??
      createEmptyQuestionUserState(questionSourceId);

    questionUserState[questionSourceId] = {
      ...currentState,
      isBookmarked: true,
    };
  }

  return questionUserState;
}

function getRelatedQuestionSourceId(question: RelatedQuestionRef) {
  if (Array.isArray(question)) {
    return getRelatedQuestionSourceId(question[0] ?? null);
  }

  const questionSourceId = question?.question_source_id ?? question?.source_id;

  return typeof questionSourceId === "string" && questionSourceId.trim()
    ? questionSourceId
    : null;
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
