import {
  getQuestionTopicFallbackFromTopicBlock,
  normalizeQuestionTopicId,
  normalizeQuestionTopicIds,
  type QuestionAnswerType,
  type QuestionScope,
  type TopicBlockId,
} from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import type {
  LocalQuestion,
  LocalizedQuestionText,
  QuestionChoice,
  QuestionOptionValue,
} from "./types";

export type QuestionAiExplanationMap = Partial<Record<string, string>>;

export type SupabaseQuestionRecord = {
  question_source_id: string;
  source_row_number: number;
  question_pl: string;
  question_ua: string | null;
  question_en: string | null;
  question_de: string | null;
  explanation_pl: string | null;
  explanation_ua: string | null;
  explanation_en: string | null;
  ai_explanations?: QuestionAiExplanationMap | null;
  answer_type: QuestionAnswerType;
  correct_answer: QuestionOptionValue;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_a_ua: string | null;
  option_b_ua: string | null;
  option_c_ua: string | null;
  option_a_en: string | null;
  option_b_en: string | null;
  option_c_en: string | null;
  option_a_de: string | null;
  option_b_de: string | null;
  option_c_de: string | null;
  points: number;
  scope: QuestionScope;
  topic_block: TopicBlockId;
  primary_topic_id: string | null;
  topic_ids: string[] | null;
  difficulty_seed: number;
  media_asset: QuestionDeliveryAsset | null;
  pjm_question_asset: QuestionDeliveryAsset | null;
  pjm_answer_a_asset: QuestionDeliveryAsset | null;
  pjm_answer_b_asset: QuestionDeliveryAsset | null;
  pjm_answer_c_asset: QuestionDeliveryAsset | null;
};

export type SupabaseQuestionV2Record = {
  id: string;
  source_id: string;
  source_row_number: number;
  points: number;
  answer_kind: "boolean" | "choice";
  correct_option_id: QuestionOptionValue;
  scope: QuestionScope | null;
  primary_topic_id: string | null;
  topic_ids: string[] | null;
  difficulty_seed: number | null;
  official_metadata?: {
    legacy_topic_block?: TopicBlockId;
    official_basket_scope_id?: number | string;
  } | null;
  ai_explanations?: QuestionAiExplanationMap | null;
  content: {
    prompt?: Record<string, string>;
    options?: Array<{ id: QuestionOptionValue; text?: Record<string, string>; media?: Array<{ role?: string; asset?: QuestionDeliveryAsset }> }>;
    question_media?: Array<{ role?: string; asset?: QuestionDeliveryAsset }>;
  };
};

export function mapSupabaseQuestionV2RecordToLocalQuestion(record: SupabaseQuestionV2Record): LocalQuestion {
  const prompt = record.content.prompt ?? {};
  const options = record.content.options ?? [];
  const questionAsset = record.content.question_media?.find((media) => media.role === "pjm-question")?.asset ?? null;
  const primary = record.content.question_media?.find((media) => media.role === "primary")?.asset ?? questionAsset;
  const answerAssets = Object.fromEntries(options.flatMap((option) => {
    const answerAsset = option.media?.find((media) => media.role === "pjm-answer")?.asset;
    return answerAsset && ["A", "B", "C"].includes(option.id) ? [[option.id, answerAsset]] : [];
  })) as Partial<Record<"A" | "B" | "C", QuestionDeliveryAsset>>;
  const topicIds = normalizeQuestionTopicIds(record.topic_ids ?? []);
  const topicBlock = record.official_metadata?.legacy_topic_block ?? (record.scope === "specialist" ? "technical" : "safety");
  const fallback = getQuestionTopicFallbackFromTopicBlock(topicBlock);
  return {
    id: record.source_id, sourceRowNumber: record.source_row_number,
    prompt: localizedText(prompt.pl, prompt.ua, prompt.en, prompt.de, prompt.cs, prompt.el),
    explanation: localizedText(record.ai_explanations?.pl, record.ai_explanations?.ua, record.ai_explanations?.en, record.ai_explanations?.de, record.ai_explanations?.cs, record.ai_explanations?.el), answerType: record.answer_kind === "choice" ? "abc" : "boolean",
    correctAnswer: record.correct_option_id,
    choices: record.answer_kind === "choice" ? options.map((option) => ({
      id: option.id,
      text: localizedText(option.text?.pl, option.text?.ua, option.text?.en, option.text?.de, option.text?.cs, option.text?.el),
      mediaAsset: option.media?.find((media) => media.role === "primary")?.asset ?? null,
    })) : undefined,
    media: primary ? { type: primary.mediaType, asset: primary, pjm: questionAsset || Object.keys(answerAssets).length ? { questionAsset, answerAssets } : null } : null,
    points: record.points, scope: record.scope ?? "base", topicBlock,
    primaryTopicId: normalizeQuestionTopicId(record.primary_topic_id) ?? topicIds[0] ?? fallback.primaryTopicId,
    topicIds: topicIds.length ? topicIds : fallback.topicIds, difficultySeed: record.difficulty_seed ?? 1,
    examBasketId: readExamBasketId(record.official_metadata),
  };
}

function nonEmptyText(value: string | null | undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function readExamBasketId(
  metadata: SupabaseQuestionV2Record["official_metadata"]
): number | undefined {
  const value = metadata?.official_basket_scope_id;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function localizedText(
  pl: string | null | undefined,
  ua: string | null | undefined,
  en: string | null | undefined,
  de?: string | null | undefined,
  cs?: string | null | undefined,
  el?: string | null | undefined
): LocalizedQuestionText {
  // Country catalogues (Czech/Greek) may only ship one language. Keep the
  // historical pl → ua/en and en → de chain for Prawko, and only then fall
  // back to cs/el so a Ukrainian UI still shows Czech text instead of blanks.
  const lastResort = nonEmptyText(cs) ?? nonEmptyText(el) ?? "";
  const plText = nonEmptyText(pl) ?? lastResort;
  const enText = nonEmptyText(en) ?? plText;

  return {
    pl: plText,
    ua: nonEmptyText(ua) ?? plText,
    en: enText,
    de: nonEmptyText(de) ?? enText,
    cs: nonEmptyText(cs) ?? enText,
    el: nonEmptyText(el) ?? enText,
  };
}

function readAiExplanation(
  explanations: QuestionAiExplanationMap | null | undefined,
  locale: string
) {
  const value = explanations?.[locale];

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function localizedExplanation(record: SupabaseQuestionRecord): LocalizedQuestionText {
  const explanationPl =
    readAiExplanation(record.ai_explanations, "pl") ?? record.explanation_pl;
  const explanationUa =
    readAiExplanation(record.ai_explanations, "ua") ??
    record.explanation_ua ??
    explanationPl;
  const explanationEn =
    readAiExplanation(record.ai_explanations, "en") ??
    record.explanation_en ??
    explanationPl;
  const explanationDe =
    readAiExplanation(record.ai_explanations, "de") ?? explanationEn;
  const explanationCs =
    readAiExplanation(record.ai_explanations, "cs") ?? explanationEn;
  const explanationEl =
    readAiExplanation(record.ai_explanations, "el") ?? explanationEn;

  return localizedText(
    explanationPl,
    explanationUa,
    explanationEn,
    explanationDe,
    explanationCs,
    explanationEl
  );
}

function createChoice(
  id: QuestionChoice["id"],
  pl: string | null,
  ua: string | null,
  en: string | null,
  de: string | null
): QuestionChoice | null {
  if (!pl && !ua && !en && !de) {
    return null;
  }

  return {
    id,
    text: localizedText(pl, ua, en, de),
  };
}

export function mapSupabaseQuestionRecordToLocalQuestion(
  record: SupabaseQuestionRecord
): LocalQuestion {
  const fallbackTopics = getQuestionTopicFallbackFromTopicBlock(record.topic_block);
  const mappedTopicIds = normalizeQuestionTopicIds(record.topic_ids ?? []);
  const topicIds =
    mappedTopicIds.length > 0
      ? mappedTopicIds
      : fallbackTopics.topicIds;
  const mappedPrimaryTopicId = normalizeQuestionTopicId(record.primary_topic_id);
  const primaryTopicId =
    mappedPrimaryTopicId && topicIds.includes(mappedPrimaryTopicId)
      ? mappedPrimaryTopicId
      : topicIds[0] ?? fallbackTopics.primaryTopicId;

  const choices = [
    createChoice(
      "A",
      record.option_a,
      record.option_a_ua,
      record.option_a_en,
      record.option_a_de
    ),
    createChoice(
      "B",
      record.option_b,
      record.option_b_ua,
      record.option_b_en,
      record.option_b_de
    ),
    createChoice(
      "C",
      record.option_c,
      record.option_c_ua,
      record.option_c_en,
      record.option_c_de
    ),
  ].filter(Boolean) as QuestionChoice[];

  return {
    id: record.question_source_id,
    sourceRowNumber: record.source_row_number,
    prompt: localizedText(
      record.question_pl,
      record.question_ua,
      record.question_en,
      record.question_de
    ),
    explanation: localizedExplanation(record),
    answerType: record.answer_type,
    correctAnswer: record.correct_answer,
    choices: record.answer_type === "abc" ? choices : undefined,
    media: record.media_asset
      ? {
          type: record.media_asset.mediaType,
          asset: record.media_asset,
          pjm:
            record.pjm_question_asset ||
            record.pjm_answer_a_asset ||
            record.pjm_answer_b_asset ||
            record.pjm_answer_c_asset
              ? {
                  questionAsset: record.pjm_question_asset,
                  answerAssets: {
                    ...(record.pjm_answer_a_asset
                      ? { A: record.pjm_answer_a_asset }
                      : {}),
                    ...(record.pjm_answer_b_asset
                      ? { B: record.pjm_answer_b_asset }
                      : {}),
                    ...(record.pjm_answer_c_asset
                      ? { C: record.pjm_answer_c_asset }
                      : {}),
                  },
                }
              : null,
        }
      : null,
    points: record.points,
    scope: record.scope,
    topicBlock: record.topic_block,
    primaryTopicId,
    topicIds,
    difficultySeed: record.difficulty_seed,
  };
}
