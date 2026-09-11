#!/usr/bin/env node

/**
 * Point only sk-v2-current question media at the already-uploaded flat R2
 * object names. No rows are created or deleted; PL/CZ are never selected.
 *
 * Run with --apply to PATCH the matching SK rows and activate sk-v2-current.
 * Without it, the script is a complete read-only preflight.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const apply = process.argv.includes("--apply");
const envPath = path.join(repoRoot, ".env.local");
const manifestPath = path.join(
  repoRoot,
  "data",
  "sk-questions-vodicak",
  "supabase-import",
  "r2-flat-media-manifest.json"
);
const expectedMediaManifestPath = path.join(
  repoRoot,
  "data",
  "sk-questions-vodicak",
  "supabase-import",
  "question_media_manifest.json"
);
const pageSize = 500;
const concurrency = 3;

function parseEnv(contents) {
  return Object.fromEntries(
    contents.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) return [];
      const [, key, rawValue] = match;
      return [[key, rawValue.replace(/^(['"])(.*)\1$/, "$2")]];
    })
  );
}

const env = parseEnv(await readFile(envPath, "utf8"));
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
};
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expectedMedia = JSON.parse(await readFile(expectedMediaManifestPath, "utf8"));
// The local source path is media/questions/<path>; database paths before this
// migration are sk/questions/<path>.
const correctedOldToNewPath = new Map(
  manifest.files.map((item) => [
    `sk/questions/${item.sourcePath.replace(/^\/questions\//, "")}`,
    item.storagePath,
  ])
);

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed with HTTP ${response.status}.`);
  }
  return response;
}

async function getQuestionSet() {
  const query = new URLSearchParams({
    key: "eq.sk-v2-current",
    select: "id,key,country_code,is_active,exam_config",
  });
  const rows = await (await request(`${supabaseUrl}/rest/v1/question_sets?${query}`)).json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`Expected exactly one sk-v2-current question set, received ${rows?.length ?? 0}.`);
  }
  const questionSet = rows[0];
  if (questionSet.country_code !== "SK") {
    throw new Error("Refusing to update a non-SK question set.");
  }
  return questionSet;
}

async function getAllSkQuestions(questionSetId) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const query = new URLSearchParams({
      question_set_id: `eq.${questionSetId}`,
      select: "id,source_id,content",
      order: "source_row_number.asc",
    });
    const page = await (
      await request(`${supabaseUrl}/rest/v1/questions_v2?${query}`, {
        headers: { Range: `${from}-${to}`, "Range-Unit": "items" },
      })
    ).json();
    if (!Array.isArray(page)) throw new Error("Unexpected questions_v2 response.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function rewriteAssetPaths(value, changes) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAssetPaths(item, changes));
  }
  if (!value || typeof value !== "object") return value;

  const object = value;
  if (
    object.storageBucket === "question-images" &&
    typeof object.storagePath === "string" &&
    correctedOldToNewPath.has(object.storagePath)
  ) {
    changes.push({ from: object.storagePath, to: correctedOldToNewPath.get(object.storagePath) });
    return { ...object, storagePath: correctedOldToNewPath.get(object.storagePath) };
  }

  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [key, rewriteAssetPaths(item, changes)])
  );
}

const questionSet = await getQuestionSet();
const questions = await getAllSkQuestions(questionSet.id);
if (questions.length !== 1416 || questions.some((question) => !String(question.source_id).startsWith("sk:"))) {
  throw new Error("Refusing to update: this is not the expected 1,416-row Slovak question set.");
}

const patches = [];
const unknownOldPaths = new Set();
let oldMediaReferences = 0;
for (const question of questions) {
  const changes = [];
  const nextContent = rewriteAssetPaths(question.content, changes);
  const oldPaths = [];
  const scan = (value) => {
    if (Array.isArray(value)) return value.forEach(scan);
    if (!value || typeof value !== "object") return;
    if (value.storageBucket === "question-images" && typeof value.storagePath === "string") {
      oldPaths.push(value.storagePath);
    }
    Object.values(value).forEach(scan);
  };
  scan(question.content);
  for (const storagePath of oldPaths) {
    if (storagePath.startsWith("sk/questions/")) {
      oldMediaReferences += 1;
      if (!correctedOldToNewPath.has(storagePath)) unknownOldPaths.add(storagePath);
    }
  }
  if (changes.length > 0) {
    patches.push({ id: question.id, sourceId: question.source_id, content: nextContent, changes });
  }
}

const expectedReferenceCount = Array.isArray(expectedMedia)
  ? expectedMedia.filter((item) => item.status === "downloaded").length
  : expectedMedia.references?.length;
if (unknownOldPaths.size > 0) {
  throw new Error(`Refusing to update: ${unknownOldPaths.size} Slovak media paths are absent from the flat-media manifest.`);
}
if (patches.length === 0 || oldMediaReferences !== expectedReferenceCount) {
  throw new Error(
    `Refusing to update: expected ${expectedReferenceCount} old media references, found ${oldMediaReferences} across ${patches.length} rows.`
  );
}

const preflight = {
  mode: apply ? "apply" : "dry-run",
  questionSet: { key: questionSet.key, country: questionSet.country_code, currentlyActive: questionSet.is_active },
  questionRowsRead: questions.length,
  questionRowsToPatch: patches.length,
  mediaReferencesToRewrite: oldMediaReferences,
  newStoragePathHasFolders: patches.some((patch) => patch.changes.some((change) => change.to.includes("/"))),
  questionSetMediaPrefix: questionSet.exam_config?.media?.delivery_path_prefix ?? null,
};
console.log(JSON.stringify(preflight, null, 2));

if (apply) {
let cursor = 0;
let updatedRows = 0;
async function worker() {
  while (cursor < patches.length) {
    const patch = patches[cursor++];
    const query = new URLSearchParams({ id: `eq.${patch.id}` });
    await request(`${supabaseUrl}/rest/v1/questions_v2?${query}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ content: patch.content }),
    });
    updatedRows += 1;
    if (updatedRows % 25 === 0 || updatedRows === patches.length) {
      console.log(`Updated ${updatedRows}/${patches.length} SK question rows`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, patches.length) }, worker));

const nextExamConfig = {
  ...questionSet.exam_config,
  media: {
    ...(questionSet.exam_config?.media ?? {}),
    state: "r2_uploaded",
    delivery_path_prefix: "question-images/",
  },
};
const questionSetQuery = new URLSearchParams({ id: `eq.${questionSet.id}`, key: "eq.sk-v2-current", country_code: "eq.SK" });
await request(`${supabaseUrl}/rest/v1/question_sets?${questionSetQuery}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", Prefer: "return=minimal" },
  body: JSON.stringify({ exam_config: nextExamConfig, is_active: true }),
});

console.log(JSON.stringify({ updatedRows, activatedQuestionSet: "sk-v2-current" }, null, 2));
}
