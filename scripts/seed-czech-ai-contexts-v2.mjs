#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const preparedRoot = path.join(workspaceRoot, "czech-etesty-supabase-import-2026-08-19");
const requireFromPipeline = createRequire(path.join(repoRoot, "packages", "data-pipeline", "package.json"));
const { createClient } = requireFromPipeline("@supabase/supabase-js");

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]] : [];
  }));
}

const env = parseEnv(await readFile(path.join(repoRoot, ".env.local"), "utf8"));
const supabase = createClient(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const [questions, options, media] = await Promise.all([
  readJson(path.join(preparedRoot, "questions.json")),
  readJson(path.join(preparedRoot, "question_options.json")),
  readJson(path.join(preparedRoot, "question_media.json")),
]);
const optionsByQuestion = groupBy(options, "question_source_id");
const mediaByQuestion = groupBy(media, "question_source_id");
for (const value of optionsByQuestion.values()) value.sort((a, b) => a.sort_order - b.sort_order);

const { data: set, error: setError } = await supabase.from("question_sets").select("id").eq("key", "cz-v2-current").single();
if (setError || !set) throw setError ?? new Error("Missing Czech question set.");
const remote = await fetchAll(supabase, set.id);
const remoteBySource = new Map(remote.map((row) => [row.source_id, row.id]));
const sourceQuestions = Array.isArray(questions) ? questions : questions.questions;
if (sourceQuestions.length !== 1136) throw new Error(`Expected 1,136 questions, got ${sourceQuestions.length}.`);

const now = new Date().toISOString();
const rows = sourceQuestions.map((question) => {
  const questionMedia = mediaByQuestion.get(question.question_source_id) ?? [];
  const questionId = remoteBySource.get(question.question_source_id);
  if (!questionId) throw new Error(`Question missing in v2: ${question.question_source_id}`);
  return {
    question_id: questionId,
    context_version: "cz-source-context-v1",
    media_fingerprint: questionMedia.length ? JSON.stringify(questionMedia.map((item) => [item.media_key, item.official_media_hash])) : null,
    needs_manual_review: questionMedia.length > 0,
    source_updated_at: now,
    context: {
      prompt_cs: question.question_cs,
      answers: (optionsByQuestion.get(question.question_source_id) ?? []).map((option) => ({ id: option.option_key, text_cs: option.text_cs, is_correct: option.is_correct })),
      media: questionMedia.map((item) => ({ placement: item.placement, option_key: item.option_key, media_type: item.media_type, filename: item.original_filename })),
      visual_analysis: questionMedia.length ? { status: "pending_vision" } : { status: "not_applicable" },
      verified_signs: [],
      decisive_facts_cs: [],
    },
  };
});

for (let index = 0; index < rows.length; index += 100) {
  const { error } = await supabase.from("question_ai_contexts_v2").upsert(rows.slice(index, index + 100), { onConflict: "question_id" });
  if (error) throw error;
}
const { count, error: countError } = await supabase.from("question_ai_contexts_v2").select("question:questions_v2!inner(question_set_id)", { count: "exact", head: true }).eq("question.question_set_id", set.id);
if (countError || count !== 1136) throw countError ?? new Error(`Expected 1,136 contexts, got ${count}.`);
console.log(JSON.stringify({ seededContexts: count, pendingVision: rows.filter((row) => row.needs_manual_review).length, textOnlyContexts: rows.filter((row) => !row.needs_manual_review).length }, null, 2));

function groupBy(rows, key) { const map = new Map(); for (const row of rows) { const values = map.get(row[key]) ?? []; values.push(row); map.set(row[key], values); } return map; }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }
async function fetchAll(client, questionSetId) { const rows = []; for (let from = 0; ; from += 500) { const { data, error } = await client.from("questions_v2").select("id,source_id").eq("question_set_id", questionSetId).range(from, from + 499); if (error) throw error; rows.push(...(data ?? [])); if (!data || data.length < 500) return rows; } }
