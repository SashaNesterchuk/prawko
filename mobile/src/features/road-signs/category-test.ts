import type { RoadSignCategoryId } from "./types";
import { getAllRoadSigns, getRoadSignsByCategory } from "./catalog";
import {
  getPrimarySignPractice,
  hasSignPracticeContent,
} from "./content/registry";
import type { SignPractice } from "./content/types";

export type SignTestQuestion = {
  id: string;
  signId: string;
  prompt?: SignPractice["prompt"];
  options: SignPractice["options"];
  correctOptionId: string;
  explanation?: SignPractice["explanation"];
};

function toTestQuestion(
  signId: string,
  practice: SignPractice
): SignTestQuestion {
  return {
    id: `${signId}-${practice.id}`,
    signId,
    prompt: practice.prompt,
    options: practice.options,
    correctOptionId: practice.correctOptionId,
    explanation: practice.explanation,
  };
}

export function buildSignTestQuestions(signIds: string[]): SignTestQuestion[] {
  return signIds
    .filter((signId) => hasSignPracticeContent(signId))
    .map((signId) => {
      const practice = getPrimarySignPractice(signId);
      return practice ? toTestQuestion(signId, practice) : null;
    })
    .filter((question): question is SignTestQuestion => question != null);
}

export function limitSignTestQuestions(
  questions: SignTestQuestion[],
  limit?: number | "all" | null
): SignTestQuestion[] {
  if (limit == null || limit === "all" || limit >= questions.length) {
    return questions;
  }

  return questions.slice(0, Math.max(0, limit));
}

export function buildAllSignTestQuestions(
  limit?: number | "all" | null
): SignTestQuestion[] {
  return limitSignTestQuestions(
    buildSignTestQuestions(getAllRoadSigns().map((sign) => sign.id)),
    limit
  );
}

export function buildCategorySignTestQuestions(
  categoryId: RoadSignCategoryId,
  limit?: number | "all" | null
): SignTestQuestion[] {
  return limitSignTestQuestions(
    buildSignTestQuestions(
      getRoadSignsByCategory(categoryId).map((sign) => sign.id)
    ),
    limit
  );
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
