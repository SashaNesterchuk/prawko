import { ACTIVE_CATEGORIES } from "@prawko/config";
import type {
  MediaBuildJob,
  MediaManifestEntry,
  NormalizedQuestion,
  QuestionMediaReference,
} from "@prawko/schemas";

import type { PipelineSummary, ValidationIssue } from "./types";
import { incrementCounter } from "./utils";

export function validateDataset(
  questions: NormalizedQuestion[],
  mediaManifest: MediaManifestEntry[],
  mediaReferences: QuestionMediaReference[],
  mediaBuildPlan: MediaBuildJob[],
  existingIssues: ValidationIssue[] = []
): { issues: ValidationIssue[]; summary: PipelineSummary } {
  const issues = [...existingIssues];
  const activeCategories = new Set(ACTIVE_CATEGORIES);

  const duplicateQuestionIds = new Map<string, number>();
  for (const question of questions) {
    duplicateQuestionIds.set(
      question.questionSourceId,
      (duplicateQuestionIds.get(question.questionSourceId) ?? 0) + 1
    );
  }

  const questionPrimaryMediaReference = new Map<string, QuestionMediaReference>();
  const questionPjmReferences = new Map<string, QuestionMediaReference[]>();

  for (const reference of mediaReferences) {
    if (reference.sourceKind === "primary") {
      questionPrimaryMediaReference.set(reference.questionSourceId, reference);
      continue;
    }

    const existingReferences =
      questionPjmReferences.get(reference.questionSourceId) ?? [];
    existingReferences.push(reference);
    questionPjmReferences.set(reference.questionSourceId, existingReferences);
  }

  for (const [questionSourceId, count] of duplicateQuestionIds) {
    if (count > 1) {
      issues.push({
        severity: "error",
        code: "duplicate_question_source_id",
        message: `Question source id "${questionSourceId}" is duplicated ${count} times.`,
        questionSourceId,
      });
    }
  }

  for (const question of questions) {
    if (question.answerType === "abc") {
      const options = [question.optionA, question.optionB, question.optionC].filter(
        Boolean
      );
      if (options.length < 3) {
        issues.push({
          severity: "warning",
          code: "missing_abc_options",
          message: "ABC question does not have all three answer options.",
          questionSourceId: question.questionSourceId,
          sourceRowNumber: question.sourceRowNumber,
        });
      }
    }

    if (question.scope === "base" && question.answerType !== "boolean") {
      issues.push({
        severity: "warning",
        code: "unexpected_base_answer_type",
        message: "Base scope question does not use boolean answers.",
        questionSourceId: question.questionSourceId,
        sourceRowNumber: question.sourceRowNumber,
      });
    }

    if (question.scope === "specialist" && question.answerType !== "abc") {
      issues.push({
        severity: "warning",
        code: "unexpected_specialist_answer_type",
        message: "Specialist scope question does not use ABC answers.",
        questionSourceId: question.questionSourceId,
        sourceRowNumber: question.sourceRowNumber,
      });
    }

    if (question.hasMedia && question.mediaFilename) {
      const reference = questionPrimaryMediaReference.get(question.questionSourceId);
      const touchesActiveCategory = question.categories.some((category) =>
        activeCategories.has(category as (typeof ACTIVE_CATEGORIES)[number])
      );

      if (!reference || !reference.mediaKey) {
        issues.push({
          severity: touchesActiveCategory ? "error" : "warning",
          code: "missing_media_reference",
          message: `Media file "${question.mediaFilename}" was not found in the media manifest.`,
          questionSourceId: question.questionSourceId,
          sourceRowNumber: question.sourceRowNumber,
        });
      } else if (reference.candidateCount > 1) {
        issues.push({
          severity: "warning",
          code: "duplicate_media_reference",
          message: `Media file "${question.mediaFilename}" exists multiple times in the media manifest.`,
          questionSourceId: question.questionSourceId,
          sourceRowNumber: question.sourceRowNumber,
        });
      }
    }

    const pjmReferences = questionPjmReferences.get(question.questionSourceId) ?? [];
    for (const reference of pjmReferences) {
      if (!reference.mediaKey) {
        issues.push({
          severity: "warning",
          code: "missing_pjm_media_reference",
          message: `PJM media file "${reference.originalFilename}" was not found in the media manifest.`,
          questionSourceId: question.questionSourceId,
          sourceRowNumber: question.sourceRowNumber,
        });
      }
    }
  }

  const countsByScope: Record<string, number> = {};
  const countsByTopicBlock: Record<string, number> = {};
  const countsByPoints: Record<string, number> = {};
  const countsByCategory: Record<string, number> = {};

  for (const question of questions) {
    incrementCounter(countsByScope, question.scope);
    incrementCounter(countsByTopicBlock, question.topicBlock);
    incrementCounter(countsByPoints, String(question.points));
    question.categories.forEach((category) =>
      incrementCounter(countsByCategory, category)
    );
  }

  const summary: PipelineSummary = {
    totalQuestions: questions.length,
    categoryBQuestions: questions.filter((question) =>
      question.categories.includes("B")
    ).length,
    totalMediaEntries: mediaManifest.length,
    totalMediaReferences: mediaReferences.length,
    totalMediaBuildJobs: mediaBuildPlan.length,
    issues: {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
    countsByCategory,
    countsByScope,
    countsByTopicBlock,
    countsByPoints,
  };

  return { issues, summary };
}
