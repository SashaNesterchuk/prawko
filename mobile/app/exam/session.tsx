import { router, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SUPPORTED_LOCALES } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import {
  EmptyStateView,
  LoadingStateView,
} from "../../src/components/shell/StateViews";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  formatExamCountdown,
  getRemainingExamSeconds,
} from "../../src/features/exam/exam-config";
import {
  fetchExamSessionSnapshot,
  setRemoteExamSessionStatus,
  submitRemoteExamAnswer,
} from "../../src/features/exam/supabase-exam";
import { QuestionMediaCard } from "../../src/features/questions/QuestionMediaCard";
import { getLocalizedText, getQuestionById, getQuestionChoices } from "../../src/features/questions/question-engine";
import { isUuidString } from "../../src/features/questions/question-routes";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";

export default function ExamSessionScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const authMode = useAppShellStore((state) => state.authMode);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const allowNavigationRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const questionStartedAtRef = useRef(Date.now());

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isUuidString(rawSessionId) ? rawSessionId : null;
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
  const displayLocale = useMemo(() => {
    if (!snapshot) {
      return preferredLocale;
    }

    return SUPPORTED_LOCALES.includes(snapshot.session.sessionLocale)
      ? snapshot.session.sessionLocale
      : preferredLocale;
  }, [preferredLocale, snapshot]);
  const questionChoices = currentQuestion
    ? getQuestionChoices(currentQuestion, displayLocale)
    : [];

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
          console.warn("Failed to fetch exam session snapshot.", error);
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
    if (snapshot?.session.status !== "active") {
      return;
    }

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowNavigationRef.current) {
        return;
      }

      event.preventDefault();
    });

    return unsubscribe;
  }, [navigation, snapshot?.session.status]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    questionStartedAtRef.current = Date.now();
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
    if (!snapshot) {
      return;
    }

    if (snapshot.session.status !== "active") {
      navigateToResult(snapshot.session.id);
    }
  }, [snapshot]);

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

  const handleAnswer = async (answerId: string) => {
    if (
      !sessionId ||
      !snapshot ||
      !currentQuestionRef ||
      !currentQuestion ||
      submittingAnswerId ||
      isEnding
    ) {
      return;
    }

    setSubmittingAnswerId(answerId);
    setErrorMessage(null);

    try {
      const nextSnapshot = await submitRemoteExamAnswer({
        answerDurationMs: Math.max(0, Date.now() - questionStartedAtRef.current),
        answerGiven: answerId,
        locale: displayLocale,
        metadata: {
          source: "mobile_exam_session",
          question_order: currentQuestionRef.order,
          question_source_id: currentQuestionRef.questionSourceId,
        },
        sessionId,
      });

      setSnapshot(nextSnapshot);
    } catch (error) {
      console.warn("Failed to submit exam answer.", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmittingAnswerId(null);
    }
  };

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
      if (authMode === "supabase" && isMobileSupabaseConfigured) {
        const nextSnapshot = await setRemoteExamSessionStatus({
          metadata: {
            source: "mobile_exam_session",
            ...metadata,
          },
          sessionId,
          status,
        });

        navigateToResult(nextSnapshot.session.id);
        return;
      }

      navigateToResult(sessionId);
    } catch (error) {
      console.warn("Failed to end exam session.", error);
      setErrorMessage(getErrorMessage(error));
      timeoutHandledRef.current = false;
    } finally {
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return (
      <AppScreen
        title={t("exam.sessionTitle")}
        subtitle={t("exam.sessionLoading")}
        scroll={false}
      >
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("exam.sessionLoading")}
        />
      </AppScreen>
    );
  }

  if (!snapshot || !currentQuestion || !currentQuestionRef) {
    return (
      <AppScreen
        title={t("exam.sessionTitle")}
        subtitle={t("exam.sessionErrorTitle")}
        footer={
          <View style={{ gap: 10 }}>
            <AppButton
              label={t("exam.backToPracticeCta")}
              onPress={() => router.replace("/(tabs)/practice")}
            />
          </View>
        }
      >
        <EmptyStateView
          title={t("exam.sessionErrorTitle")}
          description={errorMessage ?? t("exam.sessionErrorBody")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={t("exam.sessionTitle")}
      subtitle={t("exam.sessionSubtitle", {
        current: snapshot.session.currentQuestionIndex,
        total: snapshot.session.totalQuestionsTarget,
      })}
      footer={
        <View style={{ gap: 10 }}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          <AppButton
            variant="ghost"
            label={
              isEnding ? t("exam.endingEarlyLoading") : t("exam.endEarlyCta")
            }
            onPress={() =>
              void handleEndSession("abandoned", {
                reason: "user_ended_early",
              })
            }
            disabled={Boolean(submittingAnswerId) || isEnding}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <View style={styles.headerRow}>
            <View style={styles.headerMetric}>
              <Text style={styles.metricLabel}>{t("exam.timerLabel")}</Text>
              <Text style={styles.metricValue}>
                {formatExamCountdown(snapshot.session.remainingSeconds)}
              </Text>
            </View>
            <View style={styles.headerMetric}>
              <Text style={styles.metricLabel}>{t("exam.progressLabel")}</Text>
              <Text style={styles.metricValue}>
                {snapshot.session.currentQuestionIndex}/{snapshot.session.totalQuestionsTarget}
              </Text>
            </View>
          </View>
          <Text style={styles.noticeText}>{t("exam.sessionNotice")}</Text>
        </AppCard>

        <AppCard>
          <View style={styles.metaPills}>
            <MetaPill label={t(`topics.${currentQuestion.topicBlock}`)} />
            <MetaPill label={t(`question.scopes.${currentQuestion.scope}`)} />
            <MetaPill
              label={t("question.pointsLabel", {
                points: currentQuestion.points,
              })}
            />
          </View>
        </AppCard>

        {currentQuestion.media ? (
          <QuestionMediaCard
            locale={displayLocale}
            media={currentQuestion.media}
          />
        ) : null}

        <AppCard>
          <Text style={styles.promptText}>
            {getLocalizedText(currentQuestion.prompt, displayLocale)}
          </Text>
          <Text style={styles.helperText}>{t("exam.chooseAnswerPrompt")}</Text>
        </AppCard>

        <View style={{ gap: 10 }}>
          {questionChoices.map((choice) => {
            const isSubmittingThisChoice = submittingAnswerId === choice.id;

            return (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                disabled={Boolean(submittingAnswerId) || isEnding}
                onPress={() => void handleAnswer(choice.id)}
                style={[
                  styles.answerCard,
                  isSubmittingThisChoice ? styles.answerCardActive : null,
                ]}
              >
                <Text style={styles.answerKey}>{choice.id.toUpperCase()}</Text>
                <View style={styles.answerBody}>
                  <Text style={styles.answerLabel}>{choice.label}</Text>
                  {isSubmittingThisChoice ? (
                    <Text style={styles.answerHint}>{t("exam.savingAnswer")}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
  );

  function navigateToResult(nextSessionId: string) {
    allowNavigationRef.current = true;
    router.replace({
      pathname: "/exam/result",
      params: {
        sessionId: nextSessionId,
      },
    });
  }
}

function MetaPill({ label }: { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
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

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    answerBody: {
      flex: 1,
      gap: 4,
    },
    answerCard: {
      alignItems: "flex-start",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderSoft,
      borderRadius: theme.radius.large,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      padding: 18,
    },
    answerCardActive: {
      backgroundColor: theme.colors.cardAccent,
      borderColor: theme.colors.accent,
    },
    answerHint: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 20,
    },
    answerKey: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 22,
      width: 30,
    },
    answerLabel: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 24,
    },
    errorText: {
      color: "#A44E37",
      fontSize: 13,
      lineHeight: 20,
    },
    headerMetric: {
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    helperText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
    },
    metaPill: {
      backgroundColor: theme.colors.cardMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    metaPillText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      lineHeight: 16,
      textTransform: "uppercase",
    },
    metaPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      lineHeight: 18,
      textTransform: "uppercase",
    },
    metricValue: {
      color: theme.colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 34,
    },
    noticeText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },
    promptText: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 30,
    },
  });
