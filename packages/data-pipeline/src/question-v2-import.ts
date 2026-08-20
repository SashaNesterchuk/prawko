import { createClient } from "@supabase/supabase-js";

import { loadLocalEnvFiles } from "./env";
import type { PipelineOptions } from "./types";

export const POLISH_V2_SET_KEY = "pl-v2-current";

type V1Question = Record<string, unknown>;

async function fetchAll<T>(load: (from: number, to: number) => Promise<{ data: T[]; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await load(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function localized(...values: Array<[string, unknown]>) {
  return Object.fromEntries(values.filter(([, value]) => typeof value === "string" && value.trim()).map(([locale, value]) => [locale, value]));
}

function asset(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }

export function toV2Question(row: V1Question, questionSetId: string) {
  const answerKind = row.answer_type === "boolean" ? "boolean" : "choice";
  const options = answerKind === "choice" ? ["A", "B", "C"].flatMap((id) => {
    const suffix = id.toLowerCase();
    const text = localized(["pl", row[`option_${suffix}`]], ["ua", row[`option_${suffix}_ua`]], ["en", row[`option_${suffix}_en`]], ["de", row[`option_${suffix}_de`]]);
    const media = asset(row[`pjm_answer_${suffix}_asset`]);
    return Object.keys(text).length || media ? [{ id, text, media: media ? [{ role: "pjm-answer", asset: media }] : [] }] : [];
  }) : [];
  const questionMedia = [
    asset(row.media_asset) ? { role: "primary", asset: asset(row.media_asset) } : null,
    asset(row.pjm_question_asset) ? { role: "pjm-question", asset: asset(row.pjm_question_asset) } : null,
  ].filter(Boolean);
  return {
    question_set_id: questionSetId,
    source_id: row.question_source_id,
    source_row_number: row.source_row_number,
    points: row.points,
    answer_kind: answerKind,
    correct_option_id: row.correct_answer,
    category_codes: row.categories ?? [],
    primary_topic_id: row.primary_topic_id ?? null,
    topic_ids: row.topic_ids ?? [],
    scope: row.scope ?? null,
    difficulty_seed: row.difficulty_seed ?? null,
    is_active: row.is_active ?? true,
    content: { prompt: localized(["pl", row.question_pl], ["ua", row.question_ua], ["en", row.question_en], ["de", row.question_de]), options, question_media: questionMedia },
    official_metadata: { legacy_question_id: row.id, legacy_answer_type: row.answer_type, legacy_topic_block: row.topic_block },
  };
}

function legacyExplanationRow(row: V1Question, questionId: string) {
  const explanations = localized(["pl", row.explanation_pl], ["ua", row.explanation_ua], ["en", row.explanation_en], ["de", row.explanation_de]);
  if (Object.keys(explanations).length === 0) return null;
  return {
    question_id: questionId, explanations, available_locales: Object.keys(explanations),
    explanation_version: "v1-legacy", source_context_version: null,
    source_context_updated_at: null, provider: "v1", model: null,
    confidence: null, needs_manual_review: false, reason: "Copied from v1 question explanation fields.",
  };
}

async function upsertInBatches(
  // Supabase's generated schema intentionally does not include a future v2
  // migration yet; table names are therefore dynamic in this service-role tool.
  supabase: any,
  table: string, rows: Record<string, unknown>[], onConflict: string, batchSize: number
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + batchSize), { onConflict });
    if (error) throw error;
  }
}

export async function importV1QuestionsToV2(options: PipelineOptions = {}) {
  await loadLocalEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let questionSetId = "00000000-0000-0000-0000-000000000000";
  if (!options.dryRun) {
    const { data: set, error: setError } = await supabase.from("question_sets").upsert({
      key: POLISH_V2_SET_KEY, country_code: "PL", source_name: "Prawko v1", source_version: "current",
      exam_config: { default_mode: "exam", question_count: 32, mini_test_question_count: 12, pass_ratio: 0.9189189189 },
    }, { onConflict: "key" }).select("id").single();
    if (setError) throw setError;
    questionSetId = set.id;
  }
  const questions = await fetchAll<V1Question>(async (from, to) => {
    const r = await supabase.from("questions").select("*").order("source_row_number").range(from, to); return { data: r.data ?? [], error: r.error };
  });
  const rows = questions.map((row) => toV2Question(row, questionSetId));
  if (!options.dryRun) {
    const size = options.batchSize ?? 200;
    await upsertInBatches(supabase, "questions_v2", rows, "question_set_id,source_id", size);
    const topicRows = await fetchAll<Record<string, unknown>>(async (from, to) => {
      const r = await supabase.from("question_topic_catalog").select("*").order("sort_order").range(from, to); return { data: r.data ?? [], error: r.error };
    });
    if (topicRows.length) {
      await upsertInBatches(supabase, "question_topic_catalog_v2", topicRows.map((topic) => ({
        question_set_id: questionSetId, topic_id: topic.id, sort_order: topic.sort_order,
        titles: localized(["pl", topic.title_pl], ["ua", topic.title_ua], ["en", topic.title_en], ["de", topic.title_de]),
        source_label: topic.source_label_ua ?? null, is_active: topic.is_active ?? true,
      })), "question_set_id,topic_id", size);
    }
    const v2Rows = await fetchAll<Record<string, unknown>>(async (from, to) => {
      const r = await supabase.from("questions_v2").select("id,source_id").eq("question_set_id", questionSetId).range(from, to); return { data: r.data ?? [], error: r.error };
    });
    const ids = new Map(v2Rows.map((row) => [String(row.source_id), String(row.id)]));
    const missingV2QuestionSourceIds = questions
      .map((row) => String(row.question_source_id))
      .filter((sourceId) => !ids.has(sourceId));
    const explanations = await fetchAll<Record<string, unknown>>(async (from, to) => {
      const r = await supabase.from("question_ai_explanations").select("*").order("source_row_number").range(from, to); return { data: r.data ?? [], error: r.error };
    });
    const legacyExplanationRows = questions.flatMap((row) => {
      const questionId = ids.get(String(row.question_source_id));
      return questionId ? [legacyExplanationRow(row, questionId)].filter(Boolean) : [];
    });
    if (legacyExplanationRows.length) {
      await upsertInBatches(supabase, "question_ai_explanations_v2", legacyExplanationRows as Record<string, unknown>[], "question_id", size);
    }
    const explanationRows = explanations.flatMap((row) => {
      const questionId = ids.get(String(row.question_source_id));
      return questionId ? [{ question_id: questionId, explanations: row.explanations, available_locales: row.available_locales, explanation_version: row.explanation_version, source_context_version: row.source_context_version, source_context_updated_at: row.source_context_updated_at, provider: row.provider, model: row.model, confidence: row.confidence, needs_manual_review: row.needs_manual_review, reason: row.reason }] : [];
    });
    if (explanationRows.length) await upsertInBatches(supabase, "question_ai_explanations_v2", explanationRows, "question_id", size);
    const mediaReferences = rows.reduce((total, row) => {
      const content = row.content as { question_media?: unknown[]; options?: Array<{ media?: unknown[] }> };
      return total + (content.question_media?.length ?? 0) + (content.options?.reduce((sum, option) => sum + (option.media?.length ?? 0), 0) ?? 0);
    }, 0);
    return { questionSetKey: POLISH_V2_SET_KEY, totalQuestions: rows.length, importedQuestionCount: ids.size, missingV2QuestionSourceIds, topicCount: topicRows.length, v1AiExplanationCount: explanationRows.length, legacyExplanationCount: legacyExplanationRows.length, mediaReferences, dryRun: false };
  }
  return { questionSetKey: POLISH_V2_SET_KEY, totalQuestions: rows.length, dryRun: true };
}
