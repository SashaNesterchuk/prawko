#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const manualPath = path.join(repoRoot, "data", "questions", "exports", "generated", "czech-manual-contexts-v1.json");
const requireFromPipeline = createRequire(path.join(repoRoot, "packages", "data-pipeline", "package.json"));
const { createClient } = requireFromPipeline("@supabase/supabase-js");
const env = Object.fromEntries((await readFile(path.join(repoRoot, ".env.local"), "utf8")).split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]] : [];
}));
const knownCodes = new Set((JSON.parse(await readFile(path.join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu", "manifest.json"), "utf8")).signs ?? []).map((sign) => sign.id));
const manual = JSON.parse(await readFile(manualPath, "utf8"));
const supabase = createClient(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: set, error: setError } = await supabase.from("question_sets").select("id").eq("key", "cz-v2-current").single();
if (setError || !set) throw setError ?? new Error("Missing Czech set.");
const questions = await fetchAllQuestions();
const existingContexts = await fetchAllContexts();
const bySource = new Map(questions.map((question) => [question.source_id, question]));
const contextByQuestionId = new Map(existingContexts.map((context) => [context.question_id, context.context]));
const now = new Date().toISOString();
const contextRows = [];
const explanationRows = [];
for (const entry of manual.rows) {
  const question = bySource.get(entry.questionSourceId);
  if (!question) throw new Error(`Unknown Czech question: ${entry.questionSourceId}`);
  const manuallyReviewed = entry.reviewStatus !== "official-text-only";
  const codes = entry.signs.map((sign) => sign.code);
  if (codes.some((code) => !knownCodes.has(code))) throw new Error(`Unknown Czech sign code in ${entry.questionSourceId}.`);
  if (codes.some((code) => !entry.explanationCs.includes(code) || !entry.explanationEn.includes(code))) throw new Error(`Code absent from explanation in ${entry.questionSourceId}.`);
  contextRows.push({
    question_id: question.id,
    context: {
      ...(contextByQuestionId.get(question.id) ?? {}),
      visual_analysis: {
        status: manuallyReviewed ? "manually_verified" : "official_text_only",
        scene_cs: entry.sceneCs,
        scene_en: entry.sceneEn,
      },
      decisive_facts_cs: entry.decisiveFactsCs,
      decisive_facts_en: entry.decisiveFactsEn,
      verified_signs: entry.signs,
    },
    context_version: manuallyReviewed ? "cz-manual-context-v1" : "cz-official-text-context-v1",
    needs_manual_review: !manuallyReviewed,
    source_updated_at: now,
  });
  explanationRows.push({
    question_id: question.id,
    explanations: { cs: entry.explanationCs, en: entry.explanationEn },
    available_locales: ["cs", "en"],
    explanation_version: manuallyReviewed ? "cz-manual-explanation-v1" : "cz-official-text-explanation-v1",
    source_context_version: manuallyReviewed ? "cz-manual-context-v1" : "cz-official-text-context-v1",
    source_context_updated_at: now,
    provider: "manual-local",
    model: manuallyReviewed ? "codex" : "local-official-source",
    confidence: manuallyReviewed ? 0.95 : 0.75,
    needs_manual_review: !manuallyReviewed,
    reason: manuallyReviewed ? "manually-reviewed-local-context" : "official-question-answer-local-context",
  });
}
for (let index = 0; index < contextRows.length; index += 100) {
  const { error } = await supabase.from("question_ai_contexts_v2").upsert(contextRows.slice(index, index + 100), { onConflict: "question_id" });
  if (error) throw error;
  const { error: explanationError } = await supabase.from("question_ai_explanations_v2").upsert(explanationRows.slice(index, index + 100), { onConflict: "question_id" });
  if (explanationError) throw explanationError;
}
console.log(JSON.stringify({ syncedContexts: contextRows.length, manuallyReviewed: manual.rows.filter((entry) => entry.reviewStatus !== "official-text-only").length, officialTextOnly: manual.rows.filter((entry) => entry.reviewStatus === "official-text-only").length, source: manualPath }, null, 2));

async function fetchAllQuestions() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("questions_v2").select("id,source_id").eq("question_set_id", set.id).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

async function fetchAllContexts() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("question_ai_contexts_v2").select("question_id,context,question:questions_v2!inner(question_set_id)").eq("question.question_set_id", set.id).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
