import type { RoadSignCategoryId } from "./types";
import { getRoadSignsByCategory, ROAD_SIGN_CATEGORIES } from "./catalog";
import { hasSignPracticeContent } from "./content/registry";
import type { SignCategoryProgress } from "../../components/shell/SignCategoryProgressCard";
import type { SignPracticeRecord } from "../../state/sign-practice-progress";
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";

type SignPracticeRecords = Record<string, SignPracticeRecord>;

function getPracticeRecords(
  records?: SignPracticeRecords
): SignPracticeRecords {
  return records ?? useSignPracticeProgressStore.getState().records;
}

export function getCategorySignProgress(
  categoryId: RoadSignCategoryId,
  records?: SignPracticeRecords
): SignCategoryProgress {
  const signIds = getRoadSignsByCategory(categoryId)
    .map((sign) => sign.id)
    .filter((signId) => hasSignPracticeContent(signId));
  const snapshot = getPracticeRecords(records);

  let correct = 0;
  let wrong = 0;

  for (const signId of signIds) {
    const outcome = snapshot[signId]?.lastOutcome;

    if (outcome === "mastered") {
      correct += 1;
      continue;
    }

    if (outcome === "wrong") {
      wrong += 1;
    }
  }

  return {
    correct,
    wrong,
    seen: correct + wrong,
    total: signIds.length,
  };
}

export function getAllSignsProgress(
  records?: SignPracticeRecords
): SignCategoryProgress {
  const totals = ROAD_SIGN_CATEGORIES.reduce(
    (accumulator, category) => {
      const progress = getCategorySignProgress(category.id, records);
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

export function getSignLearningStatus(
  signId: string,
  records?: SignPracticeRecords
): "new" | "mastered" | "wrong" {
  if (!hasSignPracticeContent(signId)) {
    return "new";
  }

  const outcome = getPracticeRecords(records)[signId]?.lastOutcome;

  return outcome ?? "new";
}
