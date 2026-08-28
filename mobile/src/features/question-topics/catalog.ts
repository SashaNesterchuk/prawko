import { variantRuntime } from "@app-variant";
import type { TFunction } from "i18next";

import {
  QUESTION_TOPIC_CATALOG,
  getQuestionTopicCatalogEntry,
  getQuestionTopicIdsForVariant,
  isQuestionTopicId,
  isTopicBlockId,
  type LearningTopicId,
  type QuestionTopicId,
  type SupportedLocale,
} from "@prawko/config";

export function getQuestionTopicCatalog() {
  return QUESTION_TOPIC_CATALOG;
}

export function getQuestionTopicIds() {
  return getQuestionTopicIdsForVariant(variantRuntime.id);
}

export function getQuestionTopicTitle(
  topicId: QuestionTopicId,
  locale: SupportedLocale
) {
  const topic = getQuestionTopicCatalogEntry(topicId);

  if (locale === "pl") {
    return topic.titlePl;
  }

  if (locale === "de") {
    return topic.titleDe;
  }

  if (locale === "es") {
    return topic.titleEs;
  }

  if (locale === "en") {
    return topic.titleEn;
  }

  if (locale === "cs") {
    return topic.titleCs;
  }

  return topic.titleUa;
}

export function getQuestionTopicTitleSafe(
  topicId: string | null | undefined,
  locale: SupportedLocale
) {
  if (!topicId || !isQuestionTopicId(topicId)) {
    return null;
  }

  return getQuestionTopicTitle(topicId, locale);
}

export function getLearningTopicTitle(
  topicId: LearningTopicId,
  locale: SupportedLocale,
  t: TFunction
) {
  if (isTopicBlockId(topicId)) {
    return t(`topics.${topicId}`);
  }

  return getQuestionTopicTitle(topicId, locale);
}

export function isLearningTopicId(value: string): value is LearningTopicId {
  return isTopicBlockId(value) || isQuestionTopicId(value);
}
