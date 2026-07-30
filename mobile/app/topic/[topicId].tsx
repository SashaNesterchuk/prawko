import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { getQuestionTopicIds } from "../../src/features/question-topics/catalog";
import { getTopicProgress } from "../../src/features/questions/question-engine";
import { TrainerModesView } from "../../src/features/questions/trainer-modes/TrainerModesView";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function TopicDetailScreen() {
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const allTopicIds = useMemo(() => getQuestionTopicIds(), []);
  const availableTopicIds = useMemo(
    () =>
      allTopicIds.filter(
        (candidate) => getTopicProgress(candidate, questionUserState).total > 0
      ),
    [allTopicIds, questionCatalogVersion, questionUserState]
  );
  const resolvedTopicId =
    topicId && allTopicIds.includes(topicId as (typeof allTopicIds)[number])
      ? (topicId as (typeof allTopicIds)[number])
      : availableTopicIds[0] ?? allTopicIds[0];

  if (!resolvedTopicId) {
    return null;
  }

  return <TrainerModesView topic={resolvedTopicId} />;
}
