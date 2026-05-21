import type { QuestionSessionMode, SupportedLocale } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import { createEmptyQuestionUserState } from "./question-engine";
import type { QuestionUserStateMap } from "./types";

type RelatedQuestionRef =
  | {
      question_source_id?: string | null;
    }
  | Array<{
      question_source_id?: string | null;
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
  const [questionStateResult, bookmarksResult] = await Promise.all([
    client
      .from("question_user_state")
      .select(
        [
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
          "question:questions!inner(question_source_id)",
        ].join(", ")
      ),
    client
      .from("bookmarks")
      .select("question:questions!inner(question_source_id)"),
  ]);

  if (questionStateResult.error) {
    throw questionStateResult.error;
  }

  if (bookmarksResult.error) {
    throw bookmarksResult.error;
  }

  const questionUserState = buildQuestionUserStateMap(
    ((questionStateResult.data ?? []) as unknown) as RemoteQuestionUserStateRow[],
    ((bookmarksResult.data ?? []) as unknown) as RemoteBookmarkRow[]
  );

  return questionUserState;
}

export async function syncQuestionBookmarkState(input: SyncBookmarkInput) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { error } = await client.rpc("set_question_bookmark_state_by_source_id", {
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
  const { error } = await client.rpc("set_question_hard_state_by_source_id", {
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

  const questionSourceId = question?.question_source_id;

  return typeof questionSourceId === "string" && questionSourceId.trim()
    ? questionSourceId
    : null;
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
