import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import {
  fetchExamSessionSnapshot,
  isExamSessionId,
} from "../../src/features/exam/exam-session";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { useAdInterstitialActions } from "../../src/features/ads/show-interstitial";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
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
  const resultAccent = passed ? accents.green : accents.amber;
  const styles = useStyles({ resultPercentColor: resultAccent.ink });
  const headerIconSize = responsiveFont(24);
  const statusIconSize = responsiveFont(40);
  const reviewIconSize = responsiveFont(24);

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
              size={headerIconSize}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.bodyArea}>
          <View style={styles.successBadge}>
            <MaterialCommunityIcons
              name={passed ? "check" : "restart"}
              size={statusIconSize}
              color={resultAccent.ink}
            />
          </View>

          <Text style={styles.resultTitle}>{t(titleKey, bodyParams)}</Text>

          <Text style={styles.resultPercent}>{scorePercent}%</Text>

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
                  size={reviewIconSize}
                  color={colors.textPrimary}
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

function useStyles({
  resultPercentColor,
}: {
  resultPercentColor?: string;
} = {}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
        backgroundColor: colors.paper,
      },
      container: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
      },
      headerButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        marginLeft: -spacing.exact(8),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
      },
      bodyArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      successBadge: {
        width: spacing.exact(96),
        height: spacing.exact(96),
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.exact(24),
      },
      resultTitle: {
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(36),
        fontWeight: "700",
        letterSpacing: -0.64,
        textAlign: "center",
        color: colors.textPrimary,
        marginBottom: spacing.exact(16),
      },
      resultPercent: {
        fontSize: responsiveFont(52),
        lineHeight: responsiveFont(54),
        fontWeight: "700",
        letterSpacing: -0.52,
        textAlign: "center",
        marginBottom: spacing.exact(12),
        color: resultPercentColor ?? colors.textPrimary,
      },
      resultCount: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        textAlign: "center",
        color: colors.textPrimary,
        fontWeight: "600",
        marginBottom: spacing.exact(4),
      },
      resultSubcount: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(8),
      },
      passThreshold: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        textAlign: "center",
        color: colors.textMuted,
        marginBottom: spacing.exact(16),
      },
      resultBody: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(24),
      },
      reviewCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(16),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        alignSelf: "stretch",
      },
      reviewIconBox: {
        padding: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: colors.paper,
      },
      reviewCardText: {
        flex: 1,
      },
      reviewTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      reviewSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      primaryButton: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(18),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 4,
      },
      primaryButtonText: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      pressed: {
        opacity: 0.9,
      },
      ghostButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      ghostText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textSecondary,
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
        textAlign: "center",
        color: colors.textPrimary,
      },
      centeredBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(22),
        textAlign: "center",
        color: colors.textSecondary,
      },
      centeredAction: {
        marginTop: spacing.exact(16),
        alignSelf: "stretch",
      },
    })
  );
}
