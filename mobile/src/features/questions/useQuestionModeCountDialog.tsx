import type { LearningTopicId, QuestionSessionMode } from "@prawko/config";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  QuestionCountDialog,
  resolveQuestionCountDialog,
  toQuestionLimit,
  type QuestionCountSelection,
} from "../../components/shell/QuestionCountDialog";
import { useAppShellStore } from "../../state/app-shell";
import { useQuestionProgressStore } from "../../state/question-progress";
import { getQuestionCountForMode } from "./question-engine";
import { buildQuestionRouteParams } from "./question-routes";

type PendingMode = {
  mode: QuestionSessionMode;
  title: string;
  topic?: LearningTopicId;
};

/**
 * Shared "pick count → start session" flow used by Learn / Home / Statistics
 * for modes that auto-select questions (mistakes, smart review, …).
 */
export function useQuestionModeCountDialog() {
  const { t } = useTranslation();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionContextProgress = useQuestionProgressStore(
    (state) => state.topicQuestionContextProgress
  );

  const [pending, setPending] = useState<PendingMode | null>(null);
  const [selectedCount, setSelectedCount] =
    useState<QuestionCountSelection>("all");

  const pendingModeCount = useMemo(() => {
    if (!pending) {
      return 0;
    }

    return getQuestionCountForMode(
      {
        currentCategory: preferredCategory,
        mode: pending.mode,
        topic: pending.topic,
      },
      questionUserState,
      topicQuestionContextProgress
    );
  }, [
    pending,
    preferredCategory,
    questionUserState,
    topicQuestionContextProgress,
  ]);

  function startMode(
    mode: QuestionSessionMode,
    questionLimit: number | null,
    topic?: LearningTopicId
  ) {
    router.navigate({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode, topic, questionLimit }),
    });
  }

  function openMode(input: {
    mode: QuestionSessionMode;
    title: string;
    topic?: LearningTopicId;
  }) {
    const availableCount = getQuestionCountForMode(
      {
        currentCategory: preferredCategory,
        mode: input.mode,
        topic: input.topic,
      },
      questionUserState,
      topicQuestionContextProgress
    );
    const { shouldShowDialog, defaultCount } =
      resolveQuestionCountDialog(availableCount);

    if (!shouldShowDialog) {
      startMode(input.mode, null, input.topic);
      return;
    }

    setSelectedCount(defaultCount);
    setPending(input);
  }

  function startPendingMode() {
    if (!pending) {
      return;
    }

    const { mode, topic } = pending;
    setPending(null);
    startMode(mode, toQuestionLimit(selectedCount), topic);
  }

  const dialog = (
    <QuestionCountDialog
      title={pending?.title ?? ""}
      subtitle={t("trainerModes.chooseQuestionCount", {
        defaultValue: "Обери кількість питань",
      })}
      startLabel={t("trainerModes.startCta", { defaultValue: "Почати" })}
      allLabel={t("trainerModes.allQuestions", {
        defaultValue: "Всі ({{count}})",
      })}
      totalCount={pendingModeCount}
      selectedCount={selectedCount}
      visible={pending !== null}
      onClose={() => setPending(null)}
      onSelectCount={setSelectedCount}
      onStart={startPendingMode}
    />
  );

  return { openMode, dialog };
}
