import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnvFiles } from "./env";
import type { PipelineOptions } from "./types";
import { readJsonFile, resolveRepoPath } from "./utils";

export const SLOVAK_V2_SET_KEY = "sk-v2-current";
export const DEFAULT_SLOVAK_IMPORT_DIR = resolveRepoPath("data/sk-questions-vodicak/supabase-import");

const SLOVAK_LICENCE_GROUPS = new Set([
  "AM", "A1", "A2", "A", "B1", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE", "T",
]);

type SlovakPreparedQuestion = {
  question_set_key: string;
  source_id: string;
  source_row_number: number;
  points: number;
  answer_kind: "choice";
  correct_option_id: "A" | "B" | "C";
  category_codes: string[];
  primary_topic_id: string;
  topic_ids: string[];
  scope: null;
  difficulty_seed: null;
  is_active: boolean;
  content: {
    prompt: { sk: string };
    options: Array<{ id: "A" | "B" | "C"; text: { sk: string }; media: unknown[] }>;
    question_media: unknown[];
  };
  official_metadata: Record<string, unknown>;
};

type SlovakTopicRow = {
  topic_id: string;
  sort_order: number;
  titles: { sk: string };
  source_label: string;
  is_active: boolean;
};

function positiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Slovak import: ${field} must be a positive integer.`);
  }
  return value;
}

function nonEmpty(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Slovak import: ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function parseQuestions(value: unknown): SlovakPreparedQuestion[] {
  if (!Array.isArray(value) || value.length !== 1416) {
    throw new Error("Slovak import: questions_v2.json must contain exactly 1,416 rows.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Slovak import: question ${index + 1} is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const content = row.content as SlovakPreparedQuestion["content"];
    if (!content || typeof content !== "object" || !content.prompt?.sk || !Array.isArray(content.options)) {
      throw new Error(`Slovak import: question ${index + 1} has invalid content.`);
    }
    if (row.question_set_key !== SLOVAK_V2_SET_KEY || row.answer_kind !== "choice" || !Array.isArray(row.category_codes) || !Array.isArray(row.topic_ids)) {
      throw new Error(`Slovak import: question ${index + 1} has invalid import metadata.`);
    }
    const optionIds = content.options.map((option) => option.id);
    if (optionIds.length !== 3 || new Set(optionIds).size !== 3 || !["A", "B", "C"].every((id) => optionIds.includes(id as "A" | "B" | "C"))) {
      throw new Error(`Slovak import: question ${index + 1} must have one A/B/C option set.`);
    }
    if (row.correct_option_id !== "A" && row.correct_option_id !== "B" && row.correct_option_id !== "C") {
      throw new Error(`Slovak import: question ${index + 1} has an invalid correct option.`);
    }
    if (!optionIds.includes(row.correct_option_id)) {
      throw new Error(`Slovak import: question ${index + 1} has no correct option in its option list.`);
    }
    if (row.category_codes.some((code) => typeof code !== "string" || !SLOVAK_LICENCE_GROUPS.has(code))) {
      throw new Error(`Slovak import: question ${index + 1} has an invalid licence group.`);
    }
    if (row.category_codes.length === 0 || typeof row.is_active !== "boolean" || !row.official_metadata || typeof row.official_metadata !== "object") {
      throw new Error(`Slovak import: question ${index + 1} has incomplete required metadata.`);
    }

    return {
      ...row,
      question_set_key: SLOVAK_V2_SET_KEY,
      source_id: nonEmpty(row.source_id, `question ${index + 1}.source_id`),
      source_row_number: positiveInteger(row.source_row_number, `question ${index + 1}.source_row_number`),
      points: positiveInteger(row.points, `question ${index + 1}.points`),
      correct_option_id: row.correct_option_id,
      category_codes: row.category_codes as string[],
      primary_topic_id: nonEmpty(row.primary_topic_id, `question ${index + 1}.primary_topic_id`),
      topic_ids: row.topic_ids as string[],
      is_active: row.is_active,
      answer_kind: "choice",
      content,
      official_metadata: row.official_metadata as Record<string, unknown>,
      scope: null,
      difficulty_seed: null,
    };
  });
}

function parseTopics(value: unknown): SlovakTopicRow[] {
  if (!Array.isArray(value) || value.length !== 10) {
    throw new Error("Slovak import: question_topic_catalog_v2.json must contain exactly 10 rows.");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Slovak import: topic ${index + 1} is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const titles = row.titles as { sk?: unknown };
    return {
      topic_id: nonEmpty(row.topic_id, `topic ${index + 1}.topic_id`),
      sort_order: positiveInteger(row.sort_order, `topic ${index + 1}.sort_order`),
      titles: { sk: nonEmpty(titles?.sk, `topic ${index + 1}.titles.sk`) },
      source_label: nonEmpty(row.source_label, `topic ${index + 1}.source_label`),
      is_active: row.is_active === true,
    };
  });
}

async function readPreparedImport(inputPath?: string) {
  const importDir = resolveRepoPath(inputPath ?? DEFAULT_SLOVAK_IMPORT_DIR);
  const stats = await fs.stat(importDir).catch(() => null);
  if (!stats?.isDirectory()) throw new Error(`Slovak import: input directory does not exist: ${importDir}`);
  const [questions, topics] = await Promise.all([
    readJsonFile<unknown>(path.join(importDir, "questions_v2.json")).then(parseQuestions),
    readJsonFile<unknown>(path.join(importDir, "question_topic_catalog_v2.json")).then(parseTopics),
  ]);
  const ids = new Set(questions.map((question) => question.source_id));
  const rows = new Set(questions.map((question) => question.source_row_number));
  const topicIds = new Set(topics.map((topic) => topic.topic_id));
  if (ids.size !== questions.length || rows.size !== questions.length) throw new Error("Slovak import: duplicate source IDs or source row numbers.");
  if (questions.some((question) => !topicIds.has(question.primary_topic_id) || question.topic_ids.some((topicId) => !topicIds.has(topicId)))) {
    throw new Error("Slovak import: a question references an unknown topic.");
  }
  return { importDir, questions, topics };
}

async function fetchAllSourceIds(supabase: any, questionSetId: string) {
  const rows: Array<{ source_id: string }> = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("questions_v2").select("source_id").eq("question_set_id", questionSetId).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) return new Set(rows.map((row) => String(row.source_id)));
  }
}

/** Imports a prepared Slovak text catalogue only; it never uploads local media. */
export async function importSlovakQuestionsToV2(options: PipelineOptions = {}) {
  const prepared = await readPreparedImport(options.inputPath);
  const mediaReferenceCount = prepared.questions.reduce(
    (count, question) => count + question.content.question_media.length,
    0
  );
  if (options.dryRun) {
    return {
      questionSetKey: SLOVAK_V2_SET_KEY,
      inputDir: prepared.importDir,
      totalQuestions: prepared.questions.length,
      totalOptions: prepared.questions.length * 3,
      topicCount: prepared.topics.length,
      preparedMediaReferenceCount: mediaReferenceCount,
      r2UploadPending: true,
      mediaReferences: mediaReferenceCount,
      dryRun: true,
    };
  }

  await loadLocalEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: questionSet, error: questionSetError } = await supabase.from("question_sets").select("id").eq("key", SLOVAK_V2_SET_KEY).single();
  if (questionSetError || !questionSet) {
    throw new Error('Slovak import: question set "sk-v2-current" is missing. Apply the prepared migration first.');
  }

  const questionSetId = String(questionSet.id);
  const batchSize = options.batchSize ?? 200;
  const topicRows = prepared.topics.map((topic) => ({ ...topic, question_set_id: questionSetId }));
  const questionRows = prepared.questions.map(({ question_set_key: _key, ...question }) => ({ ...question, question_set_id: questionSetId }));
  for (let index = 0; index < topicRows.length; index += batchSize) {
    const { error } = await supabase
      .from("question_topic_catalog_v2")
      .upsert(topicRows.slice(index, index + batchSize), {
        onConflict: "question_set_id,topic_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  for (let index = 0; index < questionRows.length; index += batchSize) {
    const { error } = await supabase
      .from("questions_v2")
      .upsert(questionRows.slice(index, index + batchSize), {
        onConflict: "question_set_id,source_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  const importedIds = await fetchAllSourceIds(supabase, questionSetId);
  const missingSourceIds = prepared.questions.map((question) => question.source_id).filter((sourceId) => !importedIds.has(sourceId));
  return {
    questionSetKey: SLOVAK_V2_SET_KEY,
    inputDir: prepared.importDir,
    totalQuestions: prepared.questions.length,
    totalOptions: prepared.questions.length * 3,
    importedQuestionCount: prepared.questions.length - missingSourceIds.length,
    missingSourceIds,
    topicCount: prepared.topics.length,
    preparedMediaReferenceCount: mediaReferenceCount,
    r2UploadPending: true,
    mediaReferences: mediaReferenceCount,
    dryRun: false,
  };
}
