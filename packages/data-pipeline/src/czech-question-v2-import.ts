import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnvFiles } from "./env";
import type { PipelineOptions } from "./types";
import { readJsonFile, resolveRepoPath } from "./utils";

export const CZECH_V2_SET_KEY = "cz-v2-current";
export const DEFAULT_CZECH_IMPORT_DIR = resolveRepoPath(
  "../czech-etesty-supabase-import-2026-08-19"
);

type CzechPreparedQuestion = {
  question_source_id: string;
  source_row_number: number;
  question_cs: string;
  answer_type: "choice";
  correct_option_key: "A" | "B" | "C";
  option_count: number;
  points: number;
  official_basket_scope_id: number;
  official_basket_scope_order: number;
  has_media: boolean;
  is_active: boolean;
  official_metadata: Record<string, unknown>;
};

type CzechPreparedOption = {
  question_source_id: string;
  option_key: "A" | "B" | "C";
  sort_order: number;
  text_cs: string;
  is_correct: boolean;
  official_answer_id: number;
};

type CzechV2QuestionRow = {
  question_set_id: string;
  source_id: string;
  source_row_number: number;
  points: number;
  answer_kind: "choice";
  correct_option_id: "A" | "B" | "C";
  category_codes: string[];
  primary_topic_id: null;
  topic_ids: string[];
  scope: null;
  difficulty_seed: null;
  is_active: boolean;
  content: {
    prompt: { cs: string };
    options: Array<{
      id: "A" | "B" | "C";
      text: { cs: string };
      media: [];
    }>;
    question_media: [];
  };
  official_metadata: Record<string, unknown>;
};

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Czech import: ${field} must be a non-empty string.`);
  }

  return value.trim();
}

function assertPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Czech import: ${field} must be a positive integer.`);
  }

  return value;
}

function assertOptionKey(value: unknown, field: string): "A" | "B" | "C" {
  if (value === "A" || value === "B" || value === "C") {
    return value;
  }

  throw new Error(`Czech import: ${field} must be A, B, or C.`);
}

function parseQuestions(value: unknown): CzechPreparedQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error("Czech import: questions.json must contain an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Czech import: questions.json entry ${index + 1} is invalid.`);
    }

    const row = entry as Record<string, unknown>;
    const metadata = row.official_metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error(`Czech import: question ${index + 1} has invalid official_metadata.`);
    }

    const optionCount = assertPositiveInteger(row.option_count, `question ${index + 1}.option_count`);
    if (optionCount < 2 || optionCount > 3) {
      throw new Error(`Czech import: question ${index + 1} must have two or three options.`);
    }

    if (row.answer_type !== "choice") {
      throw new Error(`Czech import: question ${index + 1} has unsupported answer_type.`);
    }

    if (typeof row.has_media !== "boolean" || typeof row.is_active !== "boolean") {
      throw new Error(`Czech import: question ${index + 1} has invalid boolean metadata.`);
    }

    return {
      question_source_id: assertNonEmptyString(row.question_source_id, `question ${index + 1}.question_source_id`),
      source_row_number: assertPositiveInteger(row.source_row_number, `question ${index + 1}.source_row_number`),
      question_cs: assertNonEmptyString(row.question_cs, `question ${index + 1}.question_cs`),
      answer_type: "choice",
      correct_option_key: assertOptionKey(row.correct_option_key, `question ${index + 1}.correct_option_key`),
      option_count: optionCount,
      points: assertPositiveInteger(row.points, `question ${index + 1}.points`),
      official_basket_scope_id: assertPositiveInteger(row.official_basket_scope_id, `question ${index + 1}.official_basket_scope_id`),
      official_basket_scope_order: typeof row.official_basket_scope_order === "number" && Number.isInteger(row.official_basket_scope_order)
        ? row.official_basket_scope_order
        : 0,
      has_media: row.has_media,
      is_active: row.is_active,
      official_metadata: metadata as Record<string, unknown>,
    };
  });
}

function parseOptions(value: unknown): CzechPreparedOption[] {
  if (!Array.isArray(value)) {
    throw new Error("Czech import: question_options.json must contain an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Czech import: question_options.json entry ${index + 1} is invalid.`);
    }

    const row = entry as Record<string, unknown>;
    if (typeof row.is_correct !== "boolean") {
      throw new Error(`Czech import: option ${index + 1}.is_correct must be boolean.`);
    }

    return {
      question_source_id: assertNonEmptyString(row.question_source_id, `option ${index + 1}.question_source_id`),
      option_key: assertOptionKey(row.option_key, `option ${index + 1}.option_key`),
      sort_order: assertPositiveInteger(row.sort_order, `option ${index + 1}.sort_order`),
      text_cs: assertNonEmptyString(row.text_cs, `option ${index + 1}.text_cs`),
      is_correct: row.is_correct,
      official_answer_id: assertPositiveInteger(row.official_answer_id, `option ${index + 1}.official_answer_id`),
    };
  });
}

export function toCzechV2Question(
  question: CzechPreparedQuestion,
  options: CzechPreparedOption[],
  questionSetId: string
): CzechV2QuestionRow {
  const sortedOptions = [...options].sort((left, right) => left.sort_order - right.sort_order);

  if (sortedOptions.length !== question.option_count) {
    throw new Error(`Czech import: ${question.question_source_id} declares ${question.option_count} options but has ${sortedOptions.length}.`);
  }

  const optionIds = new Set(sortedOptions.map((option) => option.option_key));
  const sortOrders = new Set(sortedOptions.map((option) => option.sort_order));
  if (
    optionIds.size !== sortedOptions.length ||
    sortOrders.size !== sortedOptions.length ||
    !optionIds.has(question.correct_option_key)
  ) {
    throw new Error(`Czech import: ${question.question_source_id} has duplicate options or a missing correct option.`);
  }

  const correctOptions = sortedOptions.filter((option) => option.is_correct);
  if (correctOptions.length !== 1 || correctOptions[0]?.option_key !== question.correct_option_key) {
    throw new Error(`Czech import: ${question.question_source_id} has inconsistent correct-answer data.`);
  }

  return {
    question_set_id: questionSetId,
    source_id: question.question_source_id,
    source_row_number: question.source_row_number,
    points: question.points,
    answer_kind: "choice",
    correct_option_id: question.correct_option_key,
    // The official published collection at id=99 is the Czech B catalogue.
    category_codes: ["B"],
    // Basket scopes are preserved below exactly as received. They have no
    // verified one-to-one mapping to Prawko topics, so no synthetic topics or
    // Polish exam scopes are introduced here.
    primary_topic_id: null,
    topic_ids: [],
    scope: null,
    difficulty_seed: null,
    is_active: question.is_active,
    content: {
      prompt: { cs: question.question_cs },
      options: sortedOptions.map((option) => ({
        id: option.option_key,
        text: { cs: option.text_cs },
        media: [],
      })),
      // Media is deliberately omitted from the first import. R2 paths are
      // deployment configuration, not part of this text-only source import.
      question_media: [],
    },
    official_metadata: {
      ...question.official_metadata,
      official_basket_scope_id: question.official_basket_scope_id,
      official_basket_scope_order: question.official_basket_scope_order,
      official_media_available: question.has_media,
      official_answer_ids: Object.fromEntries(
        sortedOptions.map((option) => [option.option_key, option.official_answer_id])
      ),
    },
  };
}

async function readCzechImport(inputPath?: string) {
  const importDir = resolveRepoPath(inputPath ?? DEFAULT_CZECH_IMPORT_DIR);
  const directoryStats = await fs.stat(importDir).catch(() => null);
  if (!directoryStats?.isDirectory()) {
    throw new Error(`Czech import: input directory does not exist: ${importDir}`);
  }

  const [rawQuestions, rawOptions] = await Promise.all([
    readJsonFile<unknown>(path.join(importDir, "questions.json")),
    readJsonFile<unknown>(path.join(importDir, "question_options.json")),
  ]);

  return {
    importDir,
    questions: parseQuestions(rawQuestions),
    options: parseOptions(rawOptions),
  };
}

async function fetchAll<T>(load: (from: number, to: number) => Promise<{ data: T[]; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await load(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

async function upsertInBatches(
  supabase: any,
  rows: CzechV2QuestionRow[],
  batchSize: number
) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const { error } = await supabase
      .from("questions_v2")
      .upsert(rows.slice(index, index + batchSize), {
        onConflict: "question_set_id,source_id",
      });
    if (error) throw error;
  }
}

/** Imports Czech question text/options only. It never reads or writes R2. */
export async function importCzechQuestionsToV2(options: PipelineOptions = {}) {
  const prepared = await readCzechImport(options.inputPath);
  const questionIds = new Set<string>();
  const optionsByQuestion = new Map<string, CzechPreparedOption[]>();

  for (const question of prepared.questions) {
    if (questionIds.has(question.question_source_id)) {
      throw new Error(`Czech import: duplicate question source id ${question.question_source_id}.`);
    }
    questionIds.add(question.question_source_id);
  }

  for (const option of prepared.options) {
    if (!questionIds.has(option.question_source_id)) {
      throw new Error(`Czech import: option references unknown question ${option.question_source_id}.`);
    }
    const current = optionsByQuestion.get(option.question_source_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.question_source_id, current);
  }

  const rows = prepared.questions.map((question) =>
    toCzechV2Question(question, optionsByQuestion.get(question.question_source_id) ?? [], "00000000-0000-0000-0000-000000000000")
  );
  const deferredMediaQuestionCount = prepared.questions.filter((question) => question.has_media).length;

  if (options.dryRun) {
    return {
      questionSetKey: CZECH_V2_SET_KEY,
      inputDir: prepared.importDir,
      totalQuestions: rows.length,
      totalOptions: prepared.options.length,
      deferredMediaQuestionCount,
      mediaReferences: 0,
      dryRun: true,
    };
  }

  await loadLocalEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: questionSet, error: questionSetError } = await supabase
    .from("question_sets")
    .select("id")
    .eq("key", CZECH_V2_SET_KEY)
    .single();
  if (questionSetError || !questionSet) {
    throw new Error(`Czech import: question set "${CZECH_V2_SET_KEY}" is missing. Apply migration 20260820100000_create_czech_question_set.sql first.`);
  }

  const questionSetId = String(questionSet.id);
  const rowsWithSetId = rows.map((row) => ({ ...row, question_set_id: questionSetId }));
  const batchSize = options.batchSize ?? 200;
  await upsertInBatches(supabase, rowsWithSetId, batchSize);

  const importedRows = await fetchAll<Record<string, unknown>>(async (from, to) => {
    const response = await supabase
      .from("questions_v2")
      .select("source_id")
      .eq("question_set_id", questionSetId)
      .range(from, to);
    return { data: response.data ?? [], error: response.error };
  });
  const importedIds = new Set(importedRows.map((row) => String(row.source_id)));
  const missingSourceIds = rows
    .map((row) => row.source_id)
    .filter((sourceId) => !importedIds.has(sourceId));

  return {
    questionSetKey: CZECH_V2_SET_KEY,
    inputDir: prepared.importDir,
    totalQuestions: rows.length,
    totalOptions: prepared.options.length,
    importedQuestionCount: rows.length - missingSourceIds.length,
    missingSourceIds,
    topicCount: 0,
    deferredMediaQuestionCount,
    mediaReferences: 0,
    dryRun: false,
  };
}
