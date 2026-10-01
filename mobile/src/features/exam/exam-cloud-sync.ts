import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCountryConfig, type CountryCode } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import { useAppShellStore } from "../../state/app-shell";
import { getLocalExamCloudId, isLocalExamSessionId } from "./exam-session-id";
import {
  cacheExamSnapshot,
  loadPersistedExamHistory,
  loadPersistedExamSnapshot,
  mergePersistedExamHistory,
} from "./exam-snapshot-cache";
import { fetchRecentExamSessions as fetchCloudHistory } from "./supabase-exam";
import type { RemoteExamSession, RemoteExamSnapshot } from "./types";

function syncedIdsKey(country: CountryCode, userId: string) {
  return `prawko.exam.${country}.cloudSynced:${userId}`;
}

function isCurrentUser(userId: string) {
  const state = useAppShellStore.getState();
  return state.authMode === "supabase" && state.supabaseUser?.id === userId;
}

async function readSyncedIds(country: CountryCode, userId: string) {
  const raw = await AsyncStorage.getItem(syncedIdsKey(country, userId));
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  return new Set<string>(Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string")
    : []);
}

/** Only this account's pending exam progress may override a lagging hydration. */
export async function getPendingExamQuestionIds(country: CountryCode, userId: string) {
  const synced = await readSyncedIds(country, userId);
  const history = await loadPersistedExamHistory(country);
  const ids = new Set<string>();
  for (const session of history) {
    if (session.metadata.owner_user_id !== userId || synced.has(session.id)) { continue; }
    const snapshot = await loadPersistedExamSnapshot(session.id, country);
    for (const answer of snapshot?.answers ?? []) {
      ids.add(answer.questionSourceId);
    }
  }
  return ids;
}

/** Finished snapshots themselves are a durable outbox; retry uses stable IDs. */
export async function syncPendingExamResults(country: CountryCode, userId: string) {
  if (!isMobileSupabaseConfigured || !isCurrentUser(userId)) {
    return;
  }
  const synced = await readSyncedIds(country, userId);
  const history = await loadPersistedExamHistory(country);
  for (const session of history) {
    if (session.status === "active" || session.totalQuestionsAnswered === 0 || !isLocalExamSessionId(session.id) ||
        session.metadata.owner_user_id !== userId || synced.has(session.id)) {
      continue;
    }
    if (!isCurrentUser(userId)) {
      return;
    }
    const snapshot = await loadPersistedExamSnapshot(session.id, country);
    if (!snapshot || snapshot.session.status === "active") {
      continue;
    }
    try {
      await uploadFinishedSnapshot(snapshot, country, userId);
      synced.add(session.id);
      await AsyncStorage.setItem(syncedIdsKey(country, userId), JSON.stringify([...synced]));
    } catch (error) {
      // One unavailable historical question must not block every other exam
      // or country. Keep this result in the outbox for a later retry.
      console.warn(`Deferred exam result sync: ${session.id}.`, error);
    }
  }
}

async function uploadFinishedSnapshot(
  snapshot: RemoteExamSnapshot,
  country: CountryCode,
  userId: string
) {
  const client = getMobileSupabaseClient();
  const { data: set, error: setError } = await client.from("question_sets")
    .select("id").eq("key", getCountryConfig(country).questionSetKey).single();
  if (setError) { throw setError; }
  if (!set?.id) { throw new Error("Exam sync question set was not found."); }

  const sourceIds = snapshot.questions.map((question) => question.questionSourceId);
  const { data: questions, error: questionsError } = await client.from("questions_v2")
    .select("id, source_id").eq("question_set_id", set.id).in("source_id", sourceIds);
  if (questionsError) { throw questionsError; }
  const bySource = new Map((questions ?? []).map((question) => [question.source_id, question.id]));
  const questionIds = sourceIds.map((sourceId) => {
    const id = bySource.get(sourceId);
    if (!id) { throw new Error(`Exam sync could not resolve question ${sourceId}.`); }
    return id;
  });
  const cloudId = getLocalExamCloudId(snapshot.session.id);
  if (!isCurrentUser(userId)) { throw new Error("Exam sync account changed."); }

  // Do not write exam_session_answers_v2: its triggers run the legacy engine.
  // Store final question attempts once and back up the client-computed snapshot.
  const attempts = snapshot.answers.map((answer) => ({
    id: answer.questionAttemptId,
    user_id: userId,
    question_id: bySource.get(answer.questionSourceId),
    selected_answer: answer.answerGiven,
    is_correct: answer.isCorrect,
    mode: snapshot.session.mode,
    question_locale: snapshot.session.sessionLocale,
    answer_duration_ms: answer.answerDurationMs ?? null,
    answered_at: answer.answeredAt,
    metadata: {
      source: "mobile_local_exam_sync",
      exam_session_id: cloudId,
      client_session_id: snapshot.session.id,
      study_plan_task_id: snapshot.session.metadata.study_plan_task_id ?? null,
    },
  }));
  if (attempts.some((attempt) => !attempt.id || !attempt.question_id)) {
    throw new Error("Exam sync requires stable question-attempt IDs.");
  }
  if (attempts.length > 0) {
    const { error } = await client.from("question_attempts_v2")
      .upsert(attempts, { onConflict: "id", ignoreDuplicates: true });
    if (error) { throw error; }
  }
  if (!isCurrentUser(userId)) { throw new Error("Exam sync account changed."); }

  const session = snapshot.session;
  const { error } = await client.from("exam_sessions_v2").upsert({
    id: cloudId,
    user_id: userId,
    question_set_id: set.id,
    question_ids: questionIds,
    mode: session.mode,
    current_category: session.currentCategory,
    session_locale: session.sessionLocale,
    current_question_index: session.currentQuestionIndex,
    total_questions_answered: session.totalQuestionsAnswered,
    correct_answers_count: session.correctAnswersCount,
    wrong_answers_count: session.wrongAnswersCount,
    passed: session.passed,
    started_at: session.startedAt,
    finished_at: session.finishedAt,
    expires_at: session.expiresAt,
    status: session.status,
    total_questions_target: session.totalQuestionsTarget,
    total_points_target: session.totalPointsTarget,
    pass_points: session.passPoints,
    score_points: session.scorePoints,
    metadata: {
      ...session.metadata,
      question_set_key: getCountryConfig(country).questionSetKey,
      local_exam_id: session.id,
      local_exam_snapshot: snapshot,
    },
  }, { onConflict: "id" });
  if (error) { throw error; }
}

/** Import saved local backups and old server summaries without creating exams. */
export async function importCloudExamHistory(country: CountryCode, userId: string) {
  if (!isMobileSupabaseConfigured || !isCurrentUser(userId)) { return; }
  const history = await fetchCloudHistory(50, country);
  if (!isCurrentUser(userId)) { return; }
  const synced = await readSyncedIds(country, userId);
  const legacy: RemoteExamSession[] = [];
  for (const session of history) {
    if (!isCurrentUser(userId)) { return; }
    if (session.status === "active") { continue; }
    const backup = session.metadata.local_exam_snapshot as RemoteExamSnapshot | undefined;
    if (backup && isLocalExamSessionId(backup.session?.id) &&
        backup.session.status !== "active" && Array.isArray(backup.questions) &&
        Array.isArray(backup.answers)) {
      const existing = await loadPersistedExamSnapshot(backup.session.id, country);
      if (!isCurrentUser(userId)) { return; }
      if (!existing) {
        cacheExamSnapshot({ ...backup, session: {
          ...backup.session,
          metadata: { ...backup.session.metadata, owner_user_id: userId, exam_country: country },
        } }, country);
      }
      synced.add(backup.session.id);
    } else {
      legacy.push({ ...session, metadata: {
        ...session.metadata, owner_user_id: userId, exam_country: country,
      } });
    }
  }
  if (!isCurrentUser(userId)) { return; }
  await mergePersistedExamHistory(legacy, country);
  await AsyncStorage.setItem(syncedIdsKey(country, userId), JSON.stringify([...synced]));
}
