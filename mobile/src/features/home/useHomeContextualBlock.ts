import { getQuestionTopicIdsForCountry, isQuestionTopicId } from "@prawko/config";
import { router } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { IconName } from "../../components/icons";
import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useAppShellStore } from "../../state/app-shell";
import {
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../../state/question-progress";
import { getQuestionTopicTitle } from "../question-topics/catalog";
import { buildExamRouteParams } from "../exam/exam-routes";
import { getTopicProgress } from "../questions/question-engine";
import { buildQuestionRouteParams } from "../questions/question-routes";
import { getWarsawIsoDate } from "../study-plan/supabase-study-plan-progress";
import { useMonetizationStore } from "../monetization/monetization-store";

import {
  createHomeDailySessionKey,
  isHomeDailySessionKey,
} from "./home-daily-practice";
import {
  buildDebugHomeContextualResolution,
  estimateSessionMinutes,
  getResumableHomeSession,
  HOME_CONTEXTUAL_MISTAKES_LIMIT,
  HOME_CONTEXTUAL_REVIEW_LIMIT,
  HOME_CONTEXTUAL_WEAK_TOPIC_LIMIT,
  pickWeakestOpenTopic,
  resolveHomeContextualBlock,
  type HomeContextualKind,
  type HomeContextualResolution,
} from "./home-contextual";
import { useHomeContextualStore } from "./home-contextual-store";

export type HomeContextualCardModel = {
  cta: string;
  icon: IconName;
  kind: HomeContextualKind;
  onPress: () => void;
  subtitle: string;
  testID: string;
  title: string;
};

export function useHomeContextualBlock(input: {
  isNewUser: boolean;
  isReadinessLoading: boolean;
  reviewDue: number;
  wrongAnswers: number;
}): HomeContextualCardModel | null {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const progressHydrated = useQuestionProgressHydrated();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const activeSession = useQuestionProgressStore((state) => state.activeSession);
  const homeDailySession = useQuestionProgressStore(
    (state) => state.homeDailySession
  );
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const topicQuestionProgress = useQuestionProgressStore(
    (state) => state.topicQuestionProgress
  );
  const pendingCompletion = useHomeContextualStore((state) => state.pending);
  const debugPreview = useHomeContextualStore((state) => state.debugPreview);
  const markCompletionShown = useHomeContextualStore(
    (state) => state.markCompletionShown
  );
  const hasHigherPriorityFlow = useMonetizationStore(
    (state) => state.pendingRequest != null
  );
  const visibleCompletionIdRef = useRef<string | null>(null);

  const resumeSession = useMemo(
    () =>
      getResumableHomeSession({
        activeSession,
        category: preferredCategory,
        homeDailySession,
        today: getWarsawIsoDate(),
      }),
    [activeSession, homeDailySession, preferredCategory]
  );

  const weakTopic = useMemo(() => {
    if (input.isNewUser || input.isReadinessLoading || !progressHydrated) {
      return null;
    }

    const topics = getQuestionTopicIdsForCountry(examCountry).map((topicId) => {
      const progress = getTopicProgress(
        topicId,
        questionUserState,
        topicQuestionProgress
      );

      return {
        progress: progress.progress,
        remaining: Math.max(0, progress.total - progress.correct),
        seen: progress.seen,
        topicId,
      };
    });

    return pickWeakestOpenTopic(topics);
  }, [
    examCountry,
    input.isNewUser,
    input.isReadinessLoading,
    progressHydrated,
    questionUserState,
    topicQuestionProgress,
  ]);

  const resolution = useMemo((): HomeContextualResolution => {
    const debugTopicId =
      getQuestionTopicIdsForCountry(examCountry)[0] ?? "signs_signals";
    if (debugPreview !== "auto" && isQuestionTopicId(debugTopicId)) {
      return buildDebugHomeContextualResolution({
        examCountry,
        preview: debugPreview,
        topicId: debugTopicId,
      });
    }

    if (!progressHydrated || input.isReadinessLoading) {
      return { type: "none" };
    }

    return resolveHomeContextualBlock({
      examCountry,
      hasHigherPriorityFlow,
      isNewUser: input.isNewUser,
      keepCompletionVisible:
        visibleCompletionIdRef.current != null &&
        visibleCompletionIdRef.current === pendingCompletion?.id,
      pendingCompletion,
      resumeSession,
      reviewDue: input.reviewDue,
      weakTopic,
      wrongAnswers: input.wrongAnswers,
    });
  }, [
    debugPreview,
    examCountry,
    hasHigherPriorityFlow,
    input.isNewUser,
    input.isReadinessLoading,
    input.reviewDue,
    input.wrongAnswers,
    pendingCompletion,
    progressHydrated,
    resumeSession,
    weakTopic,
  ]);

  useEffect(() => {
    if (debugPreview !== "auto") {
      return;
    }

    if (!isFocused) {
      const shownId = visibleCompletionIdRef.current;
      visibleCompletionIdRef.current = null;
      if (shownId) {
        markCompletionShown(shownId);
      }
      return;
    }

    if (resolution.type === "completion") {
      visibleCompletionIdRef.current = resolution.event.id;
    }
  }, [debugPreview, isFocused, markCompletionShown, resolution]);

  const shownKindRef = useRef<string | null>(null);

  useEffect(() => {
    if (debugPreview !== "auto" || !isFocused || resolution.type === "none") {
      if (!isFocused) {
        shownKindRef.current = null;
      }
      return;
    }

    const kind =
      resolution.type === "completion" ? "completion" : resolution.kind;
    const fingerprint =
      resolution.type === "completion"
        ? `completion:${resolution.event.id}`
        : `${kind}`;

    if (shownKindRef.current === fingerprint) {
      return;
    }

    shownKindRef.current = fingerprint;
    track(ANALYTICS_EVENTS.homeContextualShown.key, {
      kind,
    });
    if (resolution.type === "completion") {
      markCompletionShown(resolution.event.id);
    }
  }, [debugPreview, isFocused, markCompletionShown, resolution, track]);

  return useMemo(() => {
    if (resolution.type === "none") {
      return null;
    }

    const openResume = () => {
      if (resolution.type !== "next_action" || !resolution.resume) {
        return;
      }

      const request = resolution.resume.request;
      if (isHomeDailySessionKey(request.sessionKey)) {
        router.navigate({
          pathname: "/question",
          params: buildQuestionRouteParams({
            mode: request.mode,
            questionLimit: request.questionLimit,
            sessionKey: createHomeDailySessionKey(
              getWarsawIsoDate(),
              preferredCategory
            ),
            timeLimitSeconds: request.timeLimitSeconds,
          }),
        });
        return;
      }

      router.navigate({
        pathname: "/question",
        params: buildQuestionRouteParams({
          mode: request.mode,
          questionLimit: request.questionLimit,
          timeLimitSeconds: request.timeLimitSeconds,
          topic: request.topic,
        }),
      });
    };

    const trackPress = (kind: HomeContextualKind) => {
      track(ANALYTICS_EVENTS.homeContextualSelected.key, { kind });
    };

    if (resolution.type === "completion") {
      const event = resolution.event;
      const copy = presentCompletion(event, t);
      return {
        cta: copy.cta,
        icon: "check" as const,
        kind: "completion",
        onPress: () => {
          markCompletionShown(event.id);
          trackPress("completion");
          if (event.kind === "training") {
            router.navigate({
              pathname: "/exam",
              params: buildExamRouteParams({ mode: "exam" }),
            });
            return;
          }

          if (event.readinessDelta != null && event.readinessDelta > 0) {
            router.navigate("/statistics");
            return;
          }

          router.navigate("/trainer-modes");
        },
        subtitle: copy.subtitle,
        testID: "home-contextual-completion",
        title: copy.title,
      };
    }

    if (resolution.kind === "resume" && resolution.resume) {
      const resume = resolution.resume;
      const minutes = estimateSessionMinutes(resume.remaining);
      return {
        cta: t("dash.contextualContinueCta", { defaultValue: "Продовжити" }),
        icon: "play",
        kind: "resume",
        onPress: () => {
          trackPress("resume");
          openResume();
        },
        subtitle: appendMinutes(
          t("dash.contextualResumeSubtitle", {
            answered: resume.answered,
            defaultValue: "{{answered}} із {{total}} питань пройдено",
            total: resume.total,
          }),
          minutes,
          t
        ),
        testID: "home-contextual-resume",
        title: t("dash.contextualResumeTitle", {
          defaultValue: "Продовжити тренування",
        }),
      };
    }

    if (resolution.kind === "mistakes") {
      const count = resolution.count ?? 0;
      const sessionCount = Math.min(count, HOME_CONTEXTUAL_MISTAKES_LIMIT);
      const minutes = estimateSessionMinutes(sessionCount);
      return {
        cta: t("dash.contextualContinueCta", { defaultValue: "Продовжити" }),
        icon: "play",
        kind: "mistakes",
        onPress: () => {
          trackPress("mistakes");
          router.navigate({
            pathname: "/question",
            params: buildQuestionRouteParams({
              mode: "wrong_answers",
              questionLimit: sessionCount,
            }),
          });
        },
        subtitle: appendMinutes(
          t("dash.contextualMistakesSubtitle", {
            count,
            defaultValue: "{{count}} помилок чекають повторення",
          }),
          minutes,
          t
        ),
        testID: "home-contextual-mistakes",
        title: t("dash.contextualMistakesTitle", {
          defaultValue: "Продовжити підготовку",
        }),
      };
    }

    if (resolution.kind === "review") {
      const count = resolution.count ?? 0;
      const sessionCount = Math.min(count, HOME_CONTEXTUAL_REVIEW_LIMIT);
      const minutes = estimateSessionMinutes(sessionCount);
      return {
        cta: t("dash.contextualStartCta", { defaultValue: "Почати" }),
        icon: "repeat",
        kind: "review",
        onPress: () => {
          trackPress("review");
          router.navigate({
            pathname: "/question",
            params: buildQuestionRouteParams({
              mode: "review_due",
              questionLimit: sessionCount,
            }),
          });
        },
        subtitle: appendMinutes(
          t("dash.contextualReviewSubtitle", {
            count,
            defaultValue: "{{count}} питань готові до повторення",
          }),
          minutes,
          t
        ),
        testID: "home-contextual-review",
        title: t("dash.contextualReviewTitle", {
          defaultValue: "Пора повторити",
        }),
      };
    }

    const topic = resolution.weakTopic;
    const topicTitle =
      topic && isQuestionTopicId(topic.topicId)
        ? getQuestionTopicTitle(topic.topicId, preferredLocale)
        : "";
    const sessionCount = Math.min(
      topic?.remaining ?? 0,
      HOME_CONTEXTUAL_WEAK_TOPIC_LIMIT
    );
    const minutes = estimateSessionMinutes(sessionCount);

    return {
      cta: t("dash.contextualPracticeCta", { defaultValue: "Потренуватись" }),
      icon: "book",
      kind: "weak_topic",
      onPress: () => {
        if (!topic) {
          return;
        }

        trackPress("weak_topic");
        router.navigate({
          pathname: "/question",
          params: buildQuestionRouteParams({
            mode: "learning",
            questionLimit: sessionCount,
            topic: topic.topicId,
          }),
        });
      },
      subtitle: appendMinutes(
        t("dash.contextualWeakTopicSubtitle", {
          count: sessionCount,
          defaultValue: "{{count}} питань допоможуть закрити тему",
        }),
        minutes,
        t
      ),
      testID: "home-contextual-weak-topic",
      title: t("dash.contextualWeakTopicTitle", {
        defaultValue: "Слабке місце: {{topic}}",
        topic: topicTitle,
      }),
    };
  }, [
    markCompletionShown,
    preferredCategory,
    preferredLocale,
    resolution,
    t,
    track,
  ]);
}

function appendMinutes(
  subtitle: string,
  minutes: number,
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (minutes <= 0) {
    return subtitle;
  }

  return `${subtitle} · ${t("dash.contextualMinutes", {
    count: minutes,
    defaultValue: "~{{count}} хв",
  })}`;
}

function presentCompletion(
  event: {
    answeredCount: number;
    kind: "training" | "exam" | "review" | "mistakes" | "weak_spot";
    readinessDelta: number | null;
    totalCount: number;
  },
  t: ReturnType<typeof useTranslation>["t"]
) {
  const readinessCta =
    event.readinessDelta != null && event.readinessDelta > 0
      ? t("dash.completionReadinessCta", {
          defaultValue: "Індекс готовності +{{value}}%",
          value: event.readinessDelta,
        })
      : null;

  if (event.kind === "mistakes") {
    return {
      cta:
        readinessCta ??
        t("dash.completionContinueCta", {
          defaultValue: "Продовжити підготовку",
        }),
      subtitle: t("dash.completionMistakesSubtitle", {
        count: event.answeredCount,
        defaultValue: "{{count}} помилок повторено",
      }),
      title: t("dash.completionDoneTitle", {
        defaultValue: "Готово на зараз",
      }),
    };
  }

  if (event.kind === "review" || event.kind === "weak_spot") {
    return {
      cta: t("dash.completionContinueCta", {
        defaultValue: "Продовжити підготовку",
      }),
      subtitle: t("dash.completionWeakTopicSubtitle", {
        defaultValue: "Слабку тему закріплено",
      }),
      title: t("dash.completionReviewTitle", {
        defaultValue: "Повторення виконано",
      }),
    };
  }

  if (event.kind === "exam") {
    return {
      cta:
        readinessCta ??
        t("dash.completionContinueCta", {
          defaultValue: "Продовжити підготовку",
        }),
      subtitle: t("dash.completionSessionSubtitle", {
        answered: event.answeredCount,
        defaultValue: "{{answered}} із {{total}} питань пройдено",
        total: event.totalCount,
      }),
      title: t("dash.completionSessionTitle", {
        defaultValue: "Сесію завершено",
      }),
    };
  }

  return {
    cta:
      t("dash.completionExamCta", {
        defaultValue: "Можна перейти до іспиту",
      }),
    subtitle: t("dash.completionSessionSubtitle", {
      answered: event.answeredCount,
      defaultValue: "{{answered}} із {{total}} питань пройдено",
      total: event.totalCount,
    }),
    title: t("dash.completionSessionTitle", {
      defaultValue: "Сесію завершено",
    }),
  };
}
