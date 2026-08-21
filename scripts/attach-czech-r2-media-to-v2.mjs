#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const requireFromPipeline = createRequire(
  path.join(repoRoot, "packages", "data-pipeline", "package.json")
);
const { createClient } = requireFromPipeline("@supabase/supabase-js");
const sourceRoot = path.join(workspaceRoot, "czech-etesty-questions-2026-08-19");
const preparedRoot = path.join(workspaceRoot, "czech-etesty-supabase-import-2026-08-19");
const dryRun = process.argv.includes("--dry-run");
const questionSetKey = "cz-v2-current";

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const [, key, rawValue] = match;
    return [[key, rawValue.replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

const env = parseEnv(await readFile(path.join(repoRoot, ".env.local"), "utf8"));
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in prawko/.env.local.");
}

const mediaManifest = JSON.parse(await readFile(path.join(preparedRoot, "question_media.json"), "utf8"));

function outputFilename(entry) {
  return entry.media_type === "image"
    ? `${entry.original_filename.replace(/\.[^.]+$/, "")}.webp`
    : entry.original_filename;
}

function assetFor(entry) {
  const filename = outputFilename(entry);
  return {
    mediaKey: entry.media_key,
    sourceKind: "primary",
    mediaType: entry.media_type,
    originalFilename: entry.original_filename,
    resolvedFilename: filename,
    matchStrategy: "exact",
    storageBucket: entry.media_type === "image" ? "question-images" : "question-videos",
    storagePath: filename,
    posterStorageBucket: null,
    posterStoragePath: null,
  };
}

const questionAssets = new Map();
const optionAssets = new Map();
for (const entry of mediaManifest) {
  const asset = assetFor(entry);
  const localPath = path.join(
    sourceRoot,
    "czech-media-prod",
    asset.storageBucket,
    asset.storagePath
  );
  await stat(localPath);

  if (entry.placement === "question") {
    if (questionAssets.has(entry.question_source_id)) {
      throw new Error(`Duplicate question media for ${entry.question_source_id}.`);
    }
    questionAssets.set(entry.question_source_id, asset);
  } else if (entry.placement === "option" && entry.option_key) {
    const key = `${entry.question_source_id}:${entry.option_key}`;
    if (optionAssets.has(key)) throw new Error(`Duplicate option media for ${key}.`);
    optionAssets.set(key, asset);
  } else {
    throw new Error(`Unsupported media placement for ${entry.media_key}.`);
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: questionSet, error: questionSetError } = await supabase
  .from("question_sets")
  .select("id,exam_config")
  .eq("key", questionSetKey)
  .single();
if (questionSetError || !questionSet) throw questionSetError ?? new Error("Czech question set is missing.");

async function fetchAllQuestions() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("questions_v2")
      .select("id,source_id,content")
      .eq("question_set_id", questionSet.id)
      .range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

const rows = await fetchAllQuestions();
const bySourceId = new Map(rows.map((row) => [row.source_id, row]));
const mediaSourceIds = [
  ...questionAssets.keys(),
  ...[...optionAssets.keys()].map((key) => key.split(":").slice(0, 2).join(":")),
];
const missingSources = [...new Set(mediaSourceIds)].filter(
  (sourceId) => !bySourceId.has(sourceId)
);
if (missingSources.length) throw new Error(`Media references unknown Czech questions: ${missingSources.slice(0, 10).join(", ")}`);

function replacePrimaryMedia(items, asset) {
  const retained = Array.isArray(items) ? items.filter((item) => item?.role !== "primary") : [];
  return asset ? [...retained, { role: "primary", asset }] : retained;
}

const updates = rows.flatMap((row) => {
  const questionAsset = questionAssets.get(row.source_id);
  const content = row.content ?? {};
  const options = (content.options ?? []).map((option) => ({
    ...option,
    media: replacePrimaryMedia(option.media, optionAssets.get(`${row.source_id}:${option.id}`)),
  }));
  const nextContent = {
    ...content,
    options,
    question_media: replacePrimaryMedia(content.question_media, questionAsset),
  };
  const changed = Boolean(questionAsset) || options.some((option) => option.media.length > 0);
  return changed ? [{ id: row.id, content: nextContent }] : [];
});

const expectedQuestionMedia = questionAssets.size;
const expectedOptionMedia = optionAssets.size;
if (expectedQuestionMedia !== 504 || expectedOptionMedia !== 75) {
  throw new Error(`Unexpected Czech media totals: question=${expectedQuestionMedia}, option=${expectedOptionMedia}.`);
}

if (dryRun) {
  console.log(JSON.stringify({ questionSetKey, totalQuestions: rows.length, updatedQuestions: updates.length, questionMedia: expectedQuestionMedia, optionMedia: expectedOptionMedia, dryRun: true }, null, 2));
  process.exit();
}

let cursor = 0;
const failures = [];
async function worker() {
  while (cursor < updates.length) {
    const update = updates[cursor++];
    const { error } = await supabase.from("questions_v2").update({ content: update.content }).eq("id", update.id);
    if (error) failures.push(`${update.id}: ${error.message}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
if (failures.length) throw new Error(`Failed to attach media: ${failures.slice(0, 10).join("; ")}`);

const refreshedRows = await fetchAllQuestions();
let attachedQuestionMedia = 0;
let attachedOptionMedia = 0;
for (const row of refreshedRows) {
  if (row.content?.question_media?.some((item) => item?.role === "primary")) attachedQuestionMedia += 1;
  for (const option of row.content?.options ?? []) {
    if (option.media?.some((item) => item?.role === "primary")) attachedOptionMedia += 1;
  }
}
if (attachedQuestionMedia !== expectedQuestionMedia || attachedOptionMedia !== expectedOptionMedia) {
  throw new Error(`Verification failed: question=${attachedQuestionMedia}/${expectedQuestionMedia}, option=${attachedOptionMedia}/${expectedOptionMedia}.`);
}

const examConfig = { ...(questionSet.exam_config ?? {}) };
examConfig.media = { ...(examConfig.media ?? {}), state: "ready", bucket: "czech-media-prod" };
const { error: questionSetUpdateError } = await supabase
  .from("question_sets")
  .update({ exam_config: examConfig })
  .eq("id", questionSet.id);
if (questionSetUpdateError) throw questionSetUpdateError;

console.log(JSON.stringify({ questionSetKey, totalQuestions: rows.length, updatedQuestions: updates.length, questionMedia: attachedQuestionMedia, optionMedia: attachedOptionMedia, verified: true }, null, 2));
