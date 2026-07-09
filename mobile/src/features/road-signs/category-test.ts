import type { RoadSignCategoryId } from "./types";
import { getRoadSignsByCategory } from "./catalog";
import { pickLocalized } from "./content/localized";
import {
  getSignContent,
  getSignDisplayName,
  getSignPractices,
  hasSignContent,
} from "./content/registry";
import type { SignPractice } from "./content/types";

export type CategorySignTestQuestion = {
  id: string;
  signId: string;
  prompt?: SignPractice["prompt"];
  options: SignPractice["options"];
  correctOptionId: string;
  explanation?: SignPractice["explanation"];
};

function buildNameRecognitionQuestion(
  signId: string,
  categoryId: RoadSignCategoryId,
  locale: string
): CategorySignTestQuestion | null {
  const content = getSignContent(signId);

  if (!content) {
    return null;
  }

  const categorySigns = getRoadSignsByCategory(categoryId)
    .filter((sign) => hasSignContent(sign.id) && sign.id !== signId)
    .slice(0, 2);

  if (categorySigns.length < 2) {
    return null;
  }

  const correctLabel = pickLocalized(content.name, locale);
  const distractors = categorySigns.map((sign) => ({
    id: sign.id,
    label: {
      pl: getSignDisplayName(sign.id, "pl", sign.code),
      ua: getSignDisplayName(sign.id, "ua", sign.code),
      en: getSignDisplayName(sign.id, "en", sign.code),
    },
  }));

  return {
    id: `name-${signId}`,
    signId,
    options: [
      { id: "correct", label: content.name },
      ...distractors.map((item, index) => ({
        id: `distractor-${index}`,
        label: item.label,
      })),
    ],
    correctOptionId: "correct",
    explanation: {
      pl: `Poprawna odpowiedź: ${correctLabel}.`,
      ua: `Правильна відповідь: ${correctLabel}.`,
      en: `Correct answer: ${correctLabel}.`,
    },
  };
}

export function buildCategorySignTestQuestions(
  categoryId: RoadSignCategoryId
): CategorySignTestQuestion[] {
  const signs = getRoadSignsByCategory(categoryId).filter((sign) =>
    hasSignContent(sign.id)
  );

  const questions: CategorySignTestQuestion[] = [];

  for (const sign of signs) {
    const practices = getSignPractices(sign.id).map((practice) => ({
      id: `${sign.id}-${practice.id}`,
      signId: sign.id,
      prompt: practice.prompt,
      options: practice.options,
      correctOptionId: practice.correctOptionId,
      explanation: practice.explanation,
    }));

    questions.push(...practices);

    const nameQuestion = buildNameRecognitionQuestion(sign.id, categoryId, "pl");

    if (nameQuestion) {
      questions.push(nameQuestion);
    }
  }

  return questions;
}

export function getCategorySignTestQuestionSignIds(
  categoryId: RoadSignCategoryId
): string[] {
  const ids = new Set<string>();

  for (const question of buildCategorySignTestQuestions(categoryId)) {
    ids.add(question.signId);
  }

  return Array.from(ids);
}
