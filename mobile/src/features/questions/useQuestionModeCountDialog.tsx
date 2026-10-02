import type {
  BlitzDurationMinutes,
  LearningTopicId,
  QuestionSessionMode,
} from "@prawko/config";
import {
  BLITZ_DURATION_MINUTES,
  DEFAULT_BLITZ_DURATION_MINUTES,
} from "@prawko/config";
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
import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import { withLearningIntent } from "../../analytics/operations";
import { trainingPracticeEntry } from "../../analytics/practice-entry";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import type { ExamEntry } from "../exam/exam-entry";
import { buildExamRouteParams } from "../exam/exam-routes";
import { getQuestionCountForMode } from "./question-engine";
import { buildQuestionRouteParams } from "./question-routes";

type PendingQuestionMode = {
  kind: "question";
  mode: QuestionSessionMode;
  title: string;
  topic?: LearningTopicId;
};

type PendingBlitzMode = {
  kind: "blitz";
  title: string;
};

type PendingMode = PendingQuestionMode | PendingBlitzMode;

/**
 * Shared "pick count → start session" flow used by Learn / Home
 * for modes that auto-select questions (mistakes, smart review, traps).
 * Official exam always starts at the country size — no 10/20 picker.
 */
export function useQuestionModeCountDialog() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
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

    if (pending.kind === "blitz") {
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
    topic?: LearningTopicId,
    setup?: AnalyticsProperties
  ) {
    track(ANALYTICS_EVENTS.trainingModeSelected.key, {
      mode,
      question_limit: questionLimit,
      topic_id: topic ?? null,
      ...trainingPracticeEntry({ mode, topicId: topic ?? null }),
    });
    router.navigate({
      pathname: "/question",
      params: withLearningIntent(buildQuestionRouteParams({ mode, topic, questionLimit }), {
        setup_id: setup?.setup_id ?? null, source: "mode_selection", target_screen: "question_training",
      }),
    });
  }

  function startExam(entry: ExamEntry) {
    router.navigate({
      pathname: "/exam",
      params: withLearningIntent(buildExamRouteParams({ entry, mode: "exam" }), {
        source: entry, target_screen: "exam_loading",
      }),
    });
  }

  function startBlitz(minutes: BlitzDurationMinutes, setup?: AnalyticsProperties) {
    const timeLimitSeconds = minutes * 60;
    track(ANALYTICS_EVENTS.trainingModeSelected.key, {
      mode: "blitz",
      question_limit: null,
      time_limit_seconds: timeLimitSeconds,
      topic_id: null,
    });
    router.navigate({
      pathname: "/question",
      params: withLearningIntent(buildQuestionRouteParams({
        mode: "blitz",
        timeLimitSeconds,
      }), { setup_id: setup?.setup_id ?? null, source: "mode_selection", time_limit_seconds: timeLimitSeconds }),
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
    setPending({ kind: "question", ...input });
  }

  function openExam(entry: ExamEntry) {
    startExam(entry);
  }

  function openBlitz(input: { title: string }) {
    setSelectedCount(DEFAULT_BLITZ_DURATION_MINUTES);
    setPending({ kind: "blitz", title: input.title });
  }

  function startPendingMode(setup?: AnalyticsProperties) {
    if (!pending) {
      return;
    }

    if (pending.kind === "blitz") {
      const minutes = isBlitzDuration(selectedCount)
        ? selectedCount
        : DEFAULT_BLITZ_DURATION_MINUTES;
      setPending(null);
      startBlitz(minutes, setup);
      return;
    }

    const { mode, topic } = pending;
    setPending(null);
    startMode(mode, toQuestionLimit(selectedCount), topic, setup);
  }

  const isBlitzPending = pending?.kind === "blitz";
  const dialog = (
    <QuestionCountDialog
      analyticsContext={{
        feature: "training",
        mode: pending?.kind === "question" ? pending.mode : "blitz",
        topic_id: pending?.kind === "question" ? pending.topic ?? null : null,
      }}
      title={pending?.title ?? ""}
      subtitle={
        isBlitzPending
          ? t("trainerModes.chooseBlitzDuration", {
              defaultValue: "Обери тривалість бліц сесії",
            })
          : t("trainerModes.chooseQuestionCount", {
              defaultValue: "Обери кількість питань",
            })
      }
      startLabel={t("trainerModes.startCta", { defaultValue: "Почати" })}
      allLabel={t("trainerModes.allQuestions", {
        defaultValue: "Всі ({{count}})",
      })}
      totalCount={pendingModeCount}
      selectedCount={selectedCount}
      visible={pending !== null}
      options={isBlitzPending ? [...BLITZ_DURATION_MINUTES] : undefined}
      getOptionLabel={
        isBlitzPending
          ? (option) =>
              t("trainerModes.blitzMinutes", {
                defaultValue: "{{count}} хв",
                count:
                  typeof option === "number"
                    ? option
                    : DEFAULT_BLITZ_DURATION_MINUTES,
              })
          : undefined
      }
      testID={isBlitzPending ? "blitz-duration-dialog" : "question-count-dialog"}
      onClose={() => setPending(null)}
      onSelectCount={setSelectedCount}
      onStart={startPendingMode}
    />
  );

  return { openMode, openExam, openBlitz, dialog };
}

function isBlitzDuration(
  value: QuestionCountSelection
): value is BlitzDurationMinutes {
  return (
    typeof value === "number" &&
    (BLITZ_DURATION_MINUTES as readonly number[]).includes(value)
  );
}
