import path from "node:path";

import {
  isQuestionTopicId,
  type QuestionTopicId,
} from "@prawko/config";
import XLSX from "xlsx";

import { EXPORTS_GENERATED_DIR, INTERIM_GENERATED_DIR } from "./constants";
import type { CategorizedWorkbookTopicPrepareResult, PipelineOptions } from "./types";
import {
  readJsonFile,
  relativeToRepo,
  resolveRepoPath,
  splitCategories,
  toTrimmedString,
  writeJsonFile,
} from "./utils";

type BaseQuestionExportRow = {
  question_source_id: string;
  source_row_number: number;
};

type WorkbookCategoryAssignment = {
  categoryId: QuestionTopicId;
  workbookRowNumber: number;
};

type ManualFallbackAssignment = {
  categoryId: QuestionTopicId;
  reason: string;
};

const CATEGORIZED_SHEET_NAME = "katalog";
const DEFAULT_ASSIGNMENTS_FILENAME =
  "supabase.question-topic-assignments.category-b.json";
const DEFAULT_REPORT_FILENAME =
  "categorized-workbook-topic-assignment-report.category-b.json";

/**
 * These question IDs are in the current Supabase Category B export but were
 * replaced or removed in the newer official workbook. They are retained and
 * categorized manually so no existing question row is lost.
 */
const MANUAL_FALLBACK_ASSIGNMENTS: Record<string, ManualFallbackAssignment> = {
  "2443": {
    categoryId: "roads_zones_crossings",
    reason: "Railway-crossing question absent from categorized workbook.",
  },
  "13462": {
    categoryId: "roads_zones_crossings",
    reason:
      "Railway-crossing question absent from categorized workbook; equivalent newer question is 14108.",
  },
  "13556": {
    categoryId: "speed_distance",
    reason: "Speed-limit enforcement question absent from categorized workbook.",
  },
  "13566": {
    categoryId: "vehicle_equipment",
    reason:
      "Vehicle speed-assistance-system question absent from categorized workbook.",
  },
  "13575": {
    categoryId: "intersections_priority",
    reason: "Intersection right-of-way question absent from categorized workbook.",
  },
  "13576": {
    categoryId: "intersections_priority",
    reason: "Intersection yield question absent from categorized workbook.",
  },
  "13616": {
    categoryId: "other_road_users",
    reason:
      "Personal mobility device and pedestrian-crossing question absent from categorized workbook.",
  },
};

function getRequiredColumnIndex(headers: unknown[], header: string): number {
  const index = headers.findIndex(
    (candidate) => toTrimmedString(candidate).toLowerCase() === header.toLowerCase()
  );

  if (index < 0) {
    throw new Error(
      `Categorized workbook is missing required "${header}" column in "${CATEGORIZED_SHEET_NAME}".`
    );
  }

  return index;
}

function getBaseQuestionExportPath(options: PipelineOptions): string {
  return resolveRepoPath(
    options.inputPath ??
      path.join(EXPORTS_GENERATED_DIR, "supabase.questions.category-b.json")
  );
}

function getAssignmentOutputPath(): string {
  return path.join(EXPORTS_GENERATED_DIR, DEFAULT_ASSIGNMENTS_FILENAME);
}

function getReportOutputPath(): string {
  return path.join(INTERIM_GENERATED_DIR, DEFAULT_REPORT_FILENAME);
}

export async function prepareTopicsFromCategorizedWorkbook(
  options: PipelineOptions = {}
): Promise<CategorizedWorkbookTopicPrepareResult> {
  if (!options.xlsxPath) {
    throw new Error(
      "Missing categorized workbook. Pass --xlsx <path-to-KATALOG_..._@categorized.xlsx>."
    );
  }

  const workbookPath = resolveRepoPath(options.xlsxPath);
  const baseQuestionExportPath = getBaseQuestionExportPath(options);
  const workbook = XLSX.readFile(workbookPath, {
    cellDates: false,
    raw: false,
  });
  const worksheet = workbook.Sheets[CATEGORIZED_SHEET_NAME];

  if (!worksheet) {
    throw new Error(
      `Categorized workbook does not contain "${CATEGORIZED_SHEET_NAME}" worksheet.`
    );
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  });
  const headers = matrix[0] ?? [];
  const questionIdIndex = getRequiredColumnIndex(headers, "Numer pytania");
  const categoriesIndex = getRequiredColumnIndex(headers, "Kategorie");
  const categoryIdIndex = getRequiredColumnIndex(headers, "category_id");
  const assignmentsFromWorkbook = new Map<string, WorkbookCategoryAssignment>();

  matrix.slice(1).forEach((row, index) => {
    const questionSourceId = toTrimmedString(row[questionIdIndex]);

    if (!questionSourceId) {
      return;
    }

    if (!splitCategories(toTrimmedString(row[categoriesIndex])).includes("B")) {
      return;
    }

    const rawCategoryId = toTrimmedString(row[categoryIdIndex]);

    if (!isQuestionTopicId(rawCategoryId)) {
      throw new Error(
        `Invalid category_id "${rawCategoryId || "(empty)"}" for question ${questionSourceId} at workbook row ${index + 2}.`
      );
    }

    if (assignmentsFromWorkbook.has(questionSourceId)) {
      throw new Error(
        `Duplicate "Numer pytania" value ${questionSourceId} in categorized workbook.`
      );
    }

    assignmentsFromWorkbook.set(questionSourceId, {
      categoryId: rawCategoryId,
      workbookRowNumber: index + 2,
    });
  });

  const baseQuestions = await readJsonFile<BaseQuestionExportRow[]>(
    baseQuestionExportPath
  );
  const baseQuestionIds = new Set(
    baseQuestions.map((question) => question.question_source_id)
  );
  const usedFallbackIds: string[] = [];

  const assignments = baseQuestions.map((question) => {
    const workbookAssignment = assignmentsFromWorkbook.get(
      question.question_source_id
    );

    if (workbookAssignment) {
      return {
        questionSourceId: question.question_source_id,
        sourceRowNumber: question.source_row_number,
        primaryTopicId: workbookAssignment.categoryId,
        topicIds: [workbookAssignment.categoryId],
      };
    }

    const fallback = MANUAL_FALLBACK_ASSIGNMENTS[question.question_source_id];

    if (fallback) {
      usedFallbackIds.push(question.question_source_id);

      return {
        questionSourceId: question.question_source_id,
        sourceRowNumber: question.source_row_number,
        primaryTopicId: fallback.categoryId,
        topicIds: [fallback.categoryId],
      };
    }

    throw new Error(
      `No categorized-workbook or manual fallback assignment for existing question ${question.question_source_id}.`
    );
  });

  const unneededFallbackIds = Object.keys(MANUAL_FALLBACK_ASSIGNMENTS).filter(
    (questionSourceId) => !usedFallbackIds.includes(questionSourceId)
  );

  if (unneededFallbackIds.length > 0) {
    throw new Error(
      `Manual fallback assignments no longer match the base export: ${unneededFallbackIds.join(", ")}.`
    );
  }

  const workbookOnlyQuestionIds = [...assignmentsFromWorkbook.keys()].filter(
    (questionSourceId) => !baseQuestionIds.has(questionSourceId)
  );
  const assignmentsPath = getAssignmentOutputPath();
  const reportPath = getReportOutputPath();

  await Promise.all([
    writeJsonFile(assignmentsPath, {
      source: {
        workbookPath: relativeToRepo(workbookPath),
        worksheet: CATEGORIZED_SHEET_NAME,
        categoryColumn: "category_id",
      },
      assignments,
    }),
    writeJsonFile(reportPath, {
      baseQuestionCount: baseQuestions.length,
      categorizedWorkbookAssignments: assignmentsFromWorkbook.size,
      matchedWorkbookAssignments: assignments.length - usedFallbackIds.length,
      manualFallbackAssignments: usedFallbackIds.map((questionSourceId) => ({
        questionSourceId,
        ...MANUAL_FALLBACK_ASSIGNMENTS[questionSourceId],
      })),
      workbookOnlyQuestionIds,
    }),
  ]);

  return {
    baseQuestionExportPath: relativeToRepo(baseQuestionExportPath),
    workbookPath: relativeToRepo(workbookPath),
    assignmentsPath: relativeToRepo(assignmentsPath),
    reportPath: relativeToRepo(reportPath),
    questionCount: assignments.length,
    workbookAssignmentCount: assignmentsFromWorkbook.size,
    manualFallbackAssignmentCount: usedFallbackIds.length,
    workbookOnlyQuestionIds,
  };
}
