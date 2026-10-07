import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { getExplanationDisplayProperties, getQuestionContentProperties } from "../../../analytics/content-revisions";
import { trainingPracticeEntry } from "../../../analytics/practice-entry";
import { createAnalyticsId } from "../../../analytics/runtime-context";
import { useAnalyticsDuration } from "../../../analytics/useAnalyticsDuration";
import { useAnalyticsViewState } from "../../../analytics/useAnalyticsViewState";
import type { TrainingResultOrigin } from "../../../analytics/training-lifecycle";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { useQuestionCatalogVersion } from "../../../state/question-catalog";
import { useAppShellStore } from "../../../state/app-shell";
import { useHasPlusAccess } from "../../../state/entitlements";
import { resolveLearnerExplanationAccess } from "../explanation-access";
import { getLocalizedText, getQuestionById, getQuestionTopicIds } from "../question-engine";
import type { QuestionSession, QuestionSessionSummary } from "../types";

export function useTrainingResultAnalytics({
  activeSession,
  resultOrigin,
  summary,
}: {
  activeSession: QuestionSession | null;
  resultOrigin: TrainingResultOrigin;
  summary: QuestionSessionSummary;
}) {
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const catalogVersion = useQuestionCatalogVersion();
  const displayLocale = useAppShellStore((state) => state.preferredLocale);
  const examCountry = useAppShellStore((state) => state.examCountry);
  const hasPlusAccess = useHasPlusAccess();
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const reviewRef = useRef<{
    id: string;
    viewed: Set<string>;
    currentIndex: number;
    lastViewKey: string | null;
  } | null>(null);
  const resultVisibleRef = useRef<string | null>(null);
  const resultReasonRef = useRef<"initial" | "review_return">("initial");
  const context = {
    content_requested_locale: displayLocale,
    training_session_id: activeSession?.id ?? null,
    mode: activeSession?.request.mode ?? null,
    topic_id: activeSession?.request.topic ?? null,
    roadmap_step_id: activeSession?.request.roadmapStepId ?? null,
    ...trainingPracticeEntry({
      mode: activeSession?.request.mode ?? "learning",
      roadmapStepId: activeSession?.request.roadmapStepId,
      topicId: activeSession?.request.topic ?? null,
    }),
  };
  const questionIds = activeSession?.questionIds ?? [];
  const reviewDuration = useAnalyticsDuration(
    reviewRef.current?.id ?? null,
    isFocused && reviewIndex !== null
  );
  useAnalyticsViewState(
    activeSession?.finishedAt ? reviewIndex === null ? "result" : "review" : null,
    {
      ...context,
      screen_name: "question_training",
      question_id: reviewIndex === null ? null : questionIds[reviewIndex] ?? null,
      review_id: reviewRef.current?.id ?? null,
    }
  );

  useEffect(() => {
    if (!isFocused || reviewIndex !== null) {
      resultVisibleRef.current = null;
      return;
    }
    if (!activeSession?.finishedAt || resultVisibleRef.current === activeSession.id) {
      return;
    }
    resultVisibleRef.current = activeSession.id;
    track(ANALYTICS_EVENTS.trainingResultViewed.key, {
      ...context,
      result_origin: resultOrigin,
      view_reason: resultReasonRef.current,
      answered_count: summary.answered,
      correct_count: summary.correct,
      incorrect_count: summary.wrong,
      question_total: summary.total,
    });
    resultReasonRef.current = "initial";
  }, [activeSession, context, isFocused, resultOrigin, reviewIndex, summary, track]);

  useEffect(() => {
    const review = reviewRef.current;
    if (!isFocused && review) {
      review.lastViewKey = null;
    }
    const questionId = reviewIndex !== null ? questionIds[reviewIndex] : null;
    if (!isFocused || !review || reviewIndex === null || !questionId || !activeSession) {
      return;
    }
    const question = getQuestionById(questionId);
    const viewState = question ? "question" : "missing_question";
    let displayProperties = {};
    const contentProperties = question ? getQuestionContentProperties(question, displayLocale) : {};
    try {
      if (question) {
        const access = resolveLearnerExplanationAccess({
          country: examCountry, hasPlusAccess, topicIds: getQuestionTopicIds(question),
        });
        displayProperties = getExplanationDisplayProperties(question, displayLocale,
          access === "locked" ? "locked" : access === "preview" ? "free_topic_marked" : "full",
          access === "locked" ? null : getLocalizedText(question.explanation, displayLocale));
      }
    } catch {
      // Optional observation must not affect review state or navigation.
    }
    const display = displayProperties as Record<string, unknown>;
    const viewKey = `${reviewIndex}:${viewState}:${displayLocale}:${contentProperties.question_revision}:${display.explanation_display_variant}:${display.explanation_display_revision}`;
    if (review.lastViewKey === viewKey) {
      return;
    }
    review.lastViewKey = viewKey;
    if (viewState === "question") {
      review.viewed.add(questionId);
    }
    const answer = activeSession.answers[questionId];
    track(ANALYTICS_EVENTS.trainingAnswersReviewQuestionViewed.key, {
      ...contentProperties, ...displayProperties,
      ...context,
      review_id: review.id,
      question_id: questionId,
      question_index: reviewIndex + 1,
      question_total: questionIds.length,
      view_state: viewState,
      was_answered: Boolean(answer),
      is_correct: answer?.isCorrect ?? null,
    });
  }, [activeSession, catalogVersion, context, displayLocale, examCountry, hasPlusAccess, isFocused, questionIds, reviewIndex, track]);

  function openReview() {
    if (!activeSession || questionIds.length === 0) {
      return;
    }
    reviewRef.current = {
      id: createAnalyticsId("review"),
      viewed: new Set(),
      currentIndex: 0,
      lastViewKey: null,
    };
    track(ANALYTICS_EVENTS.trainingAnswersReviewOpened.key, {
      ...context,
      review_id: reviewRef.current.id,
      question_total: questionIds.length,
    });
    setReviewIndex(0);
  }

  function closeReview(reason: "back" | "finished") {
    const review = reviewRef.current;
    if (review) {
      track(ANALYTICS_EVENTS.trainingAnswersReviewClosed.key, {
        ...context,
        review_id: review.id,
        close_reason: reason,
        viewed_count: review.viewed.size,
        question_index: review.currentIndex + 1,
        question_total: questionIds.length,
        review_foreground_ms: reviewDuration.measure().visible_foreground_ms,
      });
    }
    reviewRef.current = null;
    resultReasonRef.current = "review_return";
    setReviewIndex(null);
  }

  function nextReviewQuestion() {
    const review = reviewRef.current;
    if (!review) {
      return;
    }
    if (review.currentIndex >= questionIds.length - 1) {
      closeReview("finished");
    } else {
      review.currentIndex += 1;
      setReviewIndex(review.currentIndex);
    }
  }

  function previousReviewQuestion() {
    const review = reviewRef.current;
    if (!review) {
      return;
    }
    review.currentIndex = Math.max(review.currentIndex - 1, 0);
    setReviewIndex(review.currentIndex);
  }

  return {
    context,
    reviewIndex,
    openReview,
    closeReview,
    nextReviewQuestion,
    previousReviewQuestion,
  };
}
