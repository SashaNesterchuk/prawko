import type { SupportedLocale } from "@prawko/config";
import type {
  MediaBuildJob,
  MediaManifestEntry,
  NormalizedQuestion,
  QuestionMediaReference,
  TranslationOverlayEntry,
} from "@prawko/schemas";

export interface SourceRow {
  sourceRowNumber: number;
  cells: Record<string, string>;
  normalizedCells: Record<string, string>;
}

export interface WorkbookInspection {
  sourcePath: string;
  selectedSheetName: string;
  availableSheetNames: string[];
  headerRowIndex: number;
  headers: string[];
  rowCount: number;
}

export interface PipelineOptions {
  xlsxPath?: string;
  sheetName?: string;
  mediaDir?: string;
  aliasesPath?: string;
  deliveryDir?: string;
  inputPath?: string;
  topicCatalogPath?: string;
  topicAssignmentsPath?: string;
  failOnWarnings?: boolean;
  skipExisting?: boolean;
  dryRun?: boolean;
  limit?: number;
  batchSize?: number;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  questionSourceId?: string;
  sourceRowNumber?: number;
}

export interface PipelineSummary {
  totalQuestions: number;
  categoryBQuestions: number;
  totalMediaEntries: number;
  totalMediaReferences: number;
  totalMediaBuildJobs: number;
  issues: {
    errors: number;
    warnings: number;
  };
  countsByCategory: Record<string, number>;
  countsByScope: Record<string, number>;
  countsByTopicBlock: Record<string, number>;
  countsByPoints: Record<string, number>;
}

export interface PipelineResult {
  sourceWorkbook: WorkbookInspection;
  mediaManifest: MediaManifestEntry[];
  mediaReferences: QuestionMediaReference[];
  mediaBuildPlan: MediaBuildJob[];
  questions: NormalizedQuestion[];
  issues: ValidationIssue[];
  summary: PipelineSummary;
}

export interface OverlayCollection {
  questions: Partial<Record<SupportedLocale, Map<string, TranslationOverlayEntry>>>;
  explanations: Partial<
    Record<SupportedLocale, Map<string, TranslationOverlayEntry>>
  >;
  issues: ValidationIssue[];
}

export interface MediaBuildResult {
  processedJobs: number;
  createdAssets: number;
  createdPosters: number;
  skippedJobs: number;
  failedJobs: number;
  outputManifestPath: string;
  buildReportPath: string;
}

export interface MediaUploadResult {
  uploadedObjects: number;
  failedObjects: number;
  uploadReportPath: string;
}

export interface QuestionSyncResult {
  syncedRows: number;
  failedRows: number;
  batchCount: number;
  syncReportPath: string;
}

export interface QuestionTopicPrepareResult {
  baseQuestionExportPath: string;
  topicAssignmentsPath: string;
  topicCatalogInputPath: string | null;
  questionExportWithTopicsPath: string;
  topicCatalogExportPath: string;
  topicAssignmentsExportPath: string;
  questionCount: number;
  topicCount: number;
  assignmentCount: number;
}

export interface QuestionTopicSyncResult {
  prepared: QuestionTopicPrepareResult;
  topicCatalogSyncedRows: number;
  topicCatalogFailedRows: number;
  questionSync: QuestionSyncResult;
  syncReportPath: string;
}
