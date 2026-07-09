import type { RoadSignCategoryId } from "./types";
import { getRoadSignsByCategory, ROAD_SIGN_CATEGORIES } from "./catalog";
import {
  hasSignPracticeContent,
  listPracticeSignIds,
} from "./content/registry";
import type { SignCategoryProgress } from "../../components/shell/SignCategoryProgressCard";

export function getCategorySignProgress(
  categoryId: RoadSignCategoryId
): SignCategoryProgress {
  const total = getRoadSignsByCategory(categoryId).length;
  const practiceSignsInCategory = listPracticeSignIds().filter((signId) => {
    const sign = getRoadSignsByCategory(categoryId).find((item) => item.id === signId);
    return sign != null;
  }).length;

  return {
    correct: 0,
    wrong: 0,
    seen: practiceSignsInCategory > 0 ? practiceSignsInCategory : 0,
    total,
  };
}

export function getAllSignsProgress(): SignCategoryProgress {
  const totals = ROAD_SIGN_CATEGORIES.reduce(
    (accumulator, category) => {
      const progress = getCategorySignProgress(category.id);
      accumulator.correct += progress.correct;
      accumulator.wrong += progress.wrong;
      accumulator.seen += progress.seen;
      accumulator.total += progress.total;
      return accumulator;
    },
    { correct: 0, wrong: 0, seen: 0, total: 0 }
  );

  return totals;
}

export function getSignLearningStatus(signId: string): "new" | "mastered" | "wrong" {
  if (hasSignPracticeContent(signId)) {
    return "new";
  }

  return "new";
}
