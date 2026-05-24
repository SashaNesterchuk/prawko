import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { FREE_TIER_LIMITS, type SupportedLocale } from "@prawko/config";

import { AppButton } from "../src/components/shell/AppButton";
import { AppCard } from "../src/components/shell/AppCard";
import { AppScreen } from "../src/components/shell/AppScreen";
import {
  EmptyStateView,
  LoadingStateView,
} from "../src/components/shell/StateViews";
import { isMobileSupabaseConfigured } from "../src/config/env";
import { fetchRemoteDailyUsageSnapshot } from "../src/features/entitlements/supabase-daily-usage";
import { useErrorLogger } from "../src/providers/ErrorLoggingProvider";
import {
  buildQuestionRouteParams,
  isUuidString,
} from "../src/features/questions/question-routes";
import { QuestionMediaCard } from "../src/features/questions/QuestionMediaCard";
import {
  createQuestionSessionKey,
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
  getQuestionSessionSummary,
  getQuestionUserState,
  isQuestionReviewDue,
  isQuestionSessionMode,
  isTopicBlockId,
} from "../src/features/questions/question-engine";
import type { LocalQuestion } from "../src/features/questions/types";
import { recordQuestionAttemptBySourceId } from "../src/features/questions/supabase-question-attempts";
import {
  syncQuestionBookmarkState,
  syncQuestionHardState,
} from "../src/features/questions/supabase-question-state";
import { useAppShellStore } from "../src/state/app-shell";
import { useHasFeatureAccess } from "../src/state/entitlements";
import {
  useFreeTierQuestionUsageHydrated,
  useFreeTierQuestionUsageStore,
  useUsedFreeQuestionAnswersToday,
} from "../src/state/free-tier-usage";
import { useQuestionCatalogVersion } from "../src/state/question-catalog";
import {
  useActiveQuestionSession,
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../src/state/question-progress";

const RESULT_COLORS = {
  correctBorder: "#5D8A80",
  correctSurface: "#E6F2EC",
  wrongBorder: "#C2826B",
  wrongSurface: "#F7E7DF",
};

export default function QuestionScreen() {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    questionLimit?: string | string[];
    session?: string | string[];
    studyPlanTaskId?: string | string[];
    topic?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);
  const hasPremiumAccess = useHasFeatureAccess("premium_access");
  const freeTierQuestionUsageHydrated = useFreeTierQuestionUsageHydrated();
  const localUsedQuestionAnswersToday = useUsedFreeQuestionAnswersToday();
  const consumeFreeQuestionAnswer = useFreeTierQuestionUsageStore(
    (state) => state.consumeQuestionAnswer
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionProgressHydrated = useQuestionProgressHydrated();
  const activeSession = useActiveQuestionSession();
  const startSession = useQuestionProgressStore((state) => state.startSession);
  const answerCurrentQuestion = useQuestionProgressStore(
    (state) => state.answerCurrentQuestion
  );
  const advanceSession = useQuestionProgressStore((state) => state.advanceSession);
  const toggleBookmark = useQuestionProgressStore((state) => state.toggleBookmark);
  const toggleHard = useQuestionProgressStore((state) => state.toggleHard);
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const [displayLocale, setDisplayLocale] =
    useState<SupportedLocale>(preferredLocale);
  const [remoteUsedQuestionAnswersToday, setRemoteUsedQuestionAnswersToday] =
    useState<number | null>(null);
  const [hasRemoteUsageResolved, setHasRemoteUsageResolved] = useState(false);
  const questionStartedAtRef = useRef(Date.now());

  const rawMode = getSingleParam(params.mode);
  const rawQuestionLimit = getSingleParam(params.questionLimit);
  const rawTopic = getSingleParam(params.topic);
  const routeSessionKey = getSingleParam(params.session);
  const rawStudyPlanTaskId = getSingleParam(params.studyPlanTaskId);
  const mode = rawMode && isQuestionSessionMode(rawMode) ? rawMode : "learning";
  const questionLimit = parsePositiveInteger(rawQuestionLimit);
  const studyPlanTaskId = isUuidString(rawStudyPlanTaskId)
    ? rawStudyPlanTaskId
    : undefined;
  const topic = rawTopic && isTopicBlockId(rawTopic) ? rawTopic : undefined;
  const sessionKey = useMemo(
    () => routeSessionKey ?? createQuestionSessionKey({ mode, topic }),
    [mode, routeSessionKey, topic]
  );

  useEffect(() => {
    setDisplayLocale(preferredLocale);
  }, [preferredLocale, sessionKey]);

  useEffect(() => {
    if (!questionProgressHydrated) {
      return;
    }

    const shouldReuseExistingSession =
      !routeSessionKey &&
      activeSession &&
      activeSession.request.mode === mode &&
      activeSession.request.questionLimit === questionLimit &&
      activeSession.request.studyPlanTaskId === studyPlanTaskId &&
      activeSession.request.topic === topic;

    if (shouldReuseExistingSession) {
      return;
    }

    const shouldStartSession =
      !activeSession ||
      activeSession.request.sessionKey !== sessionKey ||
      activeSession.request.mode !== mode ||
      activeSession.request.questionLimit !== questionLimit ||
      activeSession.request.studyPlanTaskId !== studyPlanTaskId ||
      activeSession.request.topic !== topic;

    if (shouldStartSession) {
      startSession({
        mode,
        questionLimit,
        topic,
        sessionKey,
        studyPlanTaskId,
      });
    }
  }, [
    activeSession,
    mode,
    questionLimit,
    questionProgressHydrated,
    routeSessionKey,
    sessionKey,
    startSession,
    studyPlanTaskId,
    topic,
  ]);

  const summary = useMemo(
    () => getQuestionSessionSummary(activeSession),
    [activeSession]
  );
  const currentQuestionId =
    activeSession?.questionIds[activeSession.currentIndex] ?? null;
  const currentQuestion = useMemo(
    () => (currentQuestionId ? getQuestionById(currentQuestionId) : null),
    [currentQuestionId, questionCatalogVersion]
  );
  const currentAnswer = currentQuestionId
    ? activeSession?.answers[currentQuestionId] ?? null
    : null;
  const sessionMode = activeSession?.request.mode ?? mode;
  const sessionTopic = activeSession?.request.topic ?? topic;
  const currentQuestionState = currentQuestionId
    ? getQuestionUserState(questionUserState, currentQuestionId)
    : null;
  const bookmarkedCount = activeSession
    ? activeSession.questionIds.filter(
      (questionId) => getQuestionUserState(questionUserState, questionId).isBookmarked
    ).length
    : 0;
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];
  const isCompleted = Boolean(activeSession?.finishedAt && !activeSession.emptyReason);
  const isEmptyState = Boolean(activeSession?.emptyReason);
  const hasUnlimitedQuestionPractice = hasPremiumAccess;
  const shouldLoadRemoteQuestionUsage =
    authMode === "supabase" &&
    Boolean(supabaseUserId) &&
    isMobileSupabaseConfigured &&
    !hasUnlimitedQuestionPractice;
  const usedQuestionAnswersToday = hasUnlimitedQuestionPractice
    ? 0
    : remoteUsedQuestionAnswersToday === null
      ? localUsedQuestionAnswersToday
      : Math.max(remoteUsedQuestionAnswersToday, localUsedQuestionAnswersToday);
  const remainingFreeQuestionAnswers = Math.max(
    0,
    FREE_TIER_LIMITS.questionPracticePerDay - usedQuestionAnswersToday
  );
  const questionLimitReached =
    !hasUnlimitedQuestionPractice && remainingFreeQuestionAnswers <= 0;
  const styles = getStyles();

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionId]);

  useEffect(() => {
    if (!shouldLoadRemoteQuestionUsage) {
      setRemoteUsedQuestionAnswersToday(null);
      setHasRemoteUsageResolved(true);
      return;
    }

    let cancelled = false;
    setHasRemoteUsageResolved(false);

    void fetchRemoteDailyUsageSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setRemoteUsedQuestionAnswersToday(snapshot.questionAttemptsUsedToday);
        setHasRemoteUsageResolved(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.warn("Failed to fetch the remote daily question usage snapshot.", error);
        captureError({
          area: "question_practice",
          error,
          eventName: "remote_daily_usage_snapshot_failed",
          message:
            "Failed to fetch the remote daily question practice usage snapshot.",
          metadata: {
            user_id: supabaseUserId,
          },
          severity: "warning",
        });
        setRemoteUsedQuestionAnswersToday(null);
        setHasRemoteUsageResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [captureError, shouldLoadRemoteQuestionUsage, supabaseUserId]);

  function openQuestionPracticePaywall() {
    router.push({
      pathname: "/modals/paywall",
      params: {
        feature: "premium_access",
      },
    });
  }

  const screenSubtitle = isCompleted
    ? t("question.summarySubtitle", {
      correct: summary.correct,
      total: summary.total,
      mode: t(`modes.${sessionMode}`),
    })
    : isEmptyState
      ? t(`question.emptyReasons.${activeSession?.emptyReason ?? "general_empty"}`)
      : t("question.subtitle", {
        current: activeSession ? activeSession.currentIndex + 1 : 1,
        total: summary.total || 1,
        mode: t(`modes.${sessionMode}`),
        topic: sessionTopic
          ? t(`topics.${sessionTopic}`)
          : t("question.generalPool"),
      });

  const footer = (
    <View style={{ gap: 10 }}>
      {/* Footer: completed session actions */}
      {isCompleted ? (
        <>
          <AppButton
            label={t("question.restartSession")}
            onPress={() =>
              router.replace({
                pathname: "/question",
                params: buildQuestionRouteParams({
                  mode: activeSession?.request.mode ?? sessionMode,
                  questionLimit: activeSession?.request.questionLimit,
                  studyPlanTaskId: activeSession?.request.studyPlanTaskId,
                  topic: activeSession?.request.topic,
                }),
              })
            }
          />
          {summary.wrong > 0 ? (
            <AppButton
              variant="secondary"
              label={t("question.reviewWeakSpots")}
              onPress={() =>
                router.replace({
                  pathname: "/question",
                  params: buildQuestionRouteParams({ mode: "weak_spots" }),
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {/* Footer: empty session actions */}
      {isEmptyState ? (
        <AppButton
          label={t("question.openLearningQueue")}
          onPress={() =>
            router.replace({
              pathname: "/question",
              params: buildQuestionRouteParams({ mode: "learning", topic }),
            })
          }
        />
      ) : null}

      {/* Footer: next question / summary */}
      {!isCompleted && !isEmptyState && currentAnswer ? (
        <AppButton
          label={
            summary.answered >= summary.total
              ? t("question.openSummary")
              : t("question.nextQuestion")
          }
          onPress={() => advanceSession()}
        />
      ) : null}

      {/* Footer: practice limit paywall */}
      {!isCompleted && !isEmptyState && questionLimitReached ? (
        <AppButton
          variant="secondary"
          label={t("question.practiceUnlockCta")}
          onPress={() => openQuestionPracticePaywall()}
        />
      ) : null}

      {/* Footer: close */}
      <AppButton
        variant="ghost"
        label={t("common.close")}
        onPress={() => router.back()}
      />
    </View>
  );

  if (
    !questionProgressHydrated ||
    !freeTierQuestionUsageHydrated ||
    (shouldLoadRemoteQuestionUsage && !hasRemoteUsageResolved) ||
    !activeSession
  ) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  if (isEmptyState) {
    return (
      <AppScreen scroll={false} footer={footer}>
        <EmptyStateView
          title={t("question.emptyTitle")}
          description={screenSubtitle}
        />
      </AppScreen>
    );
  }

  if (isCompleted) {
    return (
      <AppScreen subtitle={screenSubtitle} footer={footer}>
        <View style={{ gap: 12 }}>
          {/* Session summary metric block */}
          <AppCard accent>
            <Text style={styles.summaryMetric}>
              {summary.correct}/{summary.total}
            </Text>
            <Text style={styles.summaryLabel}>{t("question.correctLabel")}</Text>
            <Text style={styles.summaryBody}>
              {t("question.summaryBody", {
                wrong: summary.wrong,
                saved: bookmarkedCount,
              })}
            </Text>
          </AppCard>

          {/* Session summary breakdown block */}
          <AppCard>
            <Text style={styles.sectionTitle}>{t("question.summaryBreakdown")}</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemValue}>{summary.answered}</Text>
                <Text style={styles.summaryItemLabel}>{t("question.answeredLabel")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemValue}>{summary.wrong}</Text>
                <Text style={styles.summaryItemLabel}>{t("question.wrongLabel")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemValue}>{bookmarkedCount}</Text>
                <Text style={styles.summaryItemLabel}>{t("question.savedLabel")}</Text>
              </View>
            </View>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  if (!currentQuestion || !currentQuestionId || !currentQuestionState) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("question.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen subtitle={screenSubtitle} footer={footer}>
      <View style={{ gap: 12 }}>
        {/* Question media block */}
        {currentQuestion.media ? (
          <View style={styles.mediaBleed}>
            <QuestionMediaCard
              locale={displayLocale}
              media={currentQuestion.media}
            />
          </View>
        ) : null}

        {/* Question prompt block */}
        <AppCard>
          <Text style={styles.promptText}>
            {getLocalizedText(currentQuestion.prompt, displayLocale)}
          </Text>
          <Text style={styles.pointsText}>
            {t("question.pointsLabel", { points: currentQuestion.points })}
          </Text>
        </AppCard>

        {/* Practice limit block */}
        {questionLimitReached ? (
          <AppCard>
            <Text style={styles.sectionTitle}>
              {t("question.practiceLimitReachedTitle")}
            </Text>
            <Text style={styles.feedbackBody}>
              {t("question.practiceLimitReachedBody", {
                count: FREE_TIER_LIMITS.questionPracticePerDay,
              })}
            </Text>
            <View style={{ marginTop: 10 }}>
              <AppButton
                label={t("question.practiceUnlockCta")}
                onPress={() => openQuestionPracticePaywall()}
              />
            </View>
          </AppCard>
        ) : null}

        {/* Answer choices block */}
        <View style={styles.answerChoicesRow}>
          {questionChoices.map((choice) => {
            const isSelected = currentAnswer?.selectedAnswer === choice.id;
            const isCorrectChoice = currentQuestion.correctAnswer === choice.id;
            const hasAnswered = Boolean(currentAnswer);
            const shouldShowCorrect =
              hasAnswered && isSelected && isCorrectChoice;
            const shouldShowWrong =
              hasAnswered && isSelected && !isCorrectChoice;
            const shouldShowActive = isSelected && !hasAnswered;
            const choiceButtonLabel = getChoiceButtonLabel(
              currentQuestion.answerType,
              choice.id,
              choice.label
            );

            return (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={choice.label}
                onPress={() => {
                  if (questionLimitReached) {
                    openQuestionPracticePaywall();
                    return;
                  }

                  const isFirstAnswer = !currentAnswer;
                  const answeredAttempt = answerCurrentQuestion(choice.id);

                  if (!answeredAttempt) {
                    return;
                  }

                  if (!isFirstAnswer) {
                    return;
                  }

                  if (!hasUnlimitedQuestionPractice) {
                    const nextLocalUsedQuestionAnswers =
                      localUsedQuestionAnswersToday + 1;

                    consumeFreeQuestionAnswer();

                    if (shouldLoadRemoteQuestionUsage) {
                      setRemoteUsedQuestionAnswersToday((current) =>
                        current === null
                          ? nextLocalUsedQuestionAnswers
                          : Math.max(current + 1, nextLocalUsedQuestionAnswers)
                      );
                    }
                  }

                  if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
                    return;
                  }

                  const answerDurationMs = Math.max(
                    0,
                    Date.now() - questionStartedAtRef.current
                  );

                  void recordQuestionAttemptBySourceId({
                    questionSourceId: currentQuestion.id,
                    mode: sessionMode,
                    selectedAnswer: answeredAttempt.selectedAnswer,
                    isCorrect: answeredAttempt.isCorrect,
                    locale: displayLocale,
                    studyPlanId: currentStudyPlanRemoteId,
                    answerDurationMs,
                    explanationOpened: true,
                    aiChatUsed: false,
                    metadata: {
                      answered_at: answeredAttempt.answeredAt,
                      client_attempt_id: answeredAttempt.id,
                      client_session_id: answeredAttempt.sessionId,
                      displayed_locale: displayLocale,
                      source: "question_screen",
                      study_plan_task_id:
                        activeSession.request.studyPlanTaskId ?? null,
                      session_question_limit:
                        activeSession.request.questionLimit ?? null,
                      topic_block: currentQuestion.topicBlock,
                    },
                  }).catch((error) => {
                    console.warn(
                      `Failed to sync question attempt for ${currentQuestion.id}.`,
                      error
                    );
                  });
                }}
                style={[
                  styles.answerCard,
                  shouldShowCorrect
                    ? {
                      backgroundColor: RESULT_COLORS.correctSurface,
                      borderColor: RESULT_COLORS.correctBorder,
                    }
                    : null,
                  shouldShowWrong
                    ? {
                      backgroundColor: RESULT_COLORS.wrongSurface,
                      borderColor: RESULT_COLORS.wrongBorder,
                    }
                    : null,
                  questionLimitReached ? styles.answerCardDisabled : null,
                  shouldShowActive ? styles.answerCardActive : null,
                ]}
              >
                <Text style={styles.answerButtonLabel}>{choiceButtonLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Actions block */}
        <AppCard>
          <Text style={styles.sectionTitle}>{t("question.actionsTitle")}</Text>
          <View style={{ gap: 10 }}>
            <AppButton
              variant="secondary"
              label={t("question.askAi")}
              onPress={() =>
                router.push({
                  pathname: "/modals/ai-chat",
                  params: {
                    questionId: currentQuestionId,
                    locale: displayLocale,
                    selectedAnswer: currentAnswer?.selectedAnswer,
                  },
                })
              }
            />
            <AppButton
              variant="secondary"
              label={
                currentQuestionState.isBookmarked
                  ? t("question.removeBookmark")
                  : t("question.bookmark")
              }
              onPress={() => {
                const isBookmarked = toggleBookmark(currentQuestionId);

                Toast.show({
                  type: "success",
                  text1: isBookmarked
                    ? t("toasts.bookmarkSavedTitle")
                    : t("toasts.bookmarkRemovedTitle"),
                  text2: isBookmarked
                    ? t("toasts.bookmarkSavedSubtitle")
                    : t("toasts.bookmarkRemovedSubtitle"),
                });

                if (authMode === "supabase" && isMobileSupabaseConfigured) {
                  void syncQuestionBookmarkState({
                    questionSourceId: currentQuestionId,
                    isBookmarked,
                    savedFromMode: sessionMode,
                    metadata: {
                      source: "mobile_question_screen",
                    },
                  }).catch((error) => {
                    console.warn(
                      `Failed to sync bookmark state for ${currentQuestionId}.`,
                      error
                    );
                  });
                }
              }}
            />
            <AppButton
              variant="ghost"
              label={
                currentQuestionState.isHard
                  ? t("question.unmarkHard")
                  : t("question.markHard")
              }
              onPress={() => {
                const isHard = toggleHard(currentQuestionId);

                Toast.show({
                  type: "success",
                  text1: isHard
                    ? t("toasts.hardMarkedTitle")
                    : t("toasts.hardUnmarkedTitle"),
                  text2: isHard
                    ? t("toasts.hardMarkedSubtitle")
                    : t("toasts.hardUnmarkedSubtitle"),
                });

                if (authMode === "supabase" && isMobileSupabaseConfigured) {
                  void syncQuestionHardState({
                    questionSourceId: currentQuestionId,
                    isHard,
                    reviewDueAt: isHard ? new Date().toISOString() : null,
                  }).catch((error) => {
                    console.warn(
                      `Failed to sync hard state for ${currentQuestionId}.`,
                      error
                    );
                  });
                }
              }}
            />
          </View>
        </AppCard>

        {/* Progress card is not need */}
        {/* <AppCard>
          <Text style={styles.sectionTitle}>{t("question.progressTitle")}</Text>
          <View style={styles.metaPills}>
            <MetaPill
              label={t("question.seenLabel", {
                count: currentQuestionState.timesSeen,
              })}
            />
            <MetaPill
              label={t("question.correctCountLabel", {
                count: currentQuestionState.timesCorrect,
              })}
            />
            <MetaPill
              label={t("question.wrongCountLabel", {
                count: currentQuestionState.timesWrong,
              })}
            />
            {currentQuestionState.isBookmarked ? (
              <MetaPill label={t("question.savedTag")} accent />
            ) : null}
            {currentQuestionState.isHard ? (
              <MetaPill label={t("question.hardTag")} accent />
            ) : null}
            {isQuestionReviewDue(currentQuestionState) ? (
              <MetaPill label={t("question.reviewDue")} accent />
            ) : null}
          </View>
        </AppCard> */}
      </View>
    </AppScreen>
  );
}

function getChoiceButtonLabel(
  answerType: LocalQuestion["answerType"],
  choiceId: string,
  fullLabel: string
) {
  if (answerType === "boolean") {
    return fullLabel;
  }

  return choiceId.toUpperCase();
}

function MetaPill({
  accent = false,
  label,
}: {
  accent?: boolean;
  label: string;
}) {
  const styles = getStyles();

  return (
    <View style={[styles.metaPill, accent ? styles.metaPillAccent : null]}>
      <Text style={[styles.metaPillText, accent ? styles.metaPillTextAccent : null]}>
        {label}
      </Text>
    </View>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = Number.parseInt(value, 10);

  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

const getStyles = () =>
  StyleSheet.create({
    mediaBleed: {
      marginHorizontal: -20,
    },
    answerButtonLabel: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "800",
      color: "#182018",
      textAlign: "center",
    },
    answerCard: {
      flex: 1,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: "#D8D1C6",
      borderRadius: 20,
      backgroundColor: "#FFFDF8",
    },
    answerChoicesRow: {
      flexDirection: "row",
      gap: 10,
    },
    answerCardDisabled: {
      opacity: 0.52,
    },
    answerCardActive: {
      borderColor: "#5D8A80",
      backgroundColor: "#F3F0E6",
    },
    feedbackBody: {
      fontSize: 15,
      lineHeight: 24,
      color: "#182018",
    },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "#EDE4D3",
    },
    metaPillAccent: {
      backgroundColor: "#DCEBE5",
    },
    metaPillText: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      color: "#4E5A52",
    },
    metaPillTextAccent: {
      color: "#1E5B4F",
    },
    metaPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pointsText: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      color: "#1E5B4F",
    },
    progressCard: {
      gap: 8,
    },
    promptText: {
      fontSize: 21,
      lineHeight: 30,
      fontWeight: "800",
      color: "#182018",
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "800",
      marginBottom: 10,
      color: "#182018",
    },
    summaryBody: {
      fontSize: 14,
      lineHeight: 22,
      color: "#4E5A52",
    },
    summaryGrid: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    summaryItem: {
      minWidth: 92,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: "#F4EFE8",
      gap: 4,
    },
    summaryItemLabel: {
      fontSize: 13,
      lineHeight: 18,
      color: "#4E5A52",
    },
    summaryItemValue: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      color: "#182018",
    },
    summaryLabel: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      marginBottom: 6,
      color: "#4E5A52",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    summaryMetric: {
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "800",
      marginBottom: 2,
      color: "#182018",
    },
  });
