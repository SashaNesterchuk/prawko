import {
  ACTIVE_CATEGORIES,
  AI_LIMITS,
  AI_MESSAGE_KINDS,
  AI_MESSAGE_ROLES,
  AI_PROVIDER_IDS,
  QUESTION_TOPIC_IDS,
  MEDIA_MATCH_STRATEGIES,
  MEDIA_SOURCE_KINDS,
  MEDIA_STORAGE_BUCKET_IDS,
  PLAN_LEVELS,
  QUESTION_ANSWER_TYPES,
  QUESTION_MEDIA_TYPES,
  QUESTION_SCOPES,
  SOURCE_MEDIA_COLLECTIONS,
  STUDY_PLAN_LIMITS,
  STUDY_PLAN_TASK_TYPES,
  SUPPORTED_LOCALES,
  TOPIC_BLOCK_IDS,
  type QuestionTopicId,
} from "@prawko/config";
import { z } from "zod";

export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const categorySchema = z.enum(ACTIVE_CATEGORIES);
export const planLevelSchema = z.enum(PLAN_LEVELS);
export const topicBlockSchema = z.enum(TOPIC_BLOCK_IDS);
export const questionTopicIdSchema = z.enum(
  QUESTION_TOPIC_IDS as unknown as [QuestionTopicId, ...QuestionTopicId[]]
);
export const questionScopeSchema = z.enum(QUESTION_SCOPES);
export const answerTypeSchema = z.enum(QUESTION_ANSWER_TYPES);
export const mediaTypeSchema = z.enum(QUESTION_MEDIA_TYPES);
export const storedMediaTypeSchema = z.enum(["image", "video"]);
export const sourceMediaCollectionSchema = z.enum(SOURCE_MEDIA_COLLECTIONS);
export const mediaSourceKindSchema = z.enum(MEDIA_SOURCE_KINDS);
export const mediaMatchStrategySchema = z.enum(MEDIA_MATCH_STRATEGIES);
export const mediaStorageBucketSchema = z.enum(MEDIA_STORAGE_BUCKET_IDS);
export const studyPlanTaskTypeSchema = z.enum(STUDY_PLAN_TASK_TYPES);
export const aiProviderSchema = z.enum(AI_PROVIDER_IDS);
export const aiMessageRoleSchema = z.enum(AI_MESSAGE_ROLES);
export const aiMessageKindSchema = z.enum(AI_MESSAGE_KINDS);

export const studyPlanSetupSchema = z.object({
  locale: localeSchema,
  category: categorySchema.default("B"),
  daysUntilExam: z
    .number()
    .int()
    .min(STUDY_PLAN_LIMITS.minDays)
    .max(STUDY_PLAN_LIMITS.maxDays),
  minutesPerDay: z
    .number()
    .int()
    .min(STUDY_PLAN_LIMITS.minMinutesPerDay)
    .max(STUDY_PLAN_LIMITS.maxMinutesPerDay),
  level: planLevelSchema,
  schoolCode: z.string().trim().max(64).optional(),
});

export const generatedStudyPlanTaskSchema = z.object({
  id: z.string().min(1),
  taskType: studyPlanTaskTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedMinutes: z.number().int().min(1).max(180),
  questionCountTarget: z.number().int().min(1).max(64).optional(),
  /** Catalog topic id (question_topic_catalog). Legacy key name kept for RPC payloads. */
  topicBlock: questionTopicIdSchema.optional(),
  countsForMinimum: z.boolean().default(false),
});

export const generatedStudyPlanDaySchema = z.object({
  id: z.string().min(1),
  dayNumber: z.number().int().min(1).max(STUDY_PLAN_LIMITS.maxDays),
  planDate: z.string().min(10).max(10),
  focusTopic: questionTopicIdSchema.optional(),
  estimatedMinutes: z.number().int().min(1).max(STUDY_PLAN_LIMITS.maxMinutesPerDay),
  minimumMode: z.boolean().default(false),
  tasks: z.array(generatedStudyPlanTaskSchema).min(1),
});

export const generatedStudyPlanSummarySchema = z.object({
  minimumModeDays: z.number().int().min(0),
  fullExamDays: z.number().int().min(0),
  miniTestDays: z.number().int().min(0),
  weakSpotDays: z.number().int().min(0),
});

export const generatedStudyPlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  locale: localeSchema,
  category: categorySchema,
  level: planLevelSchema,
  examDate: z.string().min(10).max(10),
  daysPlanned: z
    .number()
    .int()
    .min(1)
    .max(STUDY_PLAN_LIMITS.maxDays),
  minutesPerDay: z
    .number()
    .int()
    .min(STUDY_PLAN_LIMITS.minMinutesPerDay)
    .max(STUDY_PLAN_LIMITS.maxMinutesPerDay),
  schoolCode: z.string().trim().max(64).optional(),
  generatorVersion: z.string().min(1),
  summary: generatedStudyPlanSummarySchema,
  days: z.array(generatedStudyPlanDaySchema).min(1),
});

export const questionChatMessageSchema = z.object({
  id: z.string().min(1),
  role: aiMessageRoleSchema,
  content: z.string().trim().min(1).max(4000),
  createdAt: z.string().min(1),
  provider: aiProviderSchema.optional(),
  model: z.string().min(1).optional(),
});

export const questionChatOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const questionChatContextSchema = z.object({
  questionId: z.string().min(1),
  locale: localeSchema,
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  correctAnswer: z.string().min(1),
  selectedAnswer: z.string().min(1).optional(),
  answerType: answerTypeSchema,
  topicId: questionTopicIdSchema,
  /** @deprecated Prefer topicId; kept for older clients during rollout. */
  topicBlock: topicBlockSchema.optional(),
  scope: questionScopeSchema,
  points: z.number().int().min(1).max(3),
  options: z.array(questionChatOptionSchema).max(3),
  mediaType: mediaTypeSchema,
});

export const questionChatRequestSchema = z.object({
  conversationId: z.string().min(1),
  locale: localeSchema,
  prompt: z.string().trim().min(1).max(AI_LIMITS.maxPromptChars),
  question: questionChatContextSchema,
  history: z.array(questionChatMessageSchema).max(AI_LIMITS.maxHistoryMessages),
});

export const questionChatResponseSchema = z.object({
  conversationId: z.string().min(1),
  provider: aiProviderSchema,
  model: z.string().min(1),
  message: questionChatMessageSchema.extend({
    role: z.literal("assistant"),
    provider: aiProviderSchema,
    model: z.string().min(1),
  }),
  fallbackUsed: z.boolean().default(false),
  remainingFreeMessages: z.number().int().min(0).nullable().optional(),
});

export const todayTaskSchema = z.object({
  id: z.string().uuid(),
  topicBlock: questionTopicIdSchema.optional(),
  type: z.enum(["learn", "review", "mini_test", "full_exam"]),
  title: z.string().min(1),
  isCompleted: z.boolean().default(false),
});

export const normalizedQuestionSchema = z.object({
  questionSourceId: z.string().min(1),
  sourceRowNumber: z.number().int().positive(),
  questionPl: z.string().min(1),
  questionUa: z.string().nullable(),
  questionEn: z.string().nullable(),
  questionDe: z.string().nullable(),
  explanationPl: z.string().nullable(),
  explanationUa: z.string().nullable(),
  explanationEn: z.string().nullable(),
  answerType: answerTypeSchema,
  correctAnswer: z.string().min(1),
  optionA: z.string().nullable(),
  optionB: z.string().nullable(),
  optionC: z.string().nullable(),
  optionAUa: z.string().nullable(),
  optionBUa: z.string().nullable(),
  optionCUa: z.string().nullable(),
  optionAEn: z.string().nullable(),
  optionBEn: z.string().nullable(),
  optionCEn: z.string().nullable(),
  optionADe: z.string().nullable(),
  optionBDe: z.string().nullable(),
  optionCDe: z.string().nullable(),
  mediaFilename: z.string().nullable(),
  pjmQuestionMediaFilename: z.string().nullable(),
  pjmAnswerAMediaFilename: z.string().nullable(),
  pjmAnswerBMediaFilename: z.string().nullable(),
  pjmAnswerCMediaFilename: z.string().nullable(),
  mediaType: mediaTypeSchema,
  points: z.number().int().min(1).max(3),
  scope: questionScopeSchema,
  categories: z.array(z.string().min(1)).min(1),
  topicBlock: topicBlockSchema,
  primaryTopicId: questionTopicIdSchema.nullable().optional(),
  topicIds: z.array(questionTopicIdSchema).optional(),
  difficultySeed: z.number().int().min(1).max(100),
  hasMedia: z.boolean(),
});

export const questionTopicCatalogEntrySchema = z.object({
  id: questionTopicIdSchema,
  sortOrder: z.number().int().positive(),
  titleUa: z.string().min(1),
  titlePl: z.string().min(1),
  titleEn: z.string().min(1),
  titleDe: z.string().min(1),
  titleEs: z.string().min(1),
  sourceLabelUa: z.string().min(1),
  notesUa: z.string().min(1).nullable().optional(),
});

export const questionTopicAssignmentSchema = z.object({
  questionSourceId: z.string().min(1),
  sourceRowNumber: z.number().int().positive(),
  primaryTopicId: questionTopicIdSchema,
  topicIds: z.array(questionTopicIdSchema).min(1),
});

export const mediaManifestEntrySchema = z.object({
  inventoryId: z.string().min(1),
  filename: z.string().min(1),
  normalizedFilename: z.string().min(1),
  extension: z.string().min(1),
  mediaType: storedMediaTypeSchema,
  sourcePath: z.string().min(1),
  sourceType: z.enum(["file", "zip_entry"]),
  containerName: z.string().nullable(),
  archiveEntryName: z.string().nullable(),
  sizeBytes: z.number().int().min(0),
  sourceCollection: sourceMediaCollectionSchema,
});

export const questionMediaReferenceSchema = z.object({
  referenceId: z.string().min(1),
  questionSourceId: z.string().min(1),
  sourceRowNumber: z.number().int().positive(),
  sourceKind: mediaSourceKindSchema,
  answerSlot: z.enum(["A", "B", "C"]).nullable(),
  originalFilename: z.string().min(1),
  normalizedFilename: z.string().min(1),
  mediaType: storedMediaTypeSchema.nullable(),
  matchStrategy: mediaMatchStrategySchema,
  mediaKey: z.string().nullable(),
  inventoryId: z.string().nullable(),
  resolvedFilename: z.string().nullable(),
  sourcePath: z.string().nullable(),
  sourceCollection: sourceMediaCollectionSchema.nullable(),
  candidateCount: z.number().int().min(0),
});

export const mediaBuildJobReferenceSchema = z.object({
  questionSourceId: z.string().min(1),
  sourceKind: mediaSourceKindSchema,
  answerSlot: z.enum(["A", "B", "C"]).nullable(),
});

export const mediaBuildJobSchema = z.object({
  mediaKey: z.string().min(1),
  inventoryId: z.string().min(1),
  sourceKind: mediaSourceKindSchema,
  mediaType: storedMediaTypeSchema,
  sourceCollection: sourceMediaCollectionSchema,
  sourceFilename: z.string().min(1),
  sourcePath: z.string().min(1),
  sourceType: z.enum(["file", "zip_entry"]),
  containerName: z.string().nullable(),
  archiveEntryName: z.string().nullable(),
  outputFilename: z.string().min(1),
  outputPath: z.string().min(1),
  posterFilename: z.string().nullable(),
  posterPath: z.string().nullable(),
  storageBucket: mediaStorageBucketSchema,
  storagePath: z.string().min(1),
  posterStorageBucket: mediaStorageBucketSchema.nullable(),
  posterStoragePath: z.string().nullable(),
  contentType: z.string().min(1),
  posterContentType: z.string().nullable(),
  referencedBy: z.array(mediaBuildJobReferenceSchema).min(1),
});

export const questionDeliveryAssetSchema = z.object({
  mediaKey: z.string().min(1),
  sourceKind: mediaSourceKindSchema,
  mediaType: storedMediaTypeSchema,
  originalFilename: z.string().min(1),
  resolvedFilename: z.string().min(1),
  matchStrategy: mediaMatchStrategySchema,
  storageBucket: mediaStorageBucketSchema,
  storagePath: z.string().min(1),
  posterStorageBucket: mediaStorageBucketSchema.nullable(),
  posterStoragePath: z.string().nullable(),
});

export const translationOverlayEntrySchema = z.object({
  questionSourceId: z.string().min(1),
  value: z.string().trim().min(1),
});

export type StudyPlanSetupInput = z.infer<typeof studyPlanSetupSchema>;
export type GeneratedStudyPlanTask = z.infer<typeof generatedStudyPlanTaskSchema>;
export type GeneratedStudyPlanDay = z.infer<typeof generatedStudyPlanDaySchema>;
export type GeneratedStudyPlanSummary = z.infer<
  typeof generatedStudyPlanSummarySchema
>;
export type GeneratedStudyPlan = z.infer<typeof generatedStudyPlanSchema>;
export type QuestionChatMessage = z.infer<typeof questionChatMessageSchema>;
export type QuestionTopicCatalogEntry = z.infer<
  typeof questionTopicCatalogEntrySchema
>;
export type QuestionTopicAssignment = z.infer<typeof questionTopicAssignmentSchema>;
export type QuestionChatOption = z.infer<typeof questionChatOptionSchema>;
export type QuestionChatContext = z.infer<typeof questionChatContextSchema>;
export type QuestionChatRequest = z.infer<typeof questionChatRequestSchema>;
export type QuestionChatResponse = z.infer<typeof questionChatResponseSchema>;
export type TodayTask = z.infer<typeof todayTaskSchema>;
export type NormalizedQuestion = z.infer<typeof normalizedQuestionSchema>;
export type MediaManifestEntry = z.infer<typeof mediaManifestEntrySchema>;
export type QuestionMediaReference = z.infer<typeof questionMediaReferenceSchema>;
export type MediaBuildJobReference = z.infer<typeof mediaBuildJobReferenceSchema>;
export type MediaBuildJob = z.infer<typeof mediaBuildJobSchema>;
export type QuestionDeliveryAsset = z.infer<typeof questionDeliveryAssetSchema>;
export type TranslationOverlayEntry = z.infer<
  typeof translationOverlayEntrySchema
>;
