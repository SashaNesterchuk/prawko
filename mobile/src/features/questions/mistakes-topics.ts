import type { QuestionTopicId } from "@prawko/config";

import { getQuestionTopicIds } from "../../features/question-topics/catalog";
import {
  getTopicMistakeProgress,
} from "../../features/questions/question-engine";
import type {
  QuestionUserStateMap,
  TopicQuestionProgressMap,
} from "../../features/questions/types";

export type CatalogTopicMistakeRow = {
  progress: ReturnType<typeof getTopicMistakeProgress>;
  topicId: QuestionTopicId;
};

/**
 * Catalog topics (Learn / question_topic_catalog) that still have unresolved
 * wrong answers, sorted by wrong count then mistake rate.
 */
export function listCatalogTopicsWithMistakes(
  questionUserState: QuestionUserStateMap,
  topicQuestionProgress: TopicQuestionProgressMap = {}
): CatalogTopicMistakeRow[] {
  return getQuestionTopicIds()
    .map((topicId) => ({
      topicId,
      progress: getTopicMistakeProgress(
        topicId,
        questionUserState,
        topicQuestionProgress
      ),
    }))
    .filter((row) => row.progress.wrong > 0 && row.progress.total > 0)
    .sort((a, b) => {
      if (b.progress.wrong !== a.progress.wrong) {
        return b.progress.wrong - a.progress.wrong;
      }

      if (a.progress.total === 0 || b.progress.total === 0) {
        return 0;
      }

      return (
        b.progress.wrong / b.progress.total - a.progress.wrong / a.progress.total
      );
    });
}
