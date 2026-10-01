import { router } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import {
  ReadinessIndexCard,
  resolveReadinessLevel,
} from "../../components/shell/ReadinessIndexCard";
import { isMobileSupabaseConfigured } from "../../config/env";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useAppShellStore, useCurrentUser } from "../../state/app-shell";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogVersion,
} from "../../state/question-catalog";
import {
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../../state/question-progress";
import {
  resolveReadinessView,
  useReadinessSnapshot,
  useReadinessSnapshotHydrated,
  useReadinessSnapshotStore,
  type ReadinessSnapshot,
} from "../../state/readiness-snapshot";
import {
  FIRST_START_QUESTION_COUNT,
  type FirstStartCtaSource,
} from "./first-start";
import {
  createHomeDailySessionKey,
  getHomeDailyPracticeStatus,
  HOME_DAILY_QUESTION_COUNT,
} from "./home-daily-practice";
import {
  getReadinessPeriodChange,
  resolveReadinessPeriodChangeLabelKey,
} from "../profile/profile-stats";
import { getQuestionDisplayStats } from "../questions/question-engine";
import { buildQuestionRouteParams } from "../questions/question-routes";
import { resolveReadinessScore } from "../questions/readiness-score";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  type RemoteReadinessSummary,
} from "../study-plan/supabase-study-plan-progress";

export function useReadinessCard() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const dismissHomeStartSpotlight = useAppShellStore(
    (state) => state.dismissHomeStartSpotlight
  );
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  const questionCatalogVersion = useQuestionCatalogVersion();
  const catalogResolved = useQuestionCatalogResolved();
  const progressHydrated = useQuestionProgressHydrated();
  const readinessSnapshot = useReadinessSnapshot();
  const readinessSnapshotHydrated = useReadinessSnapshotHydrated();
  const saveReadinessSnapshot = useReadinessSnapshotStore(
    (state) => state.saveSnapshot
  );
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const attempts = useQuestionProgressStore((state) => state.attempts);
  const homeDailySession = useQuestionProgressStore(
    (state) => state.homeDailySession
  );
  const readinessAssessment = useQuestionProgressStore(
    (state) => state.readinessAssessment
  );
  const [readinessSummary, setReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setReadinessSummary(null);
      return;
    }

    let cancelled = false;

    void fetchRemoteHomeProgress(getWarsawIsoDate())
      .then(({ readinessSummary: summary }) => {
        if (!cancelled) {
          setReadinessSummary(summary);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch readiness summary.", error);
          setReadinessSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, isFocused]);

  const statsRef = useRef(getQuestionDisplayStats(questionUserState));
  const stats = useMemo(() => {
    if (!isFocused) {
      return statsRef.current;
    }

    const next = getQuestionDisplayStats(questionUserState);
    statsRef.current = next;
    return next;
  }, [isFocused, questionCatalogVersion, questionUserState]);

  const readiness = resolveReadinessScore(readinessSummary?.readinessScore, {
    attempts,
    userStates: questionUserState,
    planCompletionPercent: readinessSummary?.planCompletionPercent,
    totalQuestions: stats.total,
  });
  const isLiveReadinessEmpty = stats.seen <= 0 && readinessAssessment == null;
  const readinessPeriodChange = useMemo(() => {
    if (!isFocused || isLiveReadinessEmpty) {
      return null;
    }

    return getReadinessPeriodChange({
      attempts,
      userStates: questionUserState,
      planCompletionPercent: readinessSummary?.planCompletionPercent,
      totalQuestions: stats.total,
      currentReadiness: readiness,
    });
  }, [
    attempts,
    isFocused,
    isLiveReadinessEmpty,
    questionUserState,
    readiness,
    readinessSummary?.planCompletionPercent,
    stats.total,
  ]);
  const liveReadiness = useMemo<ReadinessSnapshot>(
    () => ({
      isEmpty: isLiveReadinessEmpty,
      percent: readiness,
      seen: stats.seen,
      total: stats.total,
      weekChangePercent: readinessPeriodChange?.deltaPercent ?? null,
      weekChangePeriodDays: readinessPeriodChange?.periodDays ?? null,
      userId: currentUserId,
    }),
    [
      currentUserId,
      isLiveReadinessEmpty,
      readiness,
      readinessPeriodChange,
      stats.seen,
      stats.total,
    ]
  );
  const isLiveReadinessResolved = progressHydrated && catalogResolved;
  const readinessView = resolveReadinessView({
    live: liveReadiness,
    snapshot: readinessSnapshot,
    currentUserId,
    isLiveResolved: isLiveReadinessResolved,
    isProgressHydrated: progressHydrated,
    isSnapshotHydrated: readinessSnapshotHydrated,
  });

  useEffect(() => {
    if (!isFocused || !isLiveReadinessResolved || !readinessSnapshotHydrated) {
      return;
    }

    saveReadinessSnapshot(liveReadiness);
  }, [
    isFocused,
    isLiveReadinessResolved,
    liveReadiness,
    readinessSnapshotHydrated,
    saveReadinessSnapshot,
  ]);

  const isReadinessLoading = readinessView == null;
  const isReadinessEmpty = readinessView?.isEmpty ?? false;
  const showStartSpotlight = false;
  const readinessPercent = readinessView?.percent ?? 0;
  const readinessLevel = resolveReadinessLevel(readinessPercent);
  const readinessWeekChangePercent = readinessView?.weekChangePercent ?? null;
  const readinessWeekChangePeriodDays =
    readinessView?.weekChangePeriodDays ?? null;
  const readinessWeekChangeLabel =
    readinessWeekChangePeriodDays == null
      ? undefined
      : t(
          `dash.${resolveReadinessPeriodChangeLabelKey(
            readinessWeekChangePeriodDays
          )}`,
          {
            days: readinessWeekChangePeriodDays,
            value: Math.abs(readinessWeekChangePercent ?? 0),
          }
        );
  const readinessLevelLabel = t(`dash.readinessLevel.${readinessLevel}`, {
    defaultValue:
      readinessLevel === "high"
        ? "Високий"
        : readinessLevel === "mid"
          ? "Середній"
          : "Низький",
  });
  const todayIso = getWarsawIsoDate();
  const homeDailyStatus = getHomeDailyPracticeStatus({
    session: homeDailySession,
    today: todayIso,
    category: preferredCategory,
  });
  const startFirstSession = useCallback(
    (source: FirstStartCtaSource) => {
      if (homeDailyStatus === "done") {
        return;
      }

      dismissHomeStartSpotlight();
      track(ANALYTICS_EVENTS.firstStartStarted.key, {
        question_limit: FIRST_START_QUESTION_COUNT,
        source,
      });
      track(ANALYTICS_EVENTS.trainingModeSelected.key, {
        mode: "initial_diagnostic",
        question_limit: FIRST_START_QUESTION_COUNT,
        source,
        topic_id: null,
      });
      router.navigate({
        pathname: "/question",
        params: buildQuestionRouteParams({
          mode: "initial_diagnostic",
          questionLimit: HOME_DAILY_QUESTION_COUNT,
          sessionKey: createHomeDailySessionKey(todayIso, preferredCategory),
        }),
      });
    },
    [
      dismissHomeStartSpotlight,
      homeDailyStatus,
      preferredCategory,
      todayIso,
      track,
    ]
  );

  return {
    dueReviews: readinessSummary?.dueReviews ?? stats.reviewDue,
    isReadinessEmpty,
    isReadinessLoading,
    readinessLevelLabel,
    readinessPercent,
    readinessView,
    readinessWeekChangeLabel,
    readinessWeekChangePercent,
    showStartSpotlight,
    startFirstSession,
    t,
  };
}

export function ReadinessIndexBlock({
  readiness,
  testID,
}: {
  readiness: ReturnType<typeof useReadinessCard>;
  testID: string;
}) {
  return (
    <ReadinessIndexCard
      empty={readiness.isReadinessEmpty}
      loading={readiness.isReadinessLoading}
      progress={readiness.readinessPercent}
      testID={testID}
      title={readiness.t("dash.readinessTitle", {
        defaultValue: "Індекс готовності",
      })}
      subtitle={
        readiness.isReadinessEmpty
          ? readiness.t("dash.readinessEmptyDescription", {
              defaultValue:
                "Пройди швидкий тест, щоб оцінити свій рівень знань.",
            })
          : undefined
      }
      levelLabel={
        readiness.isReadinessEmpty ? undefined : readiness.readinessLevelLabel
      }
      coveredCountLabel={
        readiness.isReadinessEmpty || !readiness.readinessView
          ? undefined
          : `${readiness.readinessView.seen} / ${readiness.readinessView.total}`
      }
      coveredCaption={
        readiness.isReadinessEmpty
          ? undefined
          : readiness.t("dash.readinessCovered", {
              defaultValue: "Охоплено питань",
            })
      }
      detailsLabel={
        readiness.isReadinessEmpty
          ? readiness.t("dash.readinessDetails", {
              defaultValue: "Пройти тест",
            })
          : undefined
      }
      weekChangePercent={readiness.readinessWeekChangePercent}
      weekChangeLabel={readiness.readinessWeekChangeLabel}
      onPress={() => {
        if (readiness.isReadinessEmpty) {
          readiness.startFirstSession(
            readiness.showStartSpotlight ? "spotlight" : "card"
          );
          return;
        }

        router.navigate("/statistics");
      }}
    />
  );
}
