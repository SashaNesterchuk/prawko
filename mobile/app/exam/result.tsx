import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
} from "../../src/features/exam/exam-session";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useAdInterstitialActions } from "../../src/features/ads/show-interstitial";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const { maybeShowInterstitial } = useAdInterstitialActions();
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isExamSessionId(rawSessionId) ? rawSessionId : null;

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
    if (!snapshot || snapshot.session.status === "active") {
      return;
    }

    maybeShowInterstitial("after_exam_complete");
  }, [maybeShowInterstitial, snapshot]);

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

  const resultStatus = useMemo(() => {
    if (!snapshot) {
      return "failed";
    }

    if (snapshot.session.status === "expired") {
      return "expired";
    }

    if (snapshot.session.status === "abandoned") {
      return "abandoned";
    }

    return snapshot.session.passed ? "passed" : "failed";
  }, [snapshot]);

  const wrongCount = snapshot?.session.wrongAnswersCount ?? 0;
  const passed = resultStatus === "passed";
  const resultAccent = passed ? greenWaveAccent.green : greenWaveAccent.amber;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <CenteredState
          title={t("states.loadingTitle")}
          description={t("exam.resultLoading")}
        />
      </SafeAreaView>
    );
  }

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <CenteredState
          title={t("exam.resultMissingTitle")}
          description={errorMessage ?? t("exam.resultMissingBody")}
          actionLabel={t("exam.backToPracticeCta")}
          onAction={() => router.replace("/practice")}
        />
      </SafeAreaView>
    );
  }

  const totalPoints = snapshot.session.totalPointsTarget || 1;
  const scorePercent = Math.round(
    (snapshot.session.scorePoints / totalPoints) * 100
  );
  const restartParams = buildExamRouteParams({
    mode: snapshot.session.mode,
    questionLimit: snapshot.session.totalQuestionsTarget,
    studyPlanTaskId: getStudyPlanTaskId(snapshot.session.metadata),
  });

  const titleKey =
    resultStatus === "passed"
      ? "exam.resultGoodTitle"
      : resultStatus === "failed"
        ? "exam.resultNeedsWorkTitle"
        : `exam.outcomes.${resultStatus}.title`;

  const bodyKey =
    resultStatus === "passed"
      ? "exam.resultGoodBody"
      : resultStatus === "failed"
        ? "exam.resultNeedsWorkBody"
        : `exam.outcomes.${resultStatus}.subtitle`;

  const bodyParams =
    resultStatus === "passed" || resultStatus === "failed"
      ? undefined
      : {
          score: snapshot.session.scorePoints,
          total: snapshot.session.totalPointsTarget,
        };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}
            onPress={() => router.replace("/practice")}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={greenWave.color.ink}
            />
          </Pressable>
        </View>

        <View style={styles.bodyArea}>
          <View style={styles.successBadge}>
            <MaterialCommunityIcons
              name={passed ? "check" : "restart"}
              size={40}
              color={resultAccent.ink}
            />
          </View>

          <Text style={styles.resultTitle}>{t(titleKey, bodyParams)}</Text>

          <Text style={[styles.resultPercent, { color: resultAccent.ink }]}>
            {scorePercent}%
          </Text>

          <Text style={styles.resultCount}>
            {t("exam.scoreOfTotal", {
              score: snapshot.session.scorePoints,
              total: snapshot.session.totalPointsTarget,
            })}
          </Text>

          <Text style={styles.resultSubcount}>
            {t("exam.correctOfTotal", {
              correct: snapshot.session.correctAnswersCount,
              total: snapshot.session.totalQuestionsAnswered,
            })}
          </Text>

          <Text style={styles.passThreshold}>
            {t("exam.passThresholdLine", {
              pass: snapshot.session.passPoints,
            })}
          </Text>

          <Text style={styles.resultBody}>
            {t(bodyKey, bodyParams)}
          </Text>

          {wrongCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace({
                  pathname: "/question",
                  params: buildQuestionRouteParams({
                    mode: "wrong_answers",
                  }),
                })
              }
              style={styles.reviewCard}
            >
              <View style={styles.reviewIconBox}>
                <MaterialCommunityIcons
                  name="book-open-variant"
                  size={24}
                  color={greenWave.color.ink}
                />
              </View>
              <View style={styles.reviewCardText}>
                <Text style={styles.reviewTitle}>
                  {t("exam.reviewWeakCardTitle")}
                </Text>
                <Text style={styles.reviewSubtitle}>
                  {t("exam.reviewWeakCardSubtitle", { count: wrongCount })}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: "/exam",
              params: restartParams,
            })
          }
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {passed ? t("exam.continuePractice") : t("exam.retryCta")}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.ghostButton}
          onPress={() => router.replace("/practice")}
        >
          <Text style={styles.ghostText}>{t("exam.later")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: greenWave.color.paper,
  },
  container: {
    flex: 1,
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    marginLeft: -greenWave.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
  },
  bodyArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: greenWave.spacing.xl,
  },
  resultTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.64,
    textAlign: "center",
    color: greenWave.color.ink,
    marginBottom: greenWave.spacing.lg,
  },
  resultPercent: {
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "700",
    letterSpacing: -0.52,
    textAlign: "center",
    marginBottom: greenWave.spacing.md,
  },
  resultCount: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: greenWave.color.ink,
    fontWeight: "600",
    marginBottom: greenWave.spacing.xs,
  },
  resultSubcount: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
    marginBottom: greenWave.spacing.sm,
  },
  passThreshold: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: greenWave.color.inkMuted,
    marginBottom: greenWave.spacing.lg,
  },
  resultBody: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
    marginBottom: greenWave.spacing.xl,
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    alignSelf: "stretch",
  },
  reviewIconBox: {
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.paper,
  },
  reviewCardText: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  reviewSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  primaryButton: {
    borderRadius: greenWave.radius.pill,
    paddingHorizontal: greenWave.spacing.xl,
    paddingVertical: greenWave.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWaveAccent.green.fill,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.onAccent,
  },
  pressed: {
    opacity: 0.9,
  },
  ghostButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.md,
  },
  ghostText: {
    fontSize: 16,
    lineHeight: 24,
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
    textAlign: "center",
    color: greenWave.color.ink,
  },
  centeredBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  centeredAction: {
    marginTop: greenWave.spacing.lg,
    alignSelf: "stretch",
  },
});
