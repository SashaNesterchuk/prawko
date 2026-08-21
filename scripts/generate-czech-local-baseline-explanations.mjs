#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const preparedRoot = path.join(workspaceRoot, "czech-etesty-supabase-import-2026-08-19");
const requireFromPipeline = createRequire(path.join(repoRoot, "packages", "data-pipeline", "package.json"));
const { createClient } = requireFromPipeline("@supabase/supabase-js");
const env = parseEnv(await readFile(path.join(repoRoot, ".env.local"), "utf8"));
const supabase = createClient(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const [questions, options, media, signManifest] = await Promise.all([
  readJson(path.join(preparedRoot, "questions.json")),
  readJson(path.join(preparedRoot, "question_options.json")),
  readJson(path.join(preparedRoot, "question_media.json")),
  readJson(path.join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu", "manifest.json")),
]);
const sourceQuestions = Array.isArray(questions) ? questions : questions.questions;
const knownByNormalizedCode = new Map((signManifest.signs ?? []).map((sign) => [normalizeCode(sign.id), sign]));
const optionsByQuestion = groupBy(options, "question_source_id");
const mediaByQuestion = groupBy(media, "question_source_id");
for (const values of optionsByQuestion.values()) values.sort((a, b) => a.sort_order - b.sort_order);

const { data: set, error: setError } = await supabase.from("question_sets").select("id").eq("key", "cz-v2-current").single();
if (setError || !set) throw setError ?? new Error("Czech question set is missing.");
// Fetch the two tables separately.  The embedded relation is convenient, but its
// pagination is not stable enough here: an incomplete embedded page would make a
// perfectly valid Czech source id look missing.
const remoteQuestions = await fetchAll("questions_v2", "id,source_id");
const remoteContexts = await fetchAllContexts();
const remoteContextByQuestionId = new Map(remoteContexts.map((row) => [row.question_id, row]));
const remoteBySource = new Map(remoteQuestions.map((row) => [row.source_id, { ...row, contextRow: remoteContextByQuestionId.get(row.id) }]));
const now = new Date().toISOString();
const contextUpserts = [];
const explanationUpserts = [];
for (const question of sourceQuestions) {
  const remoteQuestion = remoteBySource.get(question.question_source_id);
  if (!remoteQuestion) throw new Error(`Czech v2 question missing: ${question.question_source_id}`);
  if (remoteQuestion.contextRow?.context_version === "cz-manual-context-v1") continue;
  const questionOptions = optionsByQuestion.get(question.question_source_id) ?? [];
  const questionMedia = mediaByQuestion.get(question.question_source_id) ?? [];
  const correct = questionOptions.find((option) => option.option_key === question.correct_option_key);
  if (!correct) throw new Error(`Correct option missing: ${question.question_source_id}`);
  const allSourceText = [question.question_cs, ...questionOptions.map((option) => option.text_cs)].join(" ");
  const signCodes = extractKnownSignCodes(allSourceText, knownByNormalizedCode);
  const referencesUncodedTrafficControl = hasUncodedTrafficControl(allSourceText, signCodes.length);
  const needsManualReview = questionMedia.length > 0 || referencesUncodedTrafficControl;
  const explanation = buildExplanation(question, questionOptions, correct, signCodes, referencesUncodedTrafficControl);
  contextUpserts.push({
    question_id: remoteQuestion.id,
    context: {
      ...(remoteQuestion.contextRow?.context ?? {}),
      visual_analysis: questionMedia.length > 0
        ? { status: "local-textual-description", scene_cs: `Vyobrazená dopravní situace se posuzuje podle zadání: ${clean(question.question_cs)}`, scene_en: "The depicted traffic situation is assessed using the official question and answer options." }
        : { status: "not_applicable", scene_cs: `Situace vyplývá přímo ze zadání: ${clean(question.question_cs)}`, scene_en: "The situation follows directly from the official question." },
      decisive_facts_cs: [`Správná možnost: ${question.correct_option_key}.`, clean(correct.text_cs)],
      decisive_facts_en: [`Correct option: ${question.correct_option_key}.`],
      verified_signs: signCodes.map((code) => ({ code, name_cs: knownByNormalizedCode.get(normalizeCode(code)).name })),
    },
    context_version: "cz-local-baseline-context-v1",
    needs_manual_review: needsManualReview,
    source_updated_at: now,
  });
  explanationUpserts.push({
    question_id: remoteQuestion.id,
    explanations: { cs: explanation.cs, en: explanation.en },
    available_locales: ["cs", "en"],
    explanation_version: "cz-local-baseline-explanation-v1",
    source_context_version: "cz-local-baseline-context-v1",
    source_context_updated_at: now,
    provider: "manual-local",
    model: "codex-deterministic",
    confidence: needsManualReview ? 0.55 : 0.75,
    needs_manual_review: needsManualReview,
    reason: "official-question-answer-local-context",
  });
}
for (let index = 0; index < contextUpserts.length; index += 100) {
  const { error } = await supabase.from("question_ai_contexts_v2").upsert(contextUpserts.slice(index, index + 100), { onConflict: "question_id" });
  if (error) throw error;
  const { error: explanationError } = await supabase.from("question_ai_explanations_v2").upsert(explanationUpserts.slice(index, index + 100), { onConflict: "question_id" });
  if (explanationError) throw explanationError;
}
console.log(JSON.stringify({ generatedBaselineContexts: contextUpserts.length, generatedBaselineExplanations: explanationUpserts.length, preservedManualContexts: sourceQuestions.length - contextUpserts.length, needsManualReview: contextUpserts.filter((row) => row.needs_manual_review).length }, null, 2));

function buildExplanation(question, questionOptions, correct, signCodes, uncodedTrafficControl) {
  const incorrect = questionOptions.filter((option) => option.option_key !== correct.option_key).map((option) => option.option_key);
  const codesCs = signCodes.length ? ` Rozhodující označení je ${signCodes.join(" a ")}.` : "";
  const codesEn = signCodes.length ? ` The decisive designation is ${signCodes.join(" and ")}.` : "";
  if (uncodedTrafficControl) {
    return {
      cs: `Správně je varianta ${correct.option_key}, protože jako jediná odpovídá pravidlu pro situaci popsanou v zadání.${codesCs} Varianty ${incorrect.join(" a ")} toto pravidlo nevyjadřují správně a proto nemohou být zvoleny.`,
      en: `Option ${correct.option_key} is correct because it is the only one that matches the rule for the situation in the official question.${codesEn} Options ${incorrect.join(" and ")} do not state that rule correctly and therefore cannot be selected.`,
    };
  }
  return {
    cs: `Správně je varianta ${correct.option_key}, protože uvádí: „${clean(correct.text_cs)}“. Tato možnost odpovídá podmínce v zadání.${codesCs} Varianty ${incorrect.join(" a ")} tuto podmínku nesplňují nebo popisují jinou situaci.`,
    en: `Option ${correct.option_key} is correct. Its official Czech wording is: “${clean(correct.text_cs)}”. It matches the condition in the question.${codesEn} Options ${incorrect.join(" and ")} do not meet that condition or describe a different situation.`,
  };
}

function extractKnownSignCodes(text, known) {
  const matches = [...text.matchAll(/\b([A-Z]{1,3})\s*-?\s*(\d+)([a-z]?)\b/g)].map((match) => `${match[1]}-${match[2]}${match[3]}`);
  return [...new Set(matches.map((code) => known.get(normalizeCode(code))?.id).filter(Boolean))];
}
function hasUncodedTrafficControl(text, codeCount) { return codeCount === 0 && /\b(?:dopravn[íi]\s+značk|značen[íi]|značka|světeln)/iu.test(text); }
function normalizeCode(value) { return String(value).replace(/\s+/g, "").replace(/([A-Za-z]+)(\d)/, "$1-$2").toUpperCase(); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function groupBy(rows, key) { const map = new Map(); for (const row of rows) { const values = map.get(row[key]) ?? []; values.push(row); map.set(row[key], values); } return map; }
function parseEnv(contents) { return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => { const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]] : []; })); }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }
async function fetchAll(table, columns) { const rows = []; for (let from = 0; ; from += 500) { const { data, error } = await supabase.from(table).select(columns).eq("question_set_id", set.id).order("id", { ascending: true }).range(from, from + 499); if (error) throw error; rows.push(...(data ?? [])); if (!data || data.length < 500) return rows; } }
async function fetchAllContexts() { const rows = []; for (let from = 0; ; from += 500) { const { data, error } = await supabase.from("question_ai_contexts_v2").select("question_id,context,context_version,needs_manual_review").order("question_id", { ascending: true }).range(from, from + 499); if (error) throw error; rows.push(...(data ?? [])); if (!data || data.length < 500) return rows; } }
