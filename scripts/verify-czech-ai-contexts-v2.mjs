#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const requireFromPipeline = createRequire(path.join(repoRoot, "packages", "data-pipeline", "package.json"));
const { createClient } = requireFromPipeline("@supabase/supabase-js");
const env = Object.fromEntries((await readFile(path.join(repoRoot, ".env.local"), "utf8")).split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]] : [];
}));
const signManifest = JSON.parse(await readFile(path.join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu", "manifest.json"), "utf8"));
const manualManifest = JSON.parse(await readFile(path.join(repoRoot, "data", "questions", "exports", "generated", "czech-manual-contexts-v1.json"), "utf8"));
const knownCodes = new Set((signManifest.signs ?? []).map((sign) => sign.id));
const localRows = manualManifest.rows ?? [];
const manualSourceIds = new Set(localRows.filter((row) => row.reviewStatus !== "official-text-only").map((row) => row.questionSourceId));
const officialTextSourceIds = new Set(localRows.filter((row) => row.reviewStatus === "official-text-only").map((row) => row.questionSourceId));
const supabase = createClient(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: set, error: setError } = await supabase.from("question_sets").select("id").eq("key", "cz-v2-current").single();
if (setError || !set) throw setError ?? new Error("Czech question set missing.");
const contexts = await fetchAll("question_ai_contexts_v2", "question_id,context,context_version,needs_manual_review,question:questions_v2!inner(question_set_id,source_id)");
const explanations = await fetchAll("question_ai_explanations_v2", "question_id,explanations,available_locales,question:questions_v2!inner(question_set_id,source_id)");
const czechContexts = contexts.filter((row) => row.question?.question_set_id === set.id);
const czechExplanations = explanations.filter((row) => row.question?.question_set_id === set.id);
const unknownCodes = czechContexts.flatMap((row) => row.context?.verified_signs ?? []).map((sign) => sign?.code).filter((code) => code && !knownCodes.has(code));
const reviewCount = czechContexts.filter((row) => row.needs_manual_review).length;
const hasExpectedSourceShape = czechContexts.every((row) => typeof row.context?.prompt_cs === "string" && Array.isArray(row.context?.answers) && Array.isArray(row.context?.media));
const fullyLocalizedExplanations = czechExplanations.filter((row) => typeof row.explanations?.cs === "string" && typeof row.explanations?.en === "string" && row.available_locales?.includes("cs") && row.available_locales?.includes("en"));
const manualContextCount = czechContexts.filter((row) => row.context_version === "cz-manual-context-v1").length;
const officialTextContextCount = czechContexts.filter((row) => row.context_version === "cz-official-text-context-v1").length;
const remoteManualSourceIds = new Set(czechContexts.filter((row) => row.context_version === "cz-manual-context-v1").map((row) => row.question?.source_id));
const remoteOfficialTextSourceIds = new Set(czechContexts.filter((row) => row.context_version === "cz-official-text-context-v1").map((row) => row.question?.source_id));
const missingManualContexts = [...manualSourceIds].filter((sourceId) => !remoteManualSourceIds.has(sourceId));
const unexpectedManualContexts = [...remoteManualSourceIds].filter((sourceId) => !manualSourceIds.has(sourceId));
const missingOfficialTextContexts = [...officialTextSourceIds].filter((sourceId) => !remoteOfficialTextSourceIds.has(sourceId));
const unexpectedOfficialTextContexts = [...remoteOfficialTextSourceIds].filter((sourceId) => !officialTextSourceIds.has(sourceId));
if (czechContexts.length !== localRows.length || czechExplanations.length !== localRows.length || fullyLocalizedExplanations.length !== localRows.length || manualContextCount !== manualSourceIds.size || officialTextContextCount !== officialTextSourceIds.size || missingManualContexts.length || unexpectedManualContexts.length || missingOfficialTextContexts.length || unexpectedOfficialTextContexts.length || unknownCodes.length || !hasExpectedSourceShape) {
  throw new Error(JSON.stringify({ czechContexts: czechContexts.length, czechExplanations: czechExplanations.length, fullyLocalizedExplanations: fullyLocalizedExplanations.length, manualContextCount, expectedManualContexts: manualSourceIds.size, officialTextContextCount, expectedOfficialTextContexts: officialTextSourceIds.size, missingManualContexts, unexpectedManualContexts, missingOfficialTextContexts, unexpectedOfficialTextContexts, unknownCodes, hasExpectedSourceShape }));
}
console.log(JSON.stringify({ czechContexts: czechContexts.length, czechExplanations: czechExplanations.length, localizedExplanations: fullyLocalizedExplanations.length, verifiedManualContexts: manualContextCount, officialTextContexts: officialTextContextCount, pendingVisualReview: reviewCount, knownSignCodes: knownCodes.size, unknownSignCodes: unknownCodes.length, prawkoTouched: false }, null, 2));

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
