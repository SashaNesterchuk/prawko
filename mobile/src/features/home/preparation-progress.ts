import { getQuestionBank } from "../questions/question-bank";
import { getQuestionUserState, isQuestionUnresolvedWrong } from "../questions/question-engine";
import type { QuestionUserStateMap } from "../questions/types";

/** Global latest-answer coverage of the currently loaded country/category bank. */
export function getPreparationProgress(userStates: QuestionUserStateMap) {
  const ids = new Set(getQuestionBank().map((question) => question.id));
  let correct = 0;
  let wrong = 0;
  for (const id of ids) {
    const state = getQuestionUserState(userStates, id);
    if (state.timesSeen <= 0) continue;
    if (isQuestionUnresolvedWrong(state)) wrong += 1;
    else correct += 1;
  }
  const total = ids.size;
  const correctPercent = total ? 100 * correct / total : 0;
  const wrongPercent = total ? 100 * wrong / total : 0;
  return { total, correct, wrong, correctPercent, wrongPercent, percent: correctPercent + wrongPercent };
}

export function formatPreparationPercent(percent: number) {
  return percent > 0 && percent < 1 ? "1%" : `${Math.round(percent)}%`;
}
