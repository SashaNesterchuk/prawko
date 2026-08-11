import type { TFunction } from "i18next";

import {
  QUESTION_TOPIC_CATALOG,
  QUESTION_TOPIC_IDS,
  getContentLocale,
  getQuestionTopicCatalogEntry,
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
  return QUESTION_TOPIC_IDS;
}

export function getQuestionTopicTitle(
  topicId: QuestionTopicId,
  locale: SupportedLocale
) {
  const topic = getQuestionTopicCatalogEntry(topicId);
  const contentLocale = getContentLocale(locale);

  if (contentLocale === "pl") {
    return topic.titlePl;
  }

  if (contentLocale === "en" || contentLocale === "de") {
    return topic.titleEn;
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
