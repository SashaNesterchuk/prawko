import { useMemo } from "react";

import { useQuestionCatalogVersion } from "../../state/question-catalog";
import { useQuestionProgressStore } from "../../state/question-progress";
import { getQuestionDisplayStats } from "./question-engine";

/** Unique seen / correct / wrong over the current country+category bank. */
export function useQuestionCoverageStats() {
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );

  return useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );
}
