import { router, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../../src/components/icons";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { TrainingExitDialog } from "../../src/components/shell/TrainingExitDialog";
import { setExamSessionActive } from "../../src/features/ads/ad-session-policy";
import {
  formatExamCountdown,
  formatQuestionCountdown,
  getRemainingExamSeconds,
} from "../../src/features/exam/exam-config";
import { ExamQuestionProgressBar } from "../../src/features/exam/ExamQuestionProgressBar";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
  setExamSessionStatus,
  submitExamAnswer,
} from "../../src/features/exam/exam-session";
import {
  cacheExamSnapshot,
  getCachedExamSnapshot,
  isFinishedExamStatus,
  loadPersistedExamSnapshot,
} from "../../src/features/exam/exam-snapshot-cache";
import { useExamQuestionTimer } from "../../src/features/exam/useExamQuestionTimer";
import { QuestionMediaCard } from "../../src/features/questions/QuestionMediaCard";
import { QuestionMediaEmptyPlaceholder } from "../../src/features/questions/QuestionMediaEmptyPlaceholder";
import {
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
  getQuestionUserState,
} from "../../src/features/questions/question-engine";
import { syncQuestionBookmarkState } from "../../src/features/questions/supabase-question-state";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { useResponsiveStyles } from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";

const URGENT_THRESHOLD_SECONDS = 180;
const SUPPORT_EMAIL = "support@prawko.app";

type ExamSessionShellProps = {
  children: ReactNode;
  styles: { safeArea: object };
};

function ExamSessionShell({ children, styles }: ExamSessionShellProps) {
  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        {children}
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

export default function ExamSessionScreen() {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const applyQuestionAttemptOutcome = useQuestionProgressStore(
    (state) => state.applyQuestionAttemptOutcome
  );
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const toggleBookmark = useQuestionProgressStore(
    (state) => state.toggleBookmark
  );
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const allowNavigationRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const questionTimeoutHandledRef = useRef(false);
  const questionStartedAtRef = useRef(Date.now());
  const resultNavigationHandledRef = useRef(false);
  // Empty open + close = miss-click: no confirm dialog, no result screen.
  const hasStartedExamRef = useRef(false);
  const exitHandlersRef = useRef<{
    dismissEmptyExam: () => void;
    requestExitDialog: () => void;
  }>({
    dismissEmptyExam: () => undefined,
    requestExitDialog: () => undefined,
  });

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;
  const currentQuestionRef = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return (
      snapshot.questions.find(
        (question) => question.order === snapshot.session.currentQuestionIndex
      ) ?? null
    );
  }, [snapshot]);
  const currentQuestion = useMemo(
    () =>
      currentQuestionRef ? getQuestionById(currentQuestionRef.questionSourceId) : null,
    [currentQuestionRef, questionCatalogVersion]
  );
  // Follow live preferred locale (same as training) so mid-exam language
  // changes update question text immediately, not only after a reload.
  const displayLocale = preferredLocale;
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];
  const remainingSeconds = snapshot?.session.remainingSeconds ?? null;
  const hasVideo = currentQuestion?.media?.type === "video";
  const questionTimer = useExamQuestionTimer({
    enabled: snapshot?.session.status === "active",
    hasVideo: Boolean(hasVideo),
    questionId: currentQuestion?.id ?? null,
    scope: currentQuestion?.scope ?? null,
  });
  const styles = useStyles();

  function navigateToResult(
    nextSessionId: string,
    nextSnapshot?: RemoteExamSnapshot | null
  ) {
    if (resultNavigationHandledRef.current) {
      return;
    }

    if (nextSnapshot) {
      cacheExamSnapshot(nextSnapshot);
    } else if (snapshot && snapshot.session.id === nextSessionId) {
      cacheExamSnapshot(snapshot);
    }

    resultNavigationHandledRef.current = true;
    allowNavigationRef.current = true;
    router.replace({
      pathname: "/exam/result",
      params: {
        sessionId: nextSessionId,
      },
    });
  }

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage("Invalid exam session id.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    resultNavigationHandledRef.current = false;
    allowNavigationRef.current = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const nextSnapshot = await fetchExamSessionSnapshot(sessionId);
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to fetch exam session snapshot.", error);

        const fallback =
          getCachedExamSnapshot(sessionId) ??
          (await loadPersistedExamSnapshot(sessionId));

        if (fallback) {
          // Finished sessions should open the result screen, not the error CTA.
          setSnapshot(fallback);
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const isActive = snapshot?.session.status === "active";
    setExamSessionActive(isActive);

    return () => {
      setExamSessionActive(false);
    };
  }, [snapshot?.session.status]);

  useEffect(() => {
    if (snapshot?.session.status !== "active") {
      return;
    }

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowNavigationRef.current) {
        return;
      }

      // Swipe is disabled on this screen; this covers hardware / JS back.
      event.preventDefault();

      if (!hasStartedExamRef.current) {
        exitHandlersRef.current.dismissEmptyExam();
        return;
      }

      exitHandlersRef.current.requestExitDialog();
    });

    return unsubscribe;
  }, [navigation, snapshot?.session.status]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    questionStartedAtRef.current = Date.now();
    setSelectedAnswerId(null);
  }, [currentQuestionRef?.questionSourceId, snapshot?.session.status]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    const tick = () => {
      setSnapshot((current) => {
        if (!current || current.session.status !== "active") {
          return current;
        }

        return {
          ...current,
          session: {
            ...current.session,
            remainingSeconds: getRemainingExamSeconds(current.session.expiresAt),
          },
        };
      });
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [snapshot?.session.id, snapshot?.session.status]);

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.session.status !== "active" ||
      snapshot.session.remainingSeconds === null ||
      snapshot.session.remainingSeconds > 0 ||
      timeoutHandledRef.current
    ) {
      return;
    }

    timeoutHandledRef.current = true;
    void handleEndSession("expired", {
      reason: "timer_elapsed",
    });
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status === "active") {
      return;
    }

    navigateToResult(snapshot.session.id, snapshot);
  }, [snapshot?.session.id, snapshot?.session.status]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    const hasCurrentQuestion = snapshot.questions.some(
      (question) => question.order === snapshot.session.currentQuestionIndex
    );
    const answeredOut =
      snapshot.answers.length >= snapshot.session.totalQuestionsTarget;

    // Remote completion sets currentQuestionIndex to total+1. Recover to result
    // instead of painting sessionErrorTitle.
    if (!hasCurrentQuestion && answeredOut) {
      navigateToResult(snapshot.session.id, snapshot);
    }
  }, [
    snapshot?.session.id,
    snapshot?.session.status,
    snapshot?.session.currentQuestionIndex,
    snapshot?.session.totalQuestionsTarget,
    snapshot?.answers.length,
    snapshot?.questions,
  ]);

  const handleAdvance = async (options?: {
    answer?: string | null;
    timedOut?: boolean;
  }) => {
    if (
      !sessionId ||
      !snapshot ||
      !currentQuestionRef ||
      !currentQuestion ||
      isSubmitting ||
      isEnding
    ) {
      return;
    }

    const answerGiven =
      options?.answer ??
      selectedAnswerId ??
      (options?.timedOut
        ? pickTimeoutAnswer(currentQuestion, questionChoices)
        : null);

    if (!answerGiven) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const answeredAt = new Date().toISOString();
      const isCorrect = currentQuestion.correctAnswer === answerGiven;
      const nextSnapshot = await submitExamAnswer({
        answerDurationMs: Math.max(0, Date.now() - questionStartedAtRef.current),
        answerGiven,
        locale: displayLocale,
        metadata: {
          source: "mobile_exam_session",
          question_order: currentQuestionRef.order,
          question_source_id: currentQuestionRef.questionSourceId,
          timed_out: Boolean(options?.timedOut),
        },
        sessionId,
      });

      applyQuestionAttemptOutcome(currentQuestionRef.questionSourceId, {
        answeredAt,
        isCorrect,
      });

      setSnapshot(nextSnapshot);
    } catch (error) {
      console.warn("Failed to submit exam answer.", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    questionTimeoutHandledRef.current = false;
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.session.status !== "active" ||
      !questionTimer.isAnswerTimedOut ||
      isSubmitting ||
      isEnding ||
      questionTimeoutHandledRef.current
    ) {
      return;
    }

    questionTimeoutHandledRef.current = true;
    void handleAdvance({
      answer: selectedAnswerId,
      timedOut: true,
    });
  }, [questionTimer.isAnswerTimedOut]);

  const handleEndSession = async (
    status: "abandoned" | "expired",
    metadata: Record<string, unknown>
  ) => {
    if (!sessionId || isEnding) {
      return;
    }

    setIsEnding(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await setExamSessionStatus({
        metadata: {
          source: "mobile_exam_session",
          ...metadata,
        },
        sessionId,
        status,
      });

      navigateToResult(nextSnapshot.session.id, nextSnapshot);
    } catch (error) {
      console.warn("Failed to end exam session.", error);
      setErrorMessage(getErrorMessage(error));
      timeoutHandledRef.current = false;
    } finally {
      setIsEnding(false);
    }
  };

  const handleDevFillRemaining = async (mode: "success" | "random") => {
    if (!__DEV__ || !sessionId || !snapshot || isSubmitting || isEnding) {
      return;
    }

    questionTimeoutHandledRef.current = true;
    timeoutHandledRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let current = snapshot;

      while (current.session.status === "active") {
        const questionRef = current.questions.find(
          (question) => question.order === current.session.currentQuestionIndex
        );

        if (!questionRef) {
          break;
        }

        const question = getQuestionById(questionRef.questionSourceId);

        if (!question) {
          break;
        }

        const choices = getQuestionChoices(question, displayLocale);
        const answerGiven =
          mode === "success"
            ? question.correctAnswer
            : choices[Math.floor(Math.random() * Math.max(1, choices.length))]
                ?.id ?? question.correctAnswer;

        const isCorrect = question.correctAnswer === answerGiven;
        current = await submitExamAnswer({
          answerDurationMs: 50,
          answerGiven,
          locale: displayLocale,
          metadata: {
            source: "mobile_exam_session_dev",
            question_order: questionRef.order,
            question_source_id: questionRef.questionSourceId,
            timed_out: false,
            fill_mode: mode,
          },
          sessionId,
        });

        applyQuestionAttemptOutcome(questionRef.questionSourceId, {
          answeredAt: new Date().toISOString(),
          isCorrect,
        });
      }

      setSnapshot(current);
    } catch (error) {
      console.warn("Dev exam fill failed.", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportProblem = () => {
    if (!currentQuestionRef) {
      return;
    }

    const subject = t("question.reportProblemSubject", {
      questionId: currentQuestionRef.questionSourceId,
    });
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    );
  };

  const handleToggleBookmark = () => {
    if (!currentQuestionRef) {
      return;
    }

    const questionSourceId = currentQuestionRef.questionSourceId;
    const isBookmarked = toggleBookmark(questionSourceId);

    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      void syncQuestionBookmarkState({
        questionSourceId,
        isBookmarked,
        savedFromMode: snapshot?.session.mode,
        metadata: {
          source: "mobile_exam_session",
          exam_session_id: sessionId,
        },
      }).catch((error) => {
        console.warn(
          `Failed to sync bookmark state for ${questionSourceId}.`,
          error
        );
      });
    }
  };

  const hasStartedExam =
    (snapshot?.answers.length ?? 0) > 0 || selectedAnswerId != null;
  hasStartedExamRef.current = hasStartedExam;

  const dismissEmptyExamAsMissClick = async () => {
    if (!sessionId || isEnding) {
      return;
    }

    setIsEnding(true);
    setShowExitDialog(false);
    setErrorMessage(null);

    try {
      await setExamSessionStatus({
        metadata: {
          source: "mobile_exam_session",
          reason: "miss_click_empty_exit",
        },
        sessionId,
        status: "abandoned",
      });
    } catch (error) {
      // Still leave — empty exit is a miss-click, not a result flow.
      console.warn("Failed to discard empty exam session.", error);
    } finally {
      allowNavigationRef.current = true;
      setExamSessionActive(false);
      router.replace("/(tabs)");
      setIsEnding(false);
    }
  };

  const handleExitPress = () => {
    if (isEnding) {
      return;
    }

    if (!hasStartedExam) {
      void dismissEmptyExamAsMissClick();
      return;
    }

    setShowExitDialog(true);
  };

  const handleDismissExitDialog = () => {
    setShowExitDialog(false);
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    void handleEndSession("abandoned", {
      reason: "user_ended_early",
    });
  };

  exitHandlersRef.current = {
    dismissEmptyExam: () => {
      void dismissEmptyExamAsMissClick();
    },
    requestExitDialog: () => {
      if (!isEnding) {
        setShowExitDialog(true);
      }
    },
  };

  if (isLoading) {
    return (
      <ExamSessionShell styles={styles}>
        <CenteredState
          title={t("states.loadingTitle")}
          description={t("exam.sessionLoading")}
        />
      </ExamSessionShell>
    );
  }

  if (!snapshot) {
    return (
      <ExamSessionShell styles={styles}>
        <CenteredState
          title={t("exam.sessionErrorTitle")}
          description={errorMessage ?? t("exam.sessionErrorBody")}
          actionLabel={t("exam.backToPracticeCta")}
          onAction={() => router.replace("/(tabs)")}
        />
      </ExamSessionShell>
    );
  }

  if (snapshot.session.status !== "active") {
    return (
      <ExamSessionShell styles={styles}>
        <CenteredState
          title={t("states.loadingTitle")}
          description={t("exam.sessionLoading")}
        />
      </ExamSessionShell>
    );
  }

  if (!currentQuestion || !currentQuestionRef) {
    const answeredOut =
      snapshot.answers.length >= snapshot.session.totalQuestionsTarget ||
      isFinishedExamStatus(snapshot.session.status);

    if (answeredOut) {
      return (
        <ExamSessionShell styles={styles}>
          <CenteredState
            title={t("states.loadingTitle")}
            description={t("exam.sessionLoading")}
          />
        </ExamSessionShell>
      );
    }

    return (
      <ExamSessionShell styles={styles}>
        <CenteredState
          title={t("exam.sessionErrorTitle")}
          description={errorMessage ?? t("exam.sessionErrorBody")}
          actionLabel={t("exam.backToPracticeCta")}
          onAction={() => router.replace("/(tabs)")}
        />
      </ExamSessionShell>
    );
  }

  const isSessionUrgent =
    remainingSeconds != null && remainingSeconds <= URGENT_THRESHOLD_SECONDS;
  const orderIndex = snapshot.questions.findIndex(
    (question) => question.order === snapshot.session.currentQuestionIndex
  );
  const questionNumber =
    orderIndex >= 0 ? orderIndex + 1 : snapshot.session.currentQuestionIndex;
  const totalQuestions = snapshot.session.totalQuestionsTarget;
  const isLastQuestion = questionNumber >= totalQuestions;
  const isBoolean = currentQuestion.answerType === "boolean";
  const isCurrentBookmarked = Boolean(
    getQuestionUserState(questionUserState, currentQuestionRef.questionSourceId)
      .isBookmarked
  );
  const isBusy = isSubmitting || isEnding;
  // WORD never disables answers during a question — only block while submitting.
  const answersDisabled = isBusy;
  const primaryDisabled = !selectedAnswerId || isBusy;
  const questionTimerLabel =
    questionTimer.phase === "media" || questionTimer.isTimerPaused
      ? t("exam.questionMediaPausedLabel")
      : questionTimer.phase === "read"
        ? t("exam.questionReadTimeLabel")
        : t("exam.questionAnswerTimeLabel");
  const progressAnimationKey = `${currentQuestion.id}:${questionTimer.phase}:${questionTimer.phaseEpoch}`;
  const timedProgressMs =
    questionTimer.phase === "media" || questionTimer.isTimerPaused
      ? null
      : Math.max(0, questionTimer.phaseTotalSeconds * 1000);

  return (
    <ExamSessionShell styles={styles}>
      <View style={styles.container}>
        {__DEV__ ? (
          <View style={styles.devCheatBar} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => {
                void handleDevFillRemaining("success");
              }}
              style={({ pressed }) => [
                styles.devCheatButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.devCheatLabel}>OK</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => {
                void handleDevFillRemaining("random");
              }}
              style={({ pressed }) => [
                styles.devCheatButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.devCheatLabel}>Rnd</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => {
                void handleEndSession("abandoned", { reason: "dev_skip" });
              }}
              style={({ pressed }) => [
                styles.devCheatButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.devCheatLabel}>Skip</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.headerBlock}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("exam.exitConfirmTitle")}
              disabled={isEnding}
              onPress={handleExitPress}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CloseIcon color={colors.textPrimary} />
            </Pressable>

            <View style={styles.topBarTitle}>
              <Text style={styles.eyebrow}>{t("exam.sessionEyebrow")}</Text>
              <Text style={styles.topBarHeading} numberOfLines={1}>
                {t("exam.sessionSubtitle", {
                  current: questionNumber,
                  total: totalQuestions,
                })}
              </Text>
            </View>

            <View
              style={[
                styles.timerPill,
                isSessionUrgent ? styles.timerPillUrgent : null,
              ]}
            >
              <ClockIcon
                color={isSessionUrgent ? accents.red.ink : colors.textPrimary}
              />
              <Text
                style={[
                  styles.timerPillText,
                  isSessionUrgent ? styles.timerPillTextUrgent : null,
                ]}
              >
                {formatExamCountdown(remainingSeconds)}
              </Text>
            </View>
          </View>

          <View style={styles.scopeRow}>
            <Text style={styles.scopeText}>
              {t(`question.scopes.${currentQuestion.scope}`)}
            </Text>
            <Text style={styles.scopeText}>
              {t("question.pointsLabel", { points: currentQuestion.points })}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mediaBleed}>
            {currentQuestion.media ? (
              <QuestionMediaCard
                key={currentQuestion.id}
                autoPlayVideo={false}
                locale={displayLocale}
                media={currentQuestion.media}
                onVideoEnded={questionTimer.handleVideoEnded}
                onVideoStarted={questionTimer.handleVideoStarted}
                // Manual play once; lock after the learner has started the film.
                playbackLocked={Boolean(hasVideo && questionTimer.hasPlayedVideo)}
              />
            ) : (
              <QuestionMediaEmptyPlaceholder />
            )}
          </View>

          <View style={styles.timerBlock}>
            <View style={styles.timerLabelRow}>
              <Text style={styles.timerLabel}>{questionTimerLabel}</Text>
              <Text style={styles.timerValue}>
                {formatQuestionCountdown(questionTimer.remainingSeconds)}
              </Text>
            </View>
            <ExamQuestionProgressBar
              animationKey={progressAnimationKey}
              progressFraction={questionTimer.progressFraction}
              timedDurationMs={timedProgressMs}
            />
          </View>

          <Text style={styles.promptText}>
            {getLocalizedText(currentQuestion.prompt, displayLocale)}
          </Text>

          {isBoolean ? (
            <View style={styles.optionsRow}>
              {questionChoices.map((choice) => {
                const selected = selectedAnswerId === choice.id;

                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={answersDisabled}
                    onPress={() => setSelectedAnswerId(choice.id)}
                    style={[
                      styles.booleanOption,
                      selected ? styles.optionSelected : null,
                      answersDisabled ? styles.optionDisabled : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.booleanOptionLabel,
                        selected ? styles.optionLabelSelected : null,
                      ]}
                    >
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.optionsColumn}>
              {questionChoices.map((choice) => {
                const selected = selectedAnswerId === choice.id;

                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={answersDisabled}
                    onPress={() => setSelectedAnswerId(choice.id)}
                    style={[
                      styles.multiOption,
                      selected ? styles.optionSelected : null,
                      answersDisabled ? styles.optionDisabled : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.letterCircle,
                        selected ? styles.letterCircleSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.letterText,
                          selected ? styles.letterTextSelected : null,
                        ]}
                      >
                        {choice.id.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.multiOptionLabel,
                        selected ? styles.optionLabelSelected : null,
                      ]}
                    >
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={primaryDisabled}
            onPress={() => void handleAdvance()}
            style={({ pressed }) => [
              styles.primaryButton,
              primaryDisabled ? styles.primaryButtonDisabled : null,
              pressed && !primaryDisabled ? styles.pressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>
              {isLastQuestion
                ? t("exam.finishCta")
                : t("exam.nextQuestionCta")}
            </Text>
          </Pressable>

          <View style={styles.ghostRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("question.reportProblem")}
              onPress={handleReportProblem}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonLabel}>{t("exam.reportCta")}</Text>
              <Icon name="problem" size={20} color={colors.ink2} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isCurrentBookmarked
                  ? t("question.removeBookmark")
                  : t("question.bookmark")
              }
              onPress={handleToggleBookmark}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonLabel}>{t("exam.saveCta")}</Text>
              <Icon
                name={isCurrentBookmarked ? "stateActive" : "stateDefault"}
                size={20}
                color={isCurrentBookmarked ? accents.amber.fill : colors.ink2}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <TrainingExitDialog
        body={t("exam.exitConfirmBody")}
        continueLabel={t("exam.exitConfirmContinue")}
        finishLabel={t("exam.exitConfirmFinish")}
        onContinue={handleDismissExitDialog}
        onFinish={handleConfirmExit}
        title={t("exam.exitConfirmTitle")}
        visible={showExitDialog}
      />
    </ExamSessionShell>
  );
}

function CenteredState({
  actionLabel,
  description,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
}) {
  const styles = useStyles();

  return (
    <View style={styles.centeredState}>
      <Text style={styles.centeredTitle}>{title}</Text>
      <Text style={styles.centeredBody}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.centeredAction,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CloseIcon({ color }: { color: string }) {
  const styles = useResponsiveStyles(({ spacing }) => ({
    glyph18: {
      width: spacing.exact(18),
      height: spacing.exact(18),
      alignItems: "center",
      justifyContent: "center",
    },
    glyphLinePositive: {
      position: "absolute",
      width: spacing.exact(18),
      height: spacing.exact(2),
      borderRadius: spacing.exact(1),
      backgroundColor: color,
      transform: [{ rotate: "45deg" }],
    },
    glyphLineNegative: {
      position: "absolute",
      width: spacing.exact(18),
      height: spacing.exact(2),
      borderRadius: spacing.exact(1),
      backgroundColor: color,
      transform: [{ rotate: "-45deg" }],
    },
  }));

  return (
    <View style={styles.glyph18}>
      <View style={styles.glyphLinePositive} />
      <View style={styles.glyphLineNegative} />
    </View>
  );
}

function ClockIcon({ color }: { color: string }) {
  const styles = useResponsiveStyles(({ spacing }) => ({
    clockFace: {
      width: spacing.exact(16),
      height: spacing.exact(16),
      borderRadius: spacing.exact(8),
      borderWidth: 1.6,
      borderColor: color,
      alignItems: "center",
      justifyContent: "center",
    },
    clockHandVertical: {
      position: "absolute",
      width: 1.6,
      height: spacing.exact(4.5),
      borderRadius: spacing.exact(1),
      top: spacing.exact(3),
      backgroundColor: color,
    },
    clockHandHorizontal: {
      position: "absolute",
      width: spacing.exact(4),
      height: 1.6,
      borderRadius: spacing.exact(1),
      left: spacing.exact(7),
      backgroundColor: color,
    },
  }));

  return (
    <View style={styles.clockFace}>
      <View style={styles.clockHandVertical} />
      <View style={styles.clockHandHorizontal} />
    </View>
  );
}

function pickTimeoutAnswer(
  question: NonNullable<ReturnType<typeof getQuestionById>>,
  choices: ReturnType<typeof getQuestionChoices>
) {
  const wrongChoice = choices.find(
    (choice) => choice.id !== question.correctAnswer
  );

  return wrongChoice?.id ?? choices[0]?.id ?? null;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to continue this exam session.";
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      container: {
        flex: 1,
      },
      devCheatBar: {
        position: "absolute",
        top: spacing.exact(4),
        right: spacing.exact(8),
        zIndex: 20,
        flexDirection: "row",
        gap: spacing.exact(4),
      },
      devCheatButton: {
        minWidth: spacing.exact(28),
        paddingHorizontal: spacing.exact(6),
        paddingVertical: spacing.exact(2),
        borderRadius: radius.sm,
        backgroundColor: colors.ink,
        opacity: 0.45,
        alignItems: "center",
        justifyContent: "center",
      },
      devCheatLabel: {
        fontSize: responsiveFont(10),
        lineHeight: responsiveFont(12),
        fontWeight: "700",
        color: colors.white,
      },
      contentPad: {
        paddingHorizontal: spacing.exact(24),
      },
      headerBlock: {
        paddingTop: spacing.exact(8),
        paddingHorizontal: spacing.exact(24),
        gap: spacing.exact(12),
      },
      topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      iconButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        marginLeft: -spacing.exact(8),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
      },
      topBarTitle: {
        flex: 1,
        gap: spacing.exact(2),
      },
      eyebrow: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      topBarHeading: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textPrimary,
      },
      timerPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(8),
        paddingVertical: spacing.exact(4),
        borderRadius: radius.md,
        backgroundColor: colors.track,
      },
      timerPillUrgent: {
        backgroundColor: accents.red.soft,
      },
      timerPillText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "600",
        letterSpacing: -0.14,
        fontVariant: ["tabular-nums"],
        color: colors.textPrimary,
      },
      timerPillTextUrgent: {
        color: accents.red.ink,
      },
      scopeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      scopeText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      scrollContent: {
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(12),
        gap: spacing.exact(12),
      },
      mediaBleed: {
        width: "100%",
        position: "relative",
      },
      timerBlock: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      timerLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      timerLabel: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      timerValue: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
        color: colors.textSecondary,
      },
      promptText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "500",
        letterSpacing: -0.16,
        color: colors.textPrimary,
        paddingHorizontal: spacing.exact(24),
      },
      optionsRow: {
        flexDirection: "row",
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      optionsColumn: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      booleanOption: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(12),
        paddingVertical: spacing.exact(20),
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
      },
      optionDisabled: {
        opacity: 0.55,
      },
      booleanOptionLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textPrimary,
        textAlign: "center",
      },
      multiOption: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(12),
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
      },
      optionSelected: {
        backgroundColor: accents.blue.fill,
      },
      optionLabelSelected: {
        color: colors.onAccent,
        fontWeight: "600",
      },
      letterCircle: {
        width: spacing.exact(24),
        height: spacing.exact(24),
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: colors.line,
        alignItems: "center",
        justifyContent: "center",
      },
      letterCircleSelected: {
        backgroundColor: colors.white,
        borderColor: colors.white,
      },
      letterText: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontWeight: "600",
        textAlign: "center",
        color: colors.textMuted,
      },
      letterTextSelected: {
        color: accents.blue.fill,
      },
      multiOptionLabel: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textPrimary,
      },
      footer: {
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(12),
        paddingBottom: spacing.exact(8),
        gap: spacing.exact(8),
      },
      primaryButton: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(18),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 4,
      },
      primaryButtonDisabled: {
        opacity: 0.45,
      },
      ghostRow: {
        flexDirection: "row",
        alignItems: "center",
      },
      ghostButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
        minHeight: spacing.exact(48),
      },
      ghostButtonLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.ink2,
      },
      primaryButtonLabel: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      pressed: {
        opacity: 0.85,
      },
      errorText: {
        fontSize: responsiveFont(13),
        lineHeight: responsiveFont(20),
        color: accents.red.ink,
      },
      centeredState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(24),
        gap: spacing.exact(8),
      },
      centeredTitle: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.textPrimary,
        textAlign: "center",
      },
      centeredBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
        textAlign: "center",
      },
      centeredAction: {
        marginTop: spacing.exact(12),
        alignSelf: "stretch",
      },
    })
  );
}
