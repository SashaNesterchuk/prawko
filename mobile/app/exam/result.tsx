import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isMobileSupabaseConfigured } from "../../src/config/env";
import { ExamRestartGateDialog } from "../../src/components/shell/ExamRestartGateDialog";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import {
  buildExamScopeSections,
  buildExamTopicStats,
  getExamDurationSeconds,
  getExamResultOutcome,
  getExamScoreDelta,
  getWeakestTopicBlock,
} from "../../src/features/exam/exam-result-stats";
import {
  ExamResultCenteredState,
  ExamResultView,
} from "../../src/features/exam/ExamResultView";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
} from "../../src/features/exam/exam-session";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import type {
  RemoteExamSession,
  RemoteExamSnapshot,
} from "../../src/features/exam/types";
import { useAdInterstitialActions } from "../../src/features/ads/show-interstitial";
import { ensureInterstitialReady } from "../../src/features/ads/interstitial-controller";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useAppShellStore } from "../../src/state/app-shell";
import { useHasPlusAccess } from "../../src/state/entitlements";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const authMode = useAppShellStore((state) => state.authMode);
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const { showInterstitialForUnlockGate } = useAdInterstitialActions();
  const hasPlusAccess = useHasPlusAccess();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [recentSessions, setRecentSessions] = useState<RemoteExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestartGateVisible, setIsRestartGateVisible] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const questionsSectionY = useRef(0);
  const modalHideResolverRef = useRef<(() => void) | null>(null);

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;
  const canFetchRecent =
    authMode === "supabase" && isMobileSupabaseConfigured;

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage("Invalid exam session id.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void fetchExamSessionSnapshot(sessionId)
      .then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch exam result snapshot.", error);
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!canFetchRecent || !snapshot || snapshot.session.status === "active") {
      return;
    }

    let cancelled = false;
    void fetchRecentExamSessions(5)
      .then((sessions) => {
        if (!cancelled) {
          setRecentSessions(sessions);
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch recent exam sessions for delta.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [canFetchRecent, snapshot]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId: snapshot.session.id,
      },
    });
  }, [snapshot]);

  const outcome = useMemo(
    () => (snapshot ? getExamResultOutcome(snapshot.session) : "failed"),
    [snapshot]
  );
  const topicStats = useMemo(
    () => (snapshot ? buildExamTopicStats(snapshot) : []),
    [snapshot]
  );
  const scopeSections = useMemo(
    () =>
      snapshot ? buildExamScopeSections(snapshot, questionUserState) : [],
    [questionUserState, snapshot]
  );
  const scoreDelta = useMemo(
    () =>
      snapshot ? getExamScoreDelta(snapshot.session, recentSessions) : null,
    [recentSessions, snapshot]
  );
  const weakestTopicBlock = getWeakestTopicBlock(topicStats);
  const weakestTopicLabel = weakestTopicBlock
    ? t(`topics.${weakestTopicBlock}`)
    : null;

  if (isLoading) {
    return (
      <ExamResultCenteredState
        title={t("states.loadingTitle")}
        description={t("exam.resultLoading")}
      />
    );
  }

  if (!snapshot) {
    return (
      <ExamResultCenteredState
        title={t("exam.resultMissingTitle")}
        description={errorMessage ?? t("exam.resultMissingBody")}
        actionLabel={t("exam.backToPracticeCta")}
        onAction={() => router.replace("/(tabs)")}
      />
    );
  }

  const restartParams = buildExamRouteParams({
    mode: snapshot.session.mode,
    questionLimit: snapshot.session.totalQuestionsTarget,
    studyPlanTaskId: getStudyPlanTaskId(snapshot.session.metadata),
  });

  function goHome() {
    router.replace("/(tabs)");
  }

  function startNewExam() {
    setIsRestartGateVisible(false);
    router.replace({
      pathname: "/exam",
      params: restartParams,
    });
  }

  function waitForModalHidden() {
    return new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        modalHideResolverRef.current = null;
        resolve();
      };

      modalHideResolverRef.current = finish;
      setIsRestartGateVisible(false);
      // Android has no Modal onDismiss — fall back after fade animation.
      setTimeout(finish, 450);
    });
  }

  function handleNewAttempt() {
    if (hasPlusAccess) {
      startNewExam();
      return;
    }

    setIsRestartGateVisible(true);
    // Warm inventory while the user reads the dialog — avoids first-tap miss.
    void ensureInterstitialReady({ attempts: 3, timeoutMs: 12_000 });
  }

  async function handleWatchAd() {
    if (isWatchingAd) {
      return;
    }

    setIsWatchingAd(true);

    try {
      // Wait until RN Modal fully dismisses — showing AdMob over a fading Modal
      // makes the interstitial flash and can leave a touch-blocking overlay.
      await waitForModalHidden();
      const shown = await showInterstitialForUnlockGate();

      if (shown) {
        // Let AdMob tear down its native view before navigating.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // No inventory / failed show — unlock quietly and continue.
      startNewExam();
    } catch (error) {
      console.warn("Exam restart ad failed.", error);
      startNewExam();
    } finally {
      setIsWatchingAd(false);
    }
  }

  function handlePremium() {
    setIsRestartGateVisible(false);
    // Replace so paywall does not stack on top of result and reopen it on back.
    router.replace({
      pathname: "/paywall",
      params: {
        feature: "premium_access",
        returnTo: "exam",
        ...restartParams,
      },
    });
  }

  function goWorkOnMistakes() {
    router.replace({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: "wrong_answers",
      }),
    });
  }

  return (
    <>
      <ExamResultView
        correctAnswersCount={snapshot.session.correctAnswersCount}
        durationSeconds={getExamDurationSeconds(snapshot.session)}
        onClose={goHome}
        onNewAttempt={handleNewAttempt}
        onPrimaryAction={outcome === "passed" ? goHome : goWorkOnMistakes}
        onReviewAnswers={() => undefined}
        outcome={outcome}
        passPoints={snapshot.session.passPoints}
        questionsSectionY={questionsSectionY}
        scoreDelta={scoreDelta}
        scorePoints={snapshot.session.scorePoints}
        scopeSections={scopeSections}
        topicStats={topicStats}
        totalPointsTarget={snapshot.session.totalPointsTarget}
        totalQuestionsAnswered={snapshot.session.totalQuestionsTarget}
        weakestTopicLabel={weakestTopicLabel}
      />

      <ExamRestartGateDialog
        visible={isRestartGateVisible}
        title={t("exam.restartGateTitle")}
        body={t("exam.restartGateBody")}
        watchAdLabel={
          isWatchingAd
            ? t("exam.restartGateWatchingAd")
            : t("exam.restartGateWatchAdCta")
        }
        premiumLabel={t("exam.restartGatePremiumCta")}
        isWatchingAd={isWatchingAd}
        onClose={() => {
          if (isWatchingAd) {
            return;
          }

          setIsRestartGateVisible(false);
        }}
        onDismiss={() => {
          modalHideResolverRef.current?.();
        }}
        onWatchAd={() => {
          void handleWatchAd();
        }}
        onPremium={handlePremium}
      />
    </>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getStudyPlanTaskId(metadata: Record<string, unknown>) {
  const value = metadata.study_plan_task_id;

  return typeof value === "string" && value.trim() ? value : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to load exam result.";
}
