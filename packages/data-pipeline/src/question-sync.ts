import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { EXPORTS_GENERATED_DIR } from "./constants";
import { loadLocalEnvFiles } from "./env";
import type { PipelineOptions, QuestionSyncResult } from "./types";
import {
  readJsonFile,
  relativeToRepo,
  resolveRepoPath,
  writeJsonFile,
} from "./utils";

type QuestionSyncRow = Record<string, unknown>;

const DEFAULT_BATCH_SIZE = 200;

function chunkRows<T>(rows: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }

  return batches;
}

export async function syncQuestionsToSupabase(
  options: PipelineOptions = {}
): Promise<QuestionSyncResult> {
  await loadLocalEnvFiles();

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Expected SUPABASE_SERVICE_ROLE_KEY and a Supabase URL in env files."
    );
  }

  const inputPath = resolveRepoPath(
    options.inputPath ??
      path.join(EXPORTS_GENERATED_DIR, "supabase.questions.category-b.json")
  );
  const rows = await readJsonFile<QuestionSyncRow[]>(inputPath);
  const limitedRows =
    typeof options.limit === "number" && options.limit > 0
      ? rows.slice(0, options.limit)
      : rows;
  const batchSize =
    typeof options.batchSize === "number" && options.batchSize > 0
      ? options.batchSize
      : DEFAULT_BATCH_SIZE;
  const batches = chunkRows(limitedRows, batchSize);

  let syncedRows = 0;
  let failedRows = 0;
  const failures: Array<{
    batchNumber: number;
    rowCount: number;
    error: string;
  }> = [];

  if (!options.dryRun) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const { error } = await supabase
        .from("questions")
        .upsert(batch, {
          onConflict: "question_source_id",
          ignoreDuplicates: false,
        });

      if (error) {
        failedRows += batch.length;
        failures.push({
          batchNumber: index + 1,
          rowCount: batch.length,
          error: error.message,
        });
        continue;
      }

      syncedRows += batch.length;
    }
  }

  const syncReportPath = path.join(EXPORTS_GENERATED_DIR, "supabase.questions.sync-report.json");
  await writeJsonFile(syncReportPath, {
    inputPath: relativeToRepo(inputPath),
    totalRows: rows.length,
    processedRows: limitedRows.length,
    batchSize,
    batchCount: batches.length,
    dryRun: Boolean(options.dryRun),
    syncedRows,
    failedRows,
    failures,
  });

  return {
    syncedRows,
    failedRows,
    batchCount: batches.length,
    syncReportPath: relativeToRepo(syncReportPath),
  };
}
