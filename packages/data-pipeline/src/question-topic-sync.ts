import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import {
  QUESTION_TOPIC_CATALOG,
  normalizeQuestionTopicId,
  normalizeQuestionTopicIds,
} from "@prawko/config";
import {
  questionTopicAssignmentSchema,
  type QuestionTopicAssignment,
} from "@prawko/schemas";
import type {
  QuestionSyncResult,
  QuestionTopicPrepareResult,
  QuestionTopicSyncResult,
  PipelineOptions,
} from "./types";

import { EXPORTS_GENERATED_DIR } from "./constants";
import { loadLocalEnvFiles } from "./env";
import { syncQuestionsToSupabase } from "./question-sync";
import {
  pathExists,
  readJsonFile,
  relativeToRepo,
  resolveRepoPath,
  writeJsonFile,
} from "./utils";

type QuestionExportRow = Record<string, unknown> & {
  question_source_id: string;
};

type FinalTopicAssignmentsPayload = {
  assignments: Array<Record<string, unknown>>;
};

type TopicCatalogInputPayload = {
  topics?: Array<Record<string, unknown>>;
};

type TopicCatalogExportRow = {
  id: string;
  sort_order: number;
  title_ua: string;
  title_pl: string;
  title_en: string;
  title_de: string;
  title_es: string;
  source_label_ua: string;
  notes_ua: string | null;
  is_active: boolean;
};

type TopicAssignmentExportRow = {
  question_source_id: string;
  source_row_number: number;
  primary_topic_id: string;
  topic_ids: string[];
};

type TopicAssignmentsInputPayload =
  | FinalTopicAssignmentsPayload
  | TopicAssignmentExportRow[];

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_QUESTION_EXPORT_FILENAME =
  "supabase.questions.category-b.with-topics.json";
const DEFAULT_TOPIC_CATALOG_EXPORT_FILENAME =
  "supabase.question-topic-catalog.category-b.json";
const DEFAULT_TOPIC_ASSIGNMENTS_EXPORT_FILENAME =
  "supabase.question-topic-assignments.category-b.json";

function chunkRows<T>(rows: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }

  return batches;
}

function getRequiredSupabaseEnv() {
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

  return { supabaseUrl, serviceRoleKey };
}

function buildTopicCatalogExportRows(): TopicCatalogExportRow[] {
  return QUESTION_TOPIC_CATALOG.map((topic) => ({
    id: topic.id,
    sort_order: topic.sortOrder,
    title_ua: topic.titleUa,
    title_pl: topic.titlePl,
    title_en: topic.titleEn,
    title_de: topic.titleDe,
    title_es: topic.titleEs,
    source_label_ua: topic.sourceLabelUa,
    notes_ua:
      "notesUa" in topic && typeof topic.notesUa === "string"
        ? topic.notesUa
        : null,
    is_active: true,
  }));
}

function validateTopicCatalogInput(
  input: TopicCatalogInputPayload | null | undefined
): void {
  if (!input?.topics) {
    return;
  }

  const inputIds = input.topics
    .map((topic) => String(topic.id ?? ""))
    .filter(Boolean);
  const normalizedInputIds = [
    ...new Set(
      inputIds.map((topicId) => {
        const normalizedTopicId = normalizeQuestionTopicId(topicId);

        if (!normalizedTopicId) {
          throw new Error(`Unknown topic id "${topicId}" in topic catalog input.`);
        }

        return normalizedTopicId;
      })
    ),
  ].sort();
  const configIds = [...QUESTION_TOPIC_CATALOG]
    .map((topic) => topic.id)
    .sort();

  if (normalizedInputIds.length !== configIds.length) {
    throw new Error(
      `Topic catalog mismatch. Input resolves to ${normalizedInputIds.length} current topics, config has ${configIds.length}.`
    );
  }

  for (let index = 0; index < configIds.length; index += 1) {
    if (normalizedInputIds[index] !== configIds[index]) {
      throw new Error(
        `Topic catalog mismatch at index ${index}. Expected "${configIds[index]}", got "${normalizedInputIds[index]}".`
      );
    }
  }
}

function toTopicAssignmentExportRow(
  row: QuestionTopicAssignment
): TopicAssignmentExportRow {
  if (!row.topicIds.includes(row.primaryTopicId)) {
    throw new Error(
      `Primary topic "${row.primaryTopicId}" is missing from topicIds for question ${row.questionSourceId}.`
    );
  }

  return {
    question_source_id: row.questionSourceId,
    source_row_number: row.sourceRowNumber,
    primary_topic_id: row.primaryTopicId,
    topic_ids: row.topicIds,
  };
}

function parseTopicAssignmentRow(
  row: Record<string, unknown>
): QuestionTopicAssignment {
  const questionSourceId =
    row.questionSourceId ?? row.question_source_id;
  const sourceRowNumber =
    row.sourceRowNumber ?? row.source_row_number;
  const rawPrimaryTopicId =
    row.primaryTopicId ?? row.primary_topic_id;
  const rawTopicIds = row.topicIds ?? row.topic_ids;

  if (typeof rawPrimaryTopicId !== "string") {
    throw new Error(
      `Missing primary topic id for question ${String(questionSourceId ?? "unknown")}.`
    );
  }

  if (
    !Array.isArray(rawTopicIds) ||
    rawTopicIds.some((topicId) => typeof topicId !== "string")
  ) {
    throw new Error(
      `Invalid topic ids for question ${String(questionSourceId ?? "unknown")}.`
    );
  }

  const primaryTopicId = normalizeQuestionTopicId(rawPrimaryTopicId);

  if (!primaryTopicId) {
    throw new Error(
      `Unknown primary topic "${rawPrimaryTopicId}" for question ${String(questionSourceId ?? "unknown")}.`
    );
  }

  const unknownTopicId = rawTopicIds.find(
    (topicId) => !normalizeQuestionTopicId(topicId)
  );

  if (unknownTopicId) {
    throw new Error(
      `Unknown topic "${unknownTopicId}" for question ${String(questionSourceId ?? "unknown")}.`
    );
  }

  const normalizedTopicIds = normalizeQuestionTopicIds(rawTopicIds);

  return questionTopicAssignmentSchema.parse({
    questionSourceId,
    sourceRowNumber,
    primaryTopicId,
    topicIds: [
      primaryTopicId,
      ...normalizedTopicIds.filter((topicId) => topicId !== primaryTopicId),
    ],
  });
}

function buildTopicAssignmentExportRows(
  payload: TopicAssignmentsInputPayload
): TopicAssignmentExportRow[] {
  const sourceRows = Array.isArray(payload)
    ? payload
    : payload.assignments;

  if (!Array.isArray(sourceRows)) {
    throw new Error(
      "Invalid topic assignments payload. Expected question_topics.final.json with an assignments array or a generated assignment export array."
    );
  }

  return sourceRows
    .map((row) => parseTopicAssignmentRow(row))
    .map((row) => toTopicAssignmentExportRow(row));
}

async function resolveTopicAssignmentsInputPath(
  options: PipelineOptions
): Promise<string> {
  if (options.topicAssignmentsPath) {
    return resolveRepoPath(options.topicAssignmentsPath);
  }

  const generatedAssignmentsPath = resolveRepoPath(
    path.join(
      EXPORTS_GENERATED_DIR,
      DEFAULT_TOPIC_ASSIGNMENTS_EXPORT_FILENAME
    )
  );

  if (await pathExists(generatedAssignmentsPath)) {
    return generatedAssignmentsPath;
  }

  throw new Error(
    [
      "Missing normalized topic assignments input.",
      "Pass --topic-assignments <path-to-question_topics.final.json> on the first run.",
      "After the first successful prepare, the generated export can be reused automatically.",
    ].join(" ")
  );
}

export async function prepareNormalizedQuestionTopics(
  options: PipelineOptions = {}
): Promise<QuestionTopicPrepareResult> {
  const baseQuestionExportPath = resolveRepoPath(
    options.inputPath ??
      path.join(EXPORTS_GENERATED_DIR, "supabase.questions.category-b.json")
  );
  const topicAssignmentsPath = await resolveTopicAssignmentsInputPath(options);
  const topicCatalogInputPath = options.topicCatalogPath
    ? resolveRepoPath(options.topicCatalogPath)
    : null;

  const baseQuestions = await readJsonFile<QuestionExportRow[]>(baseQuestionExportPath);
  const topicAssignmentsInput = await readJsonFile<TopicAssignmentsInputPayload>(
    topicAssignmentsPath
  );
  const topicCatalogInput = topicCatalogInputPath
    ? await readJsonFile<TopicCatalogInputPayload>(topicCatalogInputPath)
    : null;

  validateTopicCatalogInput(topicCatalogInput);

  const assignmentRows = buildTopicAssignmentExportRows(topicAssignmentsInput);
  const assignmentsByQuestionSourceId = new Map(
    assignmentRows.map((row) => [row.question_source_id, row])
  );
  const baseQuestionSourceIds = new Set(
    baseQuestions.map((row) => row.question_source_id)
  );

  if (assignmentsByQuestionSourceId.size !== assignmentRows.length) {
    throw new Error("Duplicate question_source_id found in final topic assignments.");
  }

  const missingAssignments = baseQuestions.filter(
    (row) => !assignmentsByQuestionSourceId.has(row.question_source_id)
  );

  if (missingAssignments.length > 0) {
    throw new Error(
      `Missing normalized topic assignments for ${missingAssignments.length} exported questions. First missing id: ${missingAssignments[0]?.question_source_id ?? "unknown"}.`
    );
  }

  const extraAssignments = assignmentRows.filter(
    (row) => !baseQuestionSourceIds.has(row.question_source_id)
  );

  if (extraAssignments.length > 0) {
    throw new Error(
      `Found ${extraAssignments.length} topic assignments without a matching exported question. First extra id: ${extraAssignments[0]?.question_source_id ?? "unknown"}.`
    );
  }

  const mergedQuestions = baseQuestions.map((row) => {
    const assignment = assignmentsByQuestionSourceId.get(row.question_source_id);

    if (!assignment) {
      throw new Error(
        `Missing normalized topic assignment for question ${row.question_source_id}.`
      );
    }

    return {
      ...row,
      primary_topic_id: assignment.primary_topic_id,
      topic_ids: assignment.topic_ids,
    };
  });

  const topicCatalogExport = buildTopicCatalogExportRows();
  const questionExportWithTopicsPath = path.join(
    EXPORTS_GENERATED_DIR,
    DEFAULT_QUESTION_EXPORT_FILENAME
  );
  const topicCatalogExportPath = path.join(
    EXPORTS_GENERATED_DIR,
    DEFAULT_TOPIC_CATALOG_EXPORT_FILENAME
  );
  const topicAssignmentsExportPath = path.join(
    EXPORTS_GENERATED_DIR,
    DEFAULT_TOPIC_ASSIGNMENTS_EXPORT_FILENAME
  );

  await Promise.all([
    writeJsonFile(questionExportWithTopicsPath, mergedQuestions),
    writeJsonFile(topicCatalogExportPath, topicCatalogExport),
    writeJsonFile(topicAssignmentsExportPath, assignmentRows),
  ]);

  return {
    baseQuestionExportPath: relativeToRepo(baseQuestionExportPath),
    topicAssignmentsPath: relativeToRepo(topicAssignmentsPath),
    topicCatalogInputPath: topicCatalogInputPath
      ? relativeToRepo(topicCatalogInputPath)
      : null,
    questionExportWithTopicsPath: relativeToRepo(questionExportWithTopicsPath),
    topicCatalogExportPath: relativeToRepo(topicCatalogExportPath),
    topicAssignmentsExportPath: relativeToRepo(topicAssignmentsExportPath),
    questionCount: mergedQuestions.length,
    topicCount: topicCatalogExport.length,
    assignmentCount: assignmentRows.length,
  };
}

async function syncTopicCatalogRowsToSupabase(
  rows: TopicCatalogExportRow[],
  options: PipelineOptions = {}
): Promise<{
  syncedRows: number;
  failedRows: number;
  failures: Array<{ batchNumber: number; rowCount: number; error: string }>;
}> {
  const limitedRows =
    typeof options.limit === "number" && options.limit > 0
      ? rows.slice(0, options.limit)
      : rows;
  const batchSize =
    typeof options.batchSize === "number" && options.batchSize > 0
      ? options.batchSize
      : DEFAULT_BATCH_SIZE;
  const batches = chunkRows(limitedRows, batchSize);
  const failures: Array<{ batchNumber: number; rowCount: number; error: string }> = [];

  let syncedRows = 0;
  let failedRows = 0;

  if (!options.dryRun) {
    await loadLocalEnvFiles();
    const { supabaseUrl, serviceRoleKey } = getRequiredSupabaseEnv();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const { error } = await supabase
        .from("question_topic_catalog")
        .upsert(batch, {
          onConflict: "id",
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

  return {
    syncedRows,
    failedRows,
    failures,
  };
}

export async function syncNormalizedQuestionTopicsToSupabase(
  options: PipelineOptions = {}
): Promise<QuestionTopicSyncResult> {
  const prepared = await prepareNormalizedQuestionTopics(options);
  const topicCatalogRows = await readJsonFile<TopicCatalogExportRow[]>(
    resolveRepoPath(prepared.topicCatalogExportPath)
  );

  const topicCatalogSync = await syncTopicCatalogRowsToSupabase(
    topicCatalogRows,
    options
  );
  const questionSync: QuestionSyncResult = await syncQuestionsToSupabase({
    ...options,
    inputPath: prepared.questionExportWithTopicsPath,
  });

  const syncReportPath = path.join(
    EXPORTS_GENERATED_DIR,
    "supabase.question-topics.sync-report.json"
  );
  await writeJsonFile(syncReportPath, {
    prepared,
    dryRun: Boolean(options.dryRun),
    topicCatalogSyncedRows: topicCatalogSync.syncedRows,
    topicCatalogFailedRows: topicCatalogSync.failedRows,
    topicCatalogFailures: topicCatalogSync.failures,
    questionSync,
  });

  return {
    prepared,
    topicCatalogSyncedRows: topicCatalogSync.syncedRows,
    topicCatalogFailedRows: topicCatalogSync.failedRows,
    questionSync,
    syncReportPath: relativeToRepo(syncReportPath),
  };
}
