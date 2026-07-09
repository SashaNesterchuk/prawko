import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SUPPORTED_LOCALES } from "@prawko/config";

import { setExamSessionActive } from "../../src/features/ads/ad-session-policy";
import {
  formatExamCountdown,
  getRemainingExamSeconds,
} from "../../src/features/exam/exam-config";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
  setExamSessionStatus,
  submitExamAnswer,
} from "../../src/features/exam/exam-session";
import { QuestionMediaCard } from "../../src/features/questions/QuestionMediaCard";
import {
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
} from "../../src/features/questions/question-engine";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";

const URGENT_THRESHOLD_SECONDS = 180;

export default function ExamSessionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const allowNavigationRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const questionStartedAtRef = useRef(Date.now());

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

      event.preventDefault();
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

  const handleAdvance = async () => {
    if (
      !sessionId ||
      !snapshot ||
      !currentQuestionRef ||
      !currentQuestion ||
      !selectedAnswerId ||
      isSubmitting ||
      isEnding
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await submitExamAnswer({
        answerDurationMs: Math.max(0, Date.now() - questionStartedAtRef.current),
        answerGiven: selectedAnswerId,
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
      setIsSubmitting(false);
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
      const nextSnapshot = await setExamSessionStatus({
        metadata: {
          source: "mobile_exam_session",
          ...metadata,
        },
        sessionId,
        status,
      });

      navigateToResult(nextSnapshot.session.id);
    } catch (error) {
      console.warn("Failed to end exam session.", error);
      setErrorMessage(getErrorMessage(error));
      timeoutHandledRef.current = false;
    } finally {
      setIsEnding(false);
    }
  };

  const handleExitPress = () => {
    if (isEnding) {
      return;
    }

    Alert.alert(t("exam.exitConfirmTitle"), t("exam.exitConfirmBody"), [
      { text: t("exam.exitConfirmCancel"), style: "cancel" },
      {
        text: t("exam.exitConfirmConfirm"),
        style: "destructive",
        onPress: () =>
          void handleEndSession("abandoned", {
            reason: "user_ended_early",
          }),
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <CenteredState
          title={t("states.loadingTitle")}
          description={t("exam.sessionLoading")}
        />
      </SafeAreaView>
    );
  }

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <CenteredState
          title={t("exam.sessionErrorTitle")}
          description={errorMessage ?? t("exam.sessionErrorBody")}
          actionLabel={t("exam.backToPracticeCta")}
          onAction={() => router.replace("/practice")}
        />
      </SafeAreaView>
    );
  }

  if (snapshot.session.status !== "active") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.completeContainer}>
          <View style={styles.completeHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              hitSlop={8}
              onPress={() => navigateToResult(snapshot.session.id)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CloseIcon color={greenWave.color.ink} />
            </Pressable>
          </View>

          <View style={styles.completeBody}>
            <View style={styles.completeBadge}>
              <MaterialCommunityIcons
                name="check"
                size={40}
                color={greenWaveAccent.green.ink}
              />
            </View>
            <Text style={styles.completeTitle}>{t("exam.completeTitle")}</Text>
            <Text style={styles.completeMessage}>{t("exam.completeBody")}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigateToResult(snapshot.session.id)}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>
              {t("exam.viewResultCta")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion || !currentQuestionRef) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <CenteredState
          title={t("exam.sessionErrorTitle")}
          description={errorMessage ?? t("exam.sessionErrorBody")}
          actionLabel={t("exam.backToPracticeCta")}
          onAction={() => router.replace("/practice")}
        />
      </SafeAreaView>
    );
  }

  const totalSessionSeconds = getTotalSessionSeconds(snapshot);
  const remainingSeconds = snapshot.session.remainingSeconds;
  const progressFraction =
    totalSessionSeconds && remainingSeconds != null
      ? Math.max(0, Math.min(1, remainingSeconds / totalSessionSeconds))
      : 1;
  const isUrgent =
    remainingSeconds != null && remainingSeconds <= URGENT_THRESHOLD_SECONDS;
  const orderIndex = snapshot.questions.findIndex(
    (question) => question.order === snapshot.session.currentQuestionIndex
  );
  const questionNumber =
    orderIndex >= 0 ? orderIndex + 1 : snapshot.session.currentQuestionIndex;
  const totalQuestions = snapshot.session.totalQuestionsTarget;
  const isLastQuestion = questionNumber >= totalQuestions;
  const isBoolean = currentQuestion.answerType === "boolean";
  const isBusy = isSubmitting || isEnding;
  const primaryDisabled = !selectedAnswerId || isBusy;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.container}>
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
              <CloseIcon color={greenWave.color.ink} />
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
              style={[styles.timerPill, isUrgent ? styles.timerPillUrgent : null]}
            >
              <ClockIcon
                color={isUrgent ? greenWaveAccent.red.ink : greenWave.color.ink}
              />
              <Text
                style={[
                  styles.timerPillText,
                  isUrgent ? styles.timerPillTextUrgent : null,
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
          {currentQuestion.media ? (
            <View style={styles.mediaBleed}>
              <QuestionMediaCard
                locale={displayLocale}
                media={currentQuestion.media}
              />
            </View>
          ) : null}

          <View style={styles.timerBlock}>
            <View style={styles.timerLabelRow}>
              <Text style={styles.timerLabel}>
                {t("exam.timeRemainingLabel")}
              </Text>
              <Text style={styles.timerValue}>
                {formatExamCountdown(remainingSeconds)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressFraction * 100}%` },
                  isUrgent ? styles.progressFillUrgent : null,
                ]}
              />
            </View>
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
                    disabled={isBusy}
                    onPress={() => setSelectedAnswerId(choice.id)}
                    style={[
                      styles.booleanOption,
                      selected ? styles.optionSelected : null,
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
                    disabled={isBusy}
                    onPress={() => setSelectedAnswerId(choice.id)}
                    style={[
                      styles.multiOption,
                      selected ? styles.optionSelected : null,
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
        </View>
      </View>
    </SafeAreaView>
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
  return (
    <View style={styles.glyph18}>
      <View
        style={[
          styles.glyphLine,
          { backgroundColor: color, transform: [{ rotate: "45deg" }] },
        ]}
      />
      <View
        style={[
          styles.glyphLine,
          { backgroundColor: color, transform: [{ rotate: "-45deg" }] },
        ]}
      />
    </View>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <View style={[styles.clockFace, { borderColor: color }]}>
      <View style={[styles.clockHandVertical, { backgroundColor: color }]} />
      <View style={[styles.clockHandHorizontal, { backgroundColor: color }]} />
    </View>
  );
}

function getTotalSessionSeconds(snapshot: RemoteExamSnapshot) {
  const { expiresAt, startedAt } = snapshot.session;

  if (!expiresAt || !startedAt) {
    return null;
  }

  const diff = Math.floor(
    (new Date(expiresAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  return diff > 0 ? diff : null;
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: greenWave.color.paper,
  },
  container: {
    flex: 1,
    paddingHorizontal: greenWave.spacing.xl,
  },
  headerBlock: {
    paddingTop: greenWave.spacing.sm,
    gap: greenWave.spacing.md,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    marginLeft: -greenWave.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
  },
  topBarTitle: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  topBarHeading: {
    fontSize: 16,
    lineHeight: 24,
    color: greenWave.color.ink,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
    paddingHorizontal: greenWave.spacing.sm,
    paddingVertical: greenWave.spacing.xs,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.track,
  },
  timerPillUrgent: {
    backgroundColor: greenWaveAccent.red.soft,
  },
  timerPillText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.14,
    fontVariant: ["tabular-nums"],
    color: greenWave.color.ink,
  },
  timerPillTextUrgent: {
    color: greenWaveAccent.red.ink,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scopeText: {
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.inkSecondary,
  },
  scrollContent: {
    paddingTop: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.md,
    gap: greenWave.spacing.md,
  },
  mediaBleed: {
    marginHorizontal: -greenWave.spacing.xl,
  },
  timerBlock: {
    gap: greenWave.spacing.xs,
  },
  timerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkSecondary,
  },
  timerValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: greenWave.color.inkSecondary,
  },
  progressTrack: {
    height: 12,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
    overflow: "hidden",
  },
  progressFill: {
    height: 12,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.inkMuted,
  },
  progressFillUrgent: {
    backgroundColor: greenWaveAccent.red.fill,
  },
  promptText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  optionsRow: {
    flexDirection: "row",
    gap: greenWave.spacing.xs,
  },
  optionsColumn: {
    gap: greenWave.spacing.xs,
  },
  booleanOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.md,
    paddingVertical: 20,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
  },
  booleanOptionLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.ink,
    textAlign: "center",
  },
  multiOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.md,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
  },
  optionSelected: {
    backgroundColor: greenWaveAccent.blue.fill,
  },
  optionLabelSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  letterCircle: {
    width: 24,
    height: 24,
    borderRadius: greenWave.radius.pill,
    borderWidth: 2,
    borderColor: greenWave.color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  letterCircleSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  letterText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
    color: greenWave.color.inkMuted,
  },
  letterTextSelected: {
    color: greenWaveAccent.blue.fill,
  },
  multiOptionLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.ink,
  },
  footer: {
    paddingTop: greenWave.spacing.md,
    paddingBottom: greenWave.spacing.sm,
    gap: greenWave.spacing.sm,
  },
  primaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.xl,
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: "#ffffff",
  },
  pressed: {
    opacity: 0.85,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: greenWaveAccent.red.ink,
  },
  completeContainer: {
    flex: 1,
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.xl,
  },
  completeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  completeBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.md,
  },
  completeBadge: {
    width: 96,
    height: 96,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: greenWave.spacing.xl,
  },
  completeTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.64,
    textAlign: "center",
    color: greenWave.color.ink,
    marginBottom: greenWave.spacing.lg,
  },
  completeMessage: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.xl,
    gap: greenWave.spacing.sm,
  },
  centeredTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
    textAlign: "center",
  },
  centeredBody: {
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.inkSecondary,
    textAlign: "center",
  },
  centeredAction: {
    marginTop: greenWave.spacing.md,
    alignSelf: "stretch",
  },
  glyph18: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphLine: {
    position: "absolute",
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  clockFace: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  clockHandVertical: {
    position: "absolute",
    width: 1.6,
    height: 4.5,
    borderRadius: 1,
    top: 3,
  },
  clockHandHorizontal: {
    position: "absolute",
    width: 4,
    height: 1.6,
    borderRadius: 1,
    left: 7,
  },
});
