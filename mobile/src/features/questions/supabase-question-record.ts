import {
  getQuestionTopicFallbackFromTopicBlock,
  type QuestionTopicId,
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
  primary_topic_id: QuestionTopicId | null;
  topic_ids: QuestionTopicId[] | null;
  difficulty_seed: number;
  media_asset: QuestionDeliveryAsset | null;
  pjm_question_asset: QuestionDeliveryAsset | null;
  pjm_answer_a_asset: QuestionDeliveryAsset | null;
  pjm_answer_b_asset: QuestionDeliveryAsset | null;
  pjm_answer_c_asset: QuestionDeliveryAsset | null;
};

function localizedText(
  pl: string | null | undefined,
  ua: string | null | undefined,
  en: string | null | undefined,
  de?: string | null | undefined
): LocalizedQuestionText {
  const plText = pl ?? "";
  const enText = en ?? plText;

  return {
    pl: plText,
    ua: ua ?? plText,
    en: enText,
    de: de ?? enText,
  };
}

function readAiExplanation(
  explanations: QuestionAiExplanationMap | null | undefined,
  locale: "pl" | "ua" | "en" | "de"
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

  return localizedText(
    explanationPl,
    explanationUa,
    explanationEn,
    explanationDe
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
  const topicIds =
    record.topic_ids && record.topic_ids.length > 0
      ? record.topic_ids
      : fallbackTopics.topicIds;
  const primaryTopicId =
    record.primary_topic_id && topicIds.includes(record.primary_topic_id)
      ? record.primary_topic_id
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
