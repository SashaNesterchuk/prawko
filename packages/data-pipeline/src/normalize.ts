import path from "node:path";

import type { TopicBlockId } from "@prawko/config";
import { normalizedQuestionSchema } from "@prawko/schemas";

import {
  FALSE_ANSWER_ALIASES,
  FIELD_ALIASES,
  TOPIC_KEYWORDS,
  TRUE_ANSWER_ALIASES,
} from "./constants";
import type { OverlayCollection, SourceRow, ValidationIssue } from "./types";
import {
  hashToRange,
  normalizeToken,
  parseInteger,
  splitCategories,
  toNullableString,
} from "./utils";

function lookupField(row: SourceRow, fieldName: keyof typeof FIELD_ALIASES): string | null {
  const aliases = FIELD_ALIASES[fieldName];
  const fuzzyAliases = aliases.filter((alias) => alias.length >= 3);

  for (const alias of aliases) {
    if (alias in row.normalizedCells) {
      return toNullableString(row.normalizedCells[alias]);
    }
  }

  for (const [header, value] of Object.entries(row.normalizedCells)) {
    if (fuzzyAliases.some((alias) => header.includes(alias))) {
      return toNullableString(value);
    }
  }

  return null;
}

function normalizeScope(
  value: string | null
): "base" | "specialist" | null {
  const token = normalizeToken(value);

  if (
    ["base", "podstawowy", "zakres podstawowy", "podstawowe"].some((item) =>
      token.includes(item)
    )
  ) {
    return "base";
  }

  if (
    [
      "specialist",
      "specjalistyczny",
      "zakres specjalistyczny",
      "specjalistyczne",
    ].some((item) => token.includes(item))
  ) {
    return "specialist";
  }

  return null;
}

function normalizeAnswerType(
  correctAnswerRaw: string | null,
  optionA: string | null,
  optionB: string | null,
  optionC: string | null
): "boolean" | "abc" | null {
  const token = normalizeToken(correctAnswerRaw);

  if (TRUE_ANSWER_ALIASES.includes(token as (typeof TRUE_ANSWER_ALIASES)[number])) {
    return "boolean";
  }

  if (
    FALSE_ANSWER_ALIASES.includes(token as (typeof FALSE_ANSWER_ALIASES)[number])
  ) {
    return "boolean";
  }

  if (["a", "b", "c"].includes(token)) {
    return "abc";
  }

  if (optionA || optionB || optionC) {
    return "abc";
  }

  return null;
}

function normalizeCorrectAnswer(
  correctAnswerRaw: string | null,
  answerType: "boolean" | "abc" | null
): string | null {
  const token = normalizeToken(correctAnswerRaw);

  if (answerType === "boolean") {
    if (
      TRUE_ANSWER_ALIASES.includes(token as (typeof TRUE_ANSWER_ALIASES)[number])
    ) {
      return "true";
    }

    if (
      FALSE_ANSWER_ALIASES.includes(token as (typeof FALSE_ANSWER_ALIASES)[number])
    ) {
      return "false";
    }
  }

  if (answerType === "abc" && ["a", "b", "c"].includes(token)) {
    return token.toUpperCase();
  }

  return null;
}

function inferTopicBlock(questionText: string, extraText: string): TopicBlockId {
  const haystack = normalizeToken(`${questionText} ${extraText}`);

  let selectedBlock: TopicBlockId = "safety";
  let highestScore = 0;

  for (const [block, keywords] of Object.entries(TOPIC_KEYWORDS) as Array<
    [TopicBlockId, string[]]
  >) {
    const score = keywords.reduce((total, keyword) => {
      return haystack.includes(keyword) ? total + 1 : total;
    }, 0);

    if (score > highestScore) {
      highestScore = score;
      selectedBlock = block;
    }
  }

  return selectedBlock;
}

function normalizeMediaFilename(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return path.basename(value.trim());
}

function inferMediaType(filename: string | null): "image" | "video" | "none" {
  if (!filename) {
    return "none";
  }

  const extension = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(extension)) {
    return "image";
  }
  if (
    [".wmv", ".mp4", ".mov", ".avi", ".mpeg", ".mpg", ".webm", ".m4v"].includes(
      extension
    )
  ) {
    return "video";
  }
  return "none";
}

function buildDifficultySeed(
  questionSourceId: string,
  points: number,
  scope: "base" | "specialist"
): number {
  const scopeWeight = scope === "specialist" ? 17 : 5;
  return hashToRange(`${questionSourceId}:${points}:${scopeWeight}`, 1, 100);
}

function applyOverlays(
  question: ReturnType<typeof normalizedQuestionSchema.parse>,
  overlays: OverlayCollection
) {
  const questionPlOverlay = overlays.questions.pl?.get(question.questionSourceId);
  const questionUaOverlay = overlays.questions.ua?.get(question.questionSourceId);
  const questionEnOverlay = overlays.questions.en?.get(question.questionSourceId);
  const explanationPlOverlay =
    overlays.explanations.pl?.get(question.questionSourceId);
  const explanationUaOverlay =
    overlays.explanations.ua?.get(question.questionSourceId);
  const explanationEnOverlay =
    overlays.explanations.en?.get(question.questionSourceId);

  return {
    ...question,
    questionPl: questionPlOverlay?.value ?? question.questionPl,
    questionUa: questionUaOverlay?.value ?? question.questionUa,
    questionEn: questionEnOverlay?.value ?? question.questionEn,
    explanationPl: explanationPlOverlay?.value ?? question.explanationPl,
    explanationUa: explanationUaOverlay?.value ?? question.explanationUa,
    explanationEn: explanationEnOverlay?.value ?? question.explanationEn,
  };
}

export function normalizeRows(
  sourceRows: SourceRow[],
  overlays: OverlayCollection
): {
  questions: ReturnType<typeof normalizedQuestionSchema.parse>[];
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [...overlays.issues];
  const questions: ReturnType<typeof normalizedQuestionSchema.parse>[] = [];

  for (const row of sourceRows) {
    const questionSourceId =
      lookupField(row, "questionSourceId") ?? `row-${row.sourceRowNumber}`;
    const questionPl = lookupField(row, "questionPl");
    const questionEn = lookupField(row, "questionEn");
    const questionUa = lookupField(row, "questionUa");
    const optionA = lookupField(row, "optionA");
    const optionB = lookupField(row, "optionB");
    const optionC = lookupField(row, "optionC");
    const correctAnswerRaw = lookupField(row, "correctAnswer");
    const pointsRaw = lookupField(row, "points");
    const scopeRaw = lookupField(row, "scope");
    const categoriesRaw = lookupField(row, "categories");
    const mediaFilename = normalizeMediaFilename(lookupField(row, "mediaFilename"));
    const pjmQuestionMediaFilename = normalizeMediaFilename(
      lookupField(row, "pjmQuestionMediaFilename")
    );
    const pjmAnswerAMediaFilename = normalizeMediaFilename(
      lookupField(row, "pjmAnswerAMediaFilename")
    );
    const pjmAnswerBMediaFilename = normalizeMediaFilename(
      lookupField(row, "pjmAnswerBMediaFilename")
    );
    const pjmAnswerCMediaFilename = normalizeMediaFilename(
      lookupField(row, "pjmAnswerCMediaFilename")
    );

    const categories = splitCategories(categoriesRaw);
    const answerType = normalizeAnswerType(
      correctAnswerRaw,
      optionA,
      optionB,
      optionC
    );
    const scope =
      normalizeScope(scopeRaw) ??
      (answerType === "boolean"
        ? "base"
        : answerType === "abc"
          ? "specialist"
          : null);
    const points = parseInteger(pointsRaw);
    const correctAnswer = normalizeCorrectAnswer(correctAnswerRaw, answerType);
    const topicBlock = inferTopicBlock(
      questionPl ?? "",
      [optionA, optionB, optionC].filter(Boolean).join(" ")
    );

    if (!questionPl) {
      issues.push({
        severity: "error",
        code: "missing_question_text",
        message: "Question text is missing.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    if (!points) {
      issues.push({
        severity: "error",
        code: "missing_points",
        message: "Points could not be parsed.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    if (!answerType || !correctAnswer) {
      issues.push({
        severity: "error",
        code: "invalid_answer_configuration",
        message: "Answer type or correct answer could not be parsed.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    if (categories.length === 0) {
      issues.push({
        severity: "error",
        code: "missing_categories",
        message: "No categories were parsed from the source row.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    if (!scope) {
      issues.push({
        severity: "error",
        code: "missing_scope",
        message: "Scope could not be parsed or inferred.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    const candidate = {
      questionSourceId,
      sourceRowNumber: row.sourceRowNumber,
      questionPl,
      questionUa,
      questionEn,
      explanationPl: null,
      explanationUa: null,
      explanationEn: null,
      answerType,
      correctAnswer,
      optionA,
      optionB,
      optionC,
      mediaFilename,
      pjmQuestionMediaFilename,
      pjmAnswerAMediaFilename,
      pjmAnswerBMediaFilename,
      pjmAnswerCMediaFilename,
      mediaType: inferMediaType(mediaFilename),
      points,
      scope,
      categories,
      topicBlock,
      difficultySeed: buildDifficultySeed(questionSourceId, points, scope),
      hasMedia: Boolean(mediaFilename),
    };

    const parsed = normalizedQuestionSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({
        severity: "error",
        code: "invalid_question_row",
        message: `Failed to normalize source row ${row.sourceRowNumber}.`,
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    if (!normalizeScope(scopeRaw)) {
      issues.push({
        severity: "warning",
        code: "scope_inferred",
        message: "Scope was inferred from answer format instead of source field.",
        questionSourceId,
        sourceRowNumber: row.sourceRowNumber,
      });
    }

    questions.push(applyOverlays(parsed.data, overlays));
  }

  return { questions, issues };
}
