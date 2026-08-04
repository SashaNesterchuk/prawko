import path from "node:path";

import {
  mediaBuildJobSchema,
  mediaManifestEntrySchema,
  normalizedQuestionSchema,
  questionDeliveryAssetSchema,
  questionMediaReferenceSchema,
} from "@prawko/schemas";
import type { MediaBuildJob, QuestionDeliveryAsset, QuestionMediaReference } from "@prawko/schemas";

import {
  DELIVERY_GENERATED_DIR,
  EXPORTS_GENERATED_DIR,
  INTERIM_GENERATED_DIR,
  NORMALIZED_GENERATED_DIR,
  RAW_MEDIA_DIR,
  RAW_XLSX_DIR,
} from "./constants";
import {
  buildMediaBuildPlan,
  buildQuestionMediaReferences,
  loadMediaAliases,
  scanMediaSources,
} from "./media";
import { normalizeRows } from "./normalize";
import { loadTranslationOverlays } from "./overlays";
import type { PipelineOptions, PipelineResult } from "./types";
import {
  ensureGeneratedDirs,
  readJsonFile,
  resolveNewestFile,
  writeJsonFile,
} from "./utils";
import { validateDataset } from "./validate";
import { loadWorkbook } from "./workbook";

async function resolveWorkbookPath(xlsxPath?: string): Promise<string> {
  if (xlsxPath) {
    return xlsxPath;
  }

  const latestWorkbook = await resolveNewestFile(RAW_XLSX_DIR, [".xlsx", ".xls"]);
  if (!latestWorkbook) {
    throw new Error(
      `No XLSX workbook found. Put the official file into ${RAW_XLSX_DIR}.`
    );
  }

  return latestWorkbook;
}

function buildSupabaseQuestionExport(questions: ReturnType<typeof normalizedQuestionSchema.parse>[]) {
  return questions.map((question) => ({
    question_source_id: question.questionSourceId,
    source_row_number: question.sourceRowNumber,
    question_pl: question.questionPl,
    question_ua: question.questionUa,
    question_en: question.questionEn,
    question_de: question.questionDe,
    explanation_pl: question.explanationPl,
    explanation_ua: question.explanationUa,
    explanation_en: question.explanationEn,
    answer_type: question.answerType,
    correct_answer: question.correctAnswer,
    option_a: question.optionA,
    option_b: question.optionB,
    option_c: question.optionC,
    option_a_ua: question.optionAUa,
    option_b_ua: question.optionBUa,
    option_c_ua: question.optionCUa,
    option_a_en: question.optionAEn,
    option_b_en: question.optionBEn,
    option_c_en: question.optionCEn,
    option_a_de: question.optionADe,
    option_b_de: question.optionBDe,
    option_c_de: question.optionCDe,
    media_filename: question.mediaFilename,
    pjm_question_media_filename: question.pjmQuestionMediaFilename,
    pjm_answer_a_media_filename: question.pjmAnswerAMediaFilename,
    pjm_answer_b_media_filename: question.pjmAnswerBMediaFilename,
    pjm_answer_c_media_filename: question.pjmAnswerCMediaFilename,
    media_type: question.mediaType === "none" ? null : question.mediaType,
    points: question.points,
    scope: question.scope,
    categories: question.categories,
    topic_block: question.topicBlock,
    difficulty_seed: question.difficultySeed,
    has_media: question.hasMedia,
  }));
}

function createQuestionDeliveryAsset(
  reference: QuestionMediaReference | undefined,
  job: MediaBuildJob | undefined
): QuestionDeliveryAsset | null {
  if (!reference || !job || !reference.resolvedFilename) {
    return null;
  }

  return questionDeliveryAssetSchema.parse({
    mediaKey: job.mediaKey,
    sourceKind: reference.sourceKind,
    mediaType: job.mediaType,
    originalFilename: reference.originalFilename,
    resolvedFilename: reference.resolvedFilename,
    matchStrategy: reference.matchStrategy,
    storageBucket: job.storageBucket,
    storagePath: job.storagePath,
    posterStorageBucket: job.posterStorageBucket,
    posterStoragePath: job.posterStoragePath,
  });
}

function buildQuestionDeliveryAssetMap(
  questions: ReturnType<typeof normalizedQuestionSchema.parse>[],
  mediaReferences: QuestionMediaReference[],
  mediaBuildPlan: MediaBuildJob[]
) {
  const buildJobsByMediaKey = new Map(
    mediaBuildPlan.map((job) => [job.mediaKey, job])
  );
  const referencesByKey = new Map(
    mediaReferences.map((reference) => [reference.referenceId, reference])
  );

  return new Map(
    questions.map((question) => {
      const primaryReference = referencesByKey.get(
        `${question.questionSourceId}:primary:-`
      );
      const pjmQuestionReference = referencesByKey.get(
        `${question.questionSourceId}:pjm_question:-`
      );
      const pjmAnswerAReference = referencesByKey.get(
        `${question.questionSourceId}:pjm_answer:A`
      );
      const pjmAnswerBReference = referencesByKey.get(
        `${question.questionSourceId}:pjm_answer:B`
      );
      const pjmAnswerCReference = referencesByKey.get(
        `${question.questionSourceId}:pjm_answer:C`
      );

      return [
        question.questionSourceId,
        {
          mediaAsset: createQuestionDeliveryAsset(
            primaryReference,
            primaryReference?.mediaKey
              ? buildJobsByMediaKey.get(primaryReference.mediaKey)
              : undefined
          ),
          pjmQuestionAsset: createQuestionDeliveryAsset(
            pjmQuestionReference,
            pjmQuestionReference?.mediaKey
              ? buildJobsByMediaKey.get(pjmQuestionReference.mediaKey)
              : undefined
          ),
          pjmAnswerAAsset: createQuestionDeliveryAsset(
            pjmAnswerAReference,
            pjmAnswerAReference?.mediaKey
              ? buildJobsByMediaKey.get(pjmAnswerAReference.mediaKey)
              : undefined
          ),
          pjmAnswerBAsset: createQuestionDeliveryAsset(
            pjmAnswerBReference,
            pjmAnswerBReference?.mediaKey
              ? buildJobsByMediaKey.get(pjmAnswerBReference.mediaKey)
              : undefined
          ),
          pjmAnswerCAsset: createQuestionDeliveryAsset(
            pjmAnswerCReference,
            pjmAnswerCReference?.mediaKey
              ? buildJobsByMediaKey.get(pjmAnswerCReference.mediaKey)
              : undefined
          ),
        },
      ] as const;
    })
  );
}

function buildSupabaseQuestionExportWithAssets(
  questions: ReturnType<typeof normalizedQuestionSchema.parse>[],
  mediaReferences: QuestionMediaReference[],
  mediaBuildPlan: MediaBuildJob[]
) {
  const assetsByQuestionSourceId = buildQuestionDeliveryAssetMap(
    questions,
    mediaReferences,
    mediaBuildPlan
  );
  const baseExport = buildSupabaseQuestionExport(questions);

  return baseExport.map((question) => {
    const assets = assetsByQuestionSourceId.get(question.question_source_id);

    return {
      ...question,
      media_asset: assets?.mediaAsset ?? null,
      pjm_question_asset: assets?.pjmQuestionAsset ?? null,
      pjm_answer_a_asset: assets?.pjmAnswerAAsset ?? null,
      pjm_answer_b_asset: assets?.pjmAnswerBAsset ?? null,
      pjm_answer_c_asset: assets?.pjmAnswerCAsset ?? null,
    };
  });
}

function buildSupabaseQuestionAssetExport(
  questions: ReturnType<typeof normalizedQuestionSchema.parse>[],
  mediaReferences: QuestionMediaReference[],
  mediaBuildPlan: MediaBuildJob[]
) {
  const assetsByQuestionSourceId = buildQuestionDeliveryAssetMap(
    questions,
    mediaReferences,
    mediaBuildPlan
  );

  return questions.map((question) => {
    const assets = assetsByQuestionSourceId.get(question.questionSourceId);

    return {
      question_source_id: question.questionSourceId,
      media_asset: assets?.mediaAsset ?? null,
      pjm_question_asset: assets?.pjmQuestionAsset ?? null,
      pjm_answer_a_asset: assets?.pjmAnswerAAsset ?? null,
      pjm_answer_b_asset: assets?.pjmAnswerBAsset ?? null,
      pjm_answer_c_asset: assets?.pjmAnswerCAsset ?? null,
    };
  });
}

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  await ensureGeneratedDirs();

  const workbookPath = await resolveWorkbookPath(options.xlsxPath);
  const workbook = loadWorkbook(workbookPath, options.sheetName);
  const mediaManifest = await scanMediaSources(options.mediaDir ?? RAW_MEDIA_DIR);
  const overlays = await loadTranslationOverlays();
  const normalized = normalizeRows(workbook.rows, overlays);
  const mediaAliases = await loadMediaAliases(options.aliasesPath);
  const mediaReferences = buildQuestionMediaReferences(
    normalized.questions,
    mediaManifest,
    mediaAliases
  );
  const mediaBuildPlan = buildMediaBuildPlan(
    mediaReferences,
    mediaManifest,
    options.deliveryDir
  );
  const validation = validateDataset(
    normalized.questions,
    mediaManifest,
    mediaReferences,
    mediaBuildPlan,
    normalized.issues
  );

  const categoryBQuestions = normalized.questions.filter((question) =>
    question.categories.includes("B")
  );

  await Promise.all([
    writeJsonFile(
      path.join(INTERIM_GENERATED_DIR, "workbook-inspection.json"),
      workbook.inspection
    ),
    writeJsonFile(
      path.join(INTERIM_GENERATED_DIR, "raw-row-count.json"),
      { rowCount: workbook.rows.length }
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "media-manifest.json"),
      mediaManifest
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "question-media-references.json"),
      mediaReferences
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "media-aliases.resolved.json"),
      mediaAliases
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "media-build-plan.json"),
      mediaBuildPlan
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "questions.all.json"),
      normalized.questions
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "questions.category-b.json"),
      categoryBQuestions
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "validation-report.json"),
      validation.issues
    ),
    writeJsonFile(
      path.join(NORMALIZED_GENERATED_DIR, "summary.json"),
      validation.summary
    ),
    writeJsonFile(
      path.join(EXPORTS_GENERATED_DIR, "supabase.questions.category-b.json"),
      buildSupabaseQuestionExportWithAssets(
        categoryBQuestions,
        mediaReferences,
        mediaBuildPlan
      )
    ),
    writeJsonFile(
      path.join(EXPORTS_GENERATED_DIR, "supabase.question-media-links.category-b.json"),
      mediaReferences.filter((reference) =>
        categoryBQuestions.some(
          (question) => question.questionSourceId === reference.questionSourceId
        )
      )
    ),
    writeJsonFile(
      path.join(
        EXPORTS_GENERATED_DIR,
        "supabase.question-delivery-assets.category-b.json"
      ),
      buildSupabaseQuestionAssetExport(
        categoryBQuestions,
        mediaReferences,
        mediaBuildPlan
      )
    ),
    writeJsonFile(
      path.join(DELIVERY_GENERATED_DIR, "media-build-plan.json"),
      mediaBuildPlan
    ),
  ]);

  if (
    options.failOnWarnings &&
    validation.issues.some((issue) => issue.severity === "warning")
  ) {
    throw new Error("Pipeline completed with warnings and failOnWarnings=true.");
  }

  if (validation.issues.some((issue) => issue.severity === "error")) {
    throw new Error(
      `Pipeline found ${validation.summary.issues.errors} validation errors. Check data/questions/normalized/generated/validation-report.json.`
    );
  }

  return {
    sourceWorkbook: workbook.inspection,
    mediaManifest,
    mediaReferences,
    mediaBuildPlan,
    questions: normalized.questions,
    issues: validation.issues,
    summary: validation.summary,
  };
}

export async function runInspect(options: PipelineOptions = {}) {
  const workbookPath = await resolveWorkbookPath(options.xlsxPath);
  const workbook = loadWorkbook(workbookPath, options.sheetName);
  const mediaManifest = await scanMediaSources(options.mediaDir ?? RAW_MEDIA_DIR);
  const mediaAliases = await loadMediaAliases(options.aliasesPath);
  const normalized = normalizeRows(workbook.rows, await loadTranslationOverlays());
  const mediaReferences = buildQuestionMediaReferences(
    normalized.questions,
    mediaManifest,
    mediaAliases
  );
  const mediaBuildPlan = buildMediaBuildPlan(
    mediaReferences,
    mediaManifest,
    options.deliveryDir
  );

  return {
    workbook: workbook.inspection,
    mediaEntries: mediaManifest.length,
    mediaReferences: mediaReferences.length,
    mediaBuildJobs: mediaBuildPlan.length,
    mediaPreview: mediaManifest.slice(0, 10),
  };
}

export async function runValidate() {
  const questionsPath = path.join(
    NORMALIZED_GENERATED_DIR,
    "questions.all.json"
  );
  const mediaPath = path.join(NORMALIZED_GENERATED_DIR, "media-manifest.json");
  const mediaReferencesPath = path.join(
    NORMALIZED_GENERATED_DIR,
    "question-media-references.json"
  );
  const mediaBuildPlanPath = path.join(
    NORMALIZED_GENERATED_DIR,
    "media-build-plan.json"
  );

  const questions = normalizedQuestionSchema
    .array()
    .parse(await readJsonFile(questionsPath));
  const mediaManifest = mediaManifestEntrySchema
    .array()
    .parse(await readJsonFile(mediaPath));
  const mediaReferences = questionMediaReferenceSchema
    .array()
    .parse(await readJsonFile(mediaReferencesPath));
  const mediaBuildPlan = mediaBuildJobSchema
    .array()
    .parse(await readJsonFile(mediaBuildPlanPath));

  return validateDataset(questions, mediaManifest, mediaReferences, mediaBuildPlan);
}
