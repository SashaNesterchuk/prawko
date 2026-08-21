#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const sourceRoot = path.join(workspaceRoot, "czech-etesty-questions-2026-08-19");
const preparedRoot = path.join(workspaceRoot, "czech-etesty-supabase-import-2026-08-19");
const statePath = path.join(repoRoot, "data", "questions", "exports", "generated", "czech-ai-context-v1.json");
const contextVersion = "cz-visual-context-v1";
const explanationVersion = "cz-contextual-explanation-v1";
const batchSize = 6;
const visualConcurrency = 3;
const dryRun = process.argv.includes("--dry-run");
const requestedLimit = Number.parseInt(process.env.CZECH_AI_CONTEXT_LIMIT ?? "", 10);
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : null;
const sourceIdFilter = process.env.CZECH_AI_CONTEXT_SOURCE_ID?.trim() || null;
const requireFromPipeline = createRequire(path.join(repoRoot, "packages", "data-pipeline", "package.json"));
const { createClient } = requireFromPipeline("@supabase/supabase-js");

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const [, key, rawValue] = match;
    return [[key, rawValue.replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

const localEnv = parseEnv(await readFile(path.join(repoRoot, ".env.local"), "utf8"));
const supabaseUrl = process.env.SUPABASE_URL ?? localEnv.SUPABASE_URL ?? localEnv.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.CZECH_AI_CONTEXT_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase credentials.");
if (!dryRun && !anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY in the process environment.");

const [questionsPayload, optionRows, mediaRows, signManifest] = await Promise.all([
  readJson(path.join(preparedRoot, "questions.json")),
  readJson(path.join(preparedRoot, "question_options.json")),
  readJson(path.join(preparedRoot, "question_media.json")),
  readJson(path.join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu", "manifest.json")),
]);

const knownSigns = (signManifest.signs ?? []).map((sign) => ({ code: sign.id, name: sign.name }));
const signByNormalizedCode = new Map(knownSigns.map((sign) => [normalizeCode(sign.code), sign]));
const signCodes = knownSigns.map((sign) => sign.code).sort((a, b) => a.localeCompare(b, "cs", { numeric: true }));
const questionRows = Array.isArray(questionsPayload) ? questionsPayload : questionsPayload.questions;
if (!Array.isArray(questionRows) || !Array.isArray(optionRows) || !Array.isArray(mediaRows)) {
  throw new Error("Invalid Czech source JSON.");
}

const optionsByQuestion = new Map();
for (const option of optionRows) {
  const values = optionsByQuestion.get(option.question_source_id) ?? [];
  values.push(option);
  optionsByQuestion.set(option.question_source_id, values);
}
for (const options of optionsByQuestion.values()) options.sort((a, b) => a.sort_order - b.sort_order);

const mediaByQuestion = new Map();
for (const media of mediaRows) {
  const values = mediaByQuestion.get(media.question_source_id) ?? [];
  values.push(media);
  mediaByQuestion.set(media.question_source_id, values);
}

const sourceQuestions = questionRows.map((question) => ({
  ...question,
  options: optionsByQuestion.get(question.question_source_id) ?? [],
  media: mediaByQuestion.get(question.question_source_id) ?? [],
}));
if (sourceQuestions.length !== 1136) throw new Error(`Expected 1,136 Czech questions, received ${sourceQuestions.length}.`);

const priorState = await readJsonIfPresent(statePath);
const resultsBySourceId = new Map((priorState?.rows ?? []).map((row) => [row.questionSourceId, row]));
const filteredQuestions = sourceIdFilter
  ? sourceQuestions.filter((question) => question.question_source_id === sourceIdFilter)
  : sourceQuestions;
if (sourceIdFilter && filteredQuestions.length !== 1) throw new Error(`Unknown Czech question source ID: ${sourceIdFilter}.`);
const selectedQuestions = limit ? filteredQuestions.slice(0, limit) : filteredQuestions;
const pending = selectedQuestions.filter((question) => !resultsBySourceId.has(question.question_source_id));

console.log(JSON.stringify({ totalQuestions: sourceQuestions.length, selectedQuestions: selectedQuestions.length, restoredContexts: resultsBySourceId.size, pending: pending.length, dryRun, model }, null, 2));

if (dryRun) {
  const visualQuestions = selectedQuestions.filter((question) => question.media.length > 0).length;
  console.log(JSON.stringify({ visualQuestions, textOnlyQuestions: selectedQuestions.length - visualQuestions, knownSignCodes: signCodes.length, statePath }, null, 2));
  process.exit();
}

let saveChain = Promise.resolve();
function persistState() {
  const payload = {
    contextVersion,
    explanationVersion,
    model,
    generatedAt: new Date().toISOString(),
    rows: [...resultsBySourceId.values()].sort((a, b) => a.questionSourceId.localeCompare(b.questionSourceId)),
  };
  saveChain = saveChain.then(() => writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`));
  return saveChain;
}

const visualPending = pending.filter((question) => question.media.length > 0);
const textPending = pending.filter((question) => question.media.length === 0);

await runWorkers(visualPending, visualConcurrency, async (question) => {
  const result = await generateForVisualQuestion(question);
  resultsBySourceId.set(result.questionSourceId, result);
  await persistState();
  const completed = resultsBySourceId.size;
  if (completed % 10 === 0 || completed === selectedQuestions.length) console.log(`Contexts ${completed}/${selectedQuestions.length}`);
});

for (let index = 0; index < textPending.length; index += batchSize) {
  const batch = textPending.slice(index, index + batchSize);
  const generated = await generateForTextQuestions(batch);
  for (const result of generated) resultsBySourceId.set(result.questionSourceId, result);
  await persistState();
  const completed = resultsBySourceId.size;
  if (completed % 12 === 0 || index + batch.length === textPending.length) console.log(`Contexts ${completed}/${selectedQuestions.length}`);
}

await saveChain;
const generatedRows = selectedQuestions.map((question) => resultsBySourceId.get(question.question_source_id)).filter(Boolean);
if (generatedRows.length !== selectedQuestions.length) throw new Error("Generation checkpoint is incomplete.");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: questionSet, error: questionSetError } = await supabase.from("question_sets").select("id").eq("key", "cz-v2-current").single();
if (questionSetError || !questionSet) throw questionSetError ?? new Error("Czech question set is missing.");
const remoteQuestions = await fetchAllQuestions(supabase, questionSet.id);
const remoteBySourceId = new Map(remoteQuestions.map((row) => [row.source_id, row]));
const missingRemote = generatedRows.filter((row) => !remoteBySourceId.has(row.questionSourceId));
if (missingRemote.length) throw new Error(`Generated contexts reference ${missingRemote.length} missing Czech questions.`);

const contextUpserts = generatedRows.map((row) => ({
  question_id: remoteBySourceId.get(row.questionSourceId).id,
  context: row.context,
  context_version: contextVersion,
  media_fingerprint: row.mediaFingerprint,
  needs_manual_review: row.needsManualReview,
  source_updated_at: new Date().toISOString(),
}));
const explanationUpserts = generatedRows.map((row) => ({
  question_id: remoteBySourceId.get(row.questionSourceId).id,
  explanations: { cs: row.explanationCs, en: row.explanationEn },
  available_locales: ["cs", "en"],
  explanation_version: explanationVersion,
  source_context_version: contextVersion,
  source_context_updated_at: new Date().toISOString(),
  provider: "anthropic",
  model,
  confidence: row.needsManualReview ? 0.55 : 0.9,
  needs_manual_review: row.needsManualReview,
  reason: "official-question-and-verified-visual-context",
}));

await upsertBatches(supabase, "question_ai_contexts_v2", contextUpserts, "question_id");
await upsertBatches(supabase, "question_ai_explanations_v2", explanationUpserts, "question_id");
const verification = await verifyRemoteCoverage(supabase, questionSet.id, generatedRows.length);
console.log(JSON.stringify({ generated: generatedRows.length, contexts: verification.contexts, explanations: verification.explanations, needsManualReview: generatedRows.filter((row) => row.needsManualReview).length, verified: true }, null, 2));

async function generateForVisualQuestion(question) {
  const imageBlocks = await buildVisualBlocks(question);
  const prompt = buildPrompt([question], true);
  const parsed = await requestModel([{ type: "text", text: prompt }, ...imageBlocks]);
  return validateResult(parsed.items, [question])[0];
}

async function generateForTextQuestions(questions) {
  const parsed = await requestModel([{ type: "text", text: buildPrompt(questions, false) }]);
  return validateResult(parsed.items, questions);
}

function buildPrompt(questions, hasImages) {
  return [
    "Return exactly one JSON object, no Markdown and no prose outside JSON.",
    'Schema: {"items":[{"questionSourceId":"cz:...","sceneCs":"...","sceneEn":"...","decisiveFactsCs":["..."],"decisiveFactsEn":["..."],"signCodes":["P-4"],"needsManualReview":false,"explanationCs":"...","explanationEn":"..."}]}.',
    "You are a Czech driving-theory editor. Use only the official question, answers, and attached visual evidence.",
    "For every item, explain why the correct answer is correct and why each incorrect A/B/C option is wrong. Do not invent legal citations or visual facts.",
    "If a traffic sign, marking, or signal is decisive, include its exact verified code in signCodes and write that same code in both explanations. Never write a generic Czech word 'značka' or English word 'sign' for a decisive traffic sign without its code.",
    "Only use signCodes from this exact catalogue: " + signCodes.join(", ") + ".",
    "If the image does not identify a sign/code unambiguously, return no code, avoid generic sign wording, and set needsManualReview to true.",
    "Write Czech and English explanations in 100-700 characters each. sceneCs/sceneEn must describe what is actually shown or, for text-only items, the driving situation stated by the question.",
    hasImages ? "Attached images belong only to the single input question and are labelled in the input." : "No visual attachments are supplied for these text-only questions.",
    "Input:",
    JSON.stringify(questions.map(questionPayload)),
  ].join("\n");
}

function questionPayload(question) {
  return {
    questionSourceId: question.question_source_id,
    questionCs: question.question_cs,
    correctOption: question.correct_option_key,
    answers: question.options.map((option) => ({ id: option.option_key, textCs: option.text_cs })),
    attachments: question.media.map((media) => ({ placement: media.placement, option: media.option_key, filename: media.original_filename, type: media.media_type })),
  };
}

async function requestModel(content) {
  let latestError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "anthropic-version": "2023-06-01", "content-type": "application/json", "x-api-key": anthropicKey },
        body: JSON.stringify({ model, max_tokens: 6000, system: "You are precise, conservative, and return valid JSON only.", messages: [{ role: "user", content }] }),
      });
      if (!response.ok) throw new Error(`Anthropic request failed with ${response.status}.`);
      const body = await response.json();
      const text = body.content?.filter((block) => block.type === "text").map((block) => block.text).join("\n");
      return JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, ""));
    } catch (error) {
      latestError = error;
    }
  }
  throw latestError instanceof Error ? latestError : new Error(String(latestError));
}

function validateResult(items, questions) {
  if (!Array.isArray(items) || items.length !== questions.length) throw new Error("Model returned an incomplete batch.");
  const expected = new Map(questions.map((question) => [question.question_source_id, question]));
  const seen = new Set();
  return items.map((item) => {
    const question = expected.get(item?.questionSourceId);
    if (!question || seen.has(item.questionSourceId)) throw new Error("Model returned an unknown or duplicate question ID.");
    seen.add(item.questionSourceId);
    const codes = Array.isArray(item.signCodes) ? item.signCodes.map(canonicalCode).filter(Boolean) : [];
    const uniqueCodes = [...new Set(codes)];
    const explanationCs = cleanText(item.explanationCs);
    const explanationEn = cleanText(item.explanationEn);
    if (explanationCs.length < 100 || explanationCs.length > 700 || explanationEn.length < 100 || explanationEn.length > 700) throw new Error(`Invalid explanation length for ${item.questionSourceId}.`);
    if ((/\bznačk/iu.test(explanationCs) || /\bsign\b/iu.test(explanationEn)) && uniqueCodes.length === 0) throw new Error(`Uncoded sign reference for ${item.questionSourceId}.`);
    if (uniqueCodes.some((code) => !explanationCs.includes(code) || !explanationEn.includes(code))) throw new Error(`A sign code is missing from an explanation for ${item.questionSourceId}.`);
    const needsManualReview = Boolean(item.needsManualReview) || (question.media.length > 0 && uniqueCodes.length === 0);
    const mediaFingerprint = createHash("sha256").update(JSON.stringify(question.media.map((media) => [media.media_key, media.official_media_hash]))).digest("hex");
    return {
      questionSourceId: item.questionSourceId,
      mediaFingerprint,
      needsManualReview,
      context: {
        prompt_cs: question.question_cs,
        answers: question.options.map((option) => ({ id: option.option_key, text_cs: option.text_cs, is_correct: option.is_correct })),
        media: question.media.map((media) => ({ placement: media.placement, option_key: media.option_key, filename: media.original_filename, media_type: media.media_type })),
        scene_cs: cleanText(item.sceneCs),
        scene_en: cleanText(item.sceneEn),
        decisive_facts_cs: stringArray(item.decisiveFactsCs),
        decisive_facts_en: stringArray(item.decisiveFactsEn),
        verified_signs: uniqueCodes.map((code) => ({ code, name_cs: signByNormalizedCode.get(normalizeCode(code)).name })),
      },
      explanationCs,
      explanationEn,
    };
  });
}

async function buildVisualBlocks(question) {
  const blocks = [];
  for (const media of question.media) {
    const paths = media.media_type === "video" ? await extractVideoFrames(media.original_filename) : [path.join(sourceRoot, "media-opt", media.original_filename)];
    for (const filePath of paths) {
      const extension = path.extname(filePath).toLowerCase();
      const mediaType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
      blocks.push({ type: "text", text: `Attachment: ${media.placement}${media.option_key ? ` option ${media.option_key}` : ""}, ${media.original_filename}.` });
      blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: (await readFile(filePath)).toString("base64") } });
    }
  }
  return blocks;
}

async function extractVideoFrames(filename) {
  const input = path.join(sourceRoot, "media-opt", filename);
  const frameRoot = path.join("/tmp", "czech-ai-context-frames", filename.replace(/\.[^.]+$/, ""));
  const frames = ["00", "10", "20"].map((second) => path.join(frameRoot, `${second}.jpg`));
  await mkdir(frameRoot, { recursive: true });
  await Promise.all(frames.map(async (frame, index) => {
    const exists = await stat(frame).then(() => true).catch(() => false);
    if (exists) return;
    await run("ffmpeg", ["-y", "-v", "error", "-ss", String(index * 10), "-i", input, "-frames:v", "1", "-vf", "scale=min(960\\,iw):-2", frame]);
  }));
  return frames;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function fetchAllQuestions(supabase, questionSetId) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("questions_v2").select("id,source_id").eq("question_set_id", questionSetId).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

async function upsertBatches(supabase, table, rows, onConflict) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + 100), { onConflict });
    if (error) throw error;
  }
}

async function verifyRemoteCoverage(supabase, questionSetId, expectedCount) {
  const [contexts, explanations] = await Promise.all([
    supabase.from("question_ai_contexts_v2").select("question:questions_v2!inner(question_set_id)", { count: "exact", head: true }).eq("question.question_set_id", questionSetId),
    supabase.from("question_ai_explanations_v2").select("question:questions_v2!inner(question_set_id)", { count: "exact", head: true }).eq("question.question_set_id", questionSetId),
  ]);
  if (contexts.error || explanations.error) throw contexts.error ?? explanations.error;
  if (contexts.count !== expectedCount || explanations.count !== expectedCount) throw new Error(`Remote coverage mismatch: contexts=${contexts.count}, explanations=${explanations.count}, expected=${expectedCount}.`);
  return { contexts: contexts.count, explanations: explanations.count };
}

function normalizeCode(value) { return String(value).replace(/\s+/g, "").replace(/([A-Za-z]+)(\d)/, "$1-$2").toUpperCase(); }
function canonicalCode(value) { return signByNormalizedCode.get(normalizeCode(value))?.code ?? null; }
function cleanText(value) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""; }
function stringArray(value) { return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : []; }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }
async function readJsonIfPresent(filePath) { try { return await readJson(filePath); } catch (error) { if (error?.code === "ENOENT") return null; throw error; } }
async function runWorkers(values, concurrency, work) { let cursor = 0; await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => { while (cursor < values.length) await work(values[cursor++]); })); }
