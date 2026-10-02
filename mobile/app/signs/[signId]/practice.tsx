import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { ScreenHeader } from "../../../src/components/shell/ScreenHeader";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../../src/portable-ui";
import { useTheme } from "../../../src/providers/ThemeProvider";
import {
  getRoadSignById,
  getRoadSignCategory,
} from "../../../src/features/road-signs/catalog";
import { pickLocalized } from "../../../src/features/road-signs/content/localized";
import {
  getSignDisplayName,
  getSignPractices,
} from "../../../src/features/road-signs/content/registry";
import type { SignPractice } from "../../../src/features/road-signs/content/types";
import { SignImage } from "../../../src/features/road-signs/SignImage";
import { useSignPracticeProgressStore } from "../../../src/state/sign-practice-progress";
import { ANALYTICS_EVENTS } from "../../../src/analytics/catalog";
import { createAnalyticsId } from "../../../src/analytics/runtime-context";
import { signTestAnalytics } from "../../../src/features/road-signs/sign-test-entry";
import { openPaywall } from "../../../src/features/monetization/v2/paywall";
import { useAnalytics } from "../../../src/providers/AnalyticsProvider";
import { useHasPlusAccess } from "../../../src/state/entitlements";
import { withRoadSignsFeature } from "../../../src/app-config/with-road-signs-feature";
import { useIsFocused } from "expo-router/react-navigation";
import { useAnalyticsDuration } from "../../../src/analytics/useAnalyticsDuration";
import { useAnalyticsViewState } from "../../../src/analytics/useAnalyticsViewState";
import { useLearningReadyAnalytics } from "../../../src/analytics/useLearningReadyAnalytics";

type PracticePhase = "question" | "result";

function SignPracticeScreen() {
  const { t, i18n } = useTranslation();
  const { track } = useAnalytics();
  const isFocused = useIsFocused();
  const hasPlusAccess = useHasPlusAccess();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const spacing = useResponsiveSpacing();
  const { signId } = useLocalSearchParams<{ signId: string }>();
  const sign = useMemo(
    () => (signId ? getRoadSignById(signId) : undefined),
    [signId]
  );
  const practices = useMemo(
    () => (signId ? getSignPractices(signId) : []),
    [signId]
  );
  const category = useMemo(
    () => (sign ? getRoadSignCategory(sign.categoryId) : undefined),
    [sign]
  );
  const accent = category ? accents[category.accent] : accents.amber;
  const styles = useStyles({
    accentInk: accent.ink,
    accentSoft: accent.soft,
    safeBottom,
  });
  const resultIconSize = responsiveFont(40);
  const signImageSize = spacing.exact(120);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState<PracticePhase>("question");
  const recordAttempt = useSignPracticeProgressStore(
    (state) => state.recordAttempt
  );
  const hasRecordedCompletionRef = useRef(false);
  const didTrackStartRef = useRef(false);
  const didTrackEndRef = useRef(false);
  const [signTestSessionId] = useState(() => createAnalyticsId("sign_test"));
  const questionStartedAtRef = useRef(Date.now());

  const currentQuestion: SignPractice | undefined = practices[questionIndex];
  const isLastQuestion = questionIndex >= practices.length - 1;
  const hasAnswered = selectedOptionId != null;
  const isCorrect =
    hasAnswered && selectedOptionId === currentQuestion?.correctOptionId;

  const displayName = sign
    ? getSignDisplayName(sign.id, i18n.language, sign.code)
    : t("signs.title");
  const questionId = `${signId}:${questionIndex + 1}`;
  const signContext = {
    sign_test_session_id: signTestSessionId, sign_id: signId ?? null,
    ...signTestAnalytics({ categoryId: sign?.categoryId, entry: "sign_detail" }),
    test_type: "sign_practice", question_id: questionId,
    question_index: questionIndex + 1, question_total: practices.length,
  };
  const questionReady = Boolean(sign && currentQuestion && practices.length && phase === "question");
  const questionDuration = useAnalyticsDuration(questionId, isFocused && questionReady && !hasAnswered);
  const attemptDuration = useAnalyticsDuration(signTestSessionId, isFocused && questionReady);
  useAnalyticsViewState(!sign || !currentQuestion || !practices.length ? "empty"
    : phase === "result" ? "result" : hasAnswered ? "feedback" : "question", signContext);
  useLearningReadyAnalytics(signTestSessionId, questionReady, { ...signContext, feature: "sign_practice" });
  const viewedStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isFocused || !sign || !currentQuestion || !practices.length) { viewedStateRef.current = null; return; }
    const key = phase === "result" ? "result" : questionId;
    if (viewedStateRef.current === key) return;
    viewedStateRef.current = key;
    track(phase === "result" ? ANALYTICS_EVENTS.signTestResultViewed.key : ANALYTICS_EVENTS.signTestQuestionViewed.key, {
      ...signContext, already_answered: hasAnswered, correct_count: correctCount,
    });
  }, [correctCount, currentQuestion, hasAnswered, isFocused, phase, practices.length, questionId, sign, signContext, track]);

  useLayoutEffect(() => {
    if (!sign || didTrackStartRef.current) {
      return;
    }

    didTrackStartRef.current = true;
    track(ANALYTICS_EVENTS.signTestStarted.key, {
      sign_test_session_id: signTestSessionId,
      ...signTestAnalytics({
        categoryId: sign.categoryId,
        entry: "sign_detail",
      }),
      question_total: practices.length,
      sign_id: sign.id,
      test_type: "sign_practice",
    });
  }, [practices.length, sign, signTestSessionId, track]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [questionIndex]);

  const handleSelectOption = (optionId: string) => {
    if (hasAnswered || !currentQuestion) {
      return;
    }

    setSelectedOptionId(optionId);

    if (optionId === currentQuestion.correctOptionId) {
      setCorrectCount((value) => value + 1);
    }

    track(ANALYTICS_EVENTS.signTestQuestionAnswered.key, {
      sign_test_session_id: signTestSessionId,
      ...signTestAnalytics({
        categoryId: sign?.categoryId,
        entry: "sign_detail",
      }),
      answer_duration_ms: Math.max(0, Date.now() - questionStartedAtRef.current),
      answer_id: `${signTestSessionId}:${questionId}`,
      question_visible_foreground_ms: questionDuration.measure().visible_foreground_ms,
      is_correct: optionId === currentQuestion.correctOptionId,
      question_id: `${signId}:${questionIndex + 1}`,
      question_index: questionIndex + 1,
      question_total: practices.length,
      sign_id: signId ?? null,
      test_type: "sign_practice",
    });
  };

  const handleContinue = () => {
    if (!hasAnswered) {
      return;
    }

    if (isLastQuestion) {
      if (!hasRecordedCompletionRef.current && sign) {
        recordAttempt({
          signId: sign.id,
          correctCount,
          totalQuestions: practices.length,
        });
        hasRecordedCompletionRef.current = true;
        track(ANALYTICS_EVENTS.signTestEnded.key, {
          sign_test_session_id: signTestSessionId,
          ...signTestAnalytics({
            categoryId: sign.categoryId,
            entry: "sign_detail",
          }),
          answered_count: practices.length,
          visit_foreground_ms: attemptDuration.measure().visible_foreground_ms,
          duration_scope: "current_component_visit",
          correct_count: correctCount,
          outcome: "completed",
          question_total: practices.length,
          sign_id: sign.id,
          test_type: "sign_practice",
        });
        didTrackEndRef.current = true;
      }

      setPhase("result");
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelectedOptionId(null);
  };

  const handleClose = () => {
    if (didTrackStartRef.current && !didTrackEndRef.current) {
      didTrackEndRef.current = true;
      track(ANALYTICS_EVENTS.signTestEnded.key, {
        ...signTestAnalytics({ categoryId: sign?.categoryId, entry: "sign_detail" }),
        sign_test_session_id: signTestSessionId,
        answered_count: Math.min(practices.length, questionIndex + (hasAnswered ? 1 : 0)),
        visit_foreground_ms: attemptDuration.measure().visible_foreground_ms,
        duration_scope: "current_component_visit",
        correct_count: correctCount,
        outcome: "abandoned",
        question_total: practices.length,
        sign_id: signId ?? null,
        test_type: "sign_practice",
      });
    }
    router.back();
  };

  if (!sign || practices.length === 0 || !currentQuestion) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <ScreenHeader
            title={t("signs.practiceTitle")}
            backLabel={t("common.back")}
            onBack={handleClose}
          />
          <View style={styles.missingState}>
            <CText style={styles.missingTitle}>{t("signs.notFoundTitle")}</CText>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  if (phase === "result") {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <ScreenHeader
            title={t("signs.practiceTitle")}
            backLabel={t("common.back")}
            onBack={handleClose}
          />

          <View style={styles.resultWrap}>
            <View style={styles.resultCard}>
              <View style={styles.resultIconWrap}>
                <Ionicons
                  color={accent.ink}
                  name="checkmark-circle"
                  size={resultIconSize}
                />
              </View>
              <CText style={styles.resultTitle}>{t("signs.practiceComplete")}</CText>
              <CText style={styles.resultScore}>
                {t("signs.practiceScore", {
                  correct: correctCount,
                  total: practices.length,
                })}
              </CText>
              <CText style={styles.resultSubtitle}>{displayName}</CText>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={handleClose}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CText style={styles.primaryButtonLabel}>{t("common.back")}</CText>
            </Pressable>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScreenHeader
          title={t("signs.practiceTitle")}
          backLabel={t("common.back")}
          onBack={handleClose}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            <CText style={styles.progressLabel}>
              {t("signs.practiceProgress", {
                current: questionIndex + 1,
                total: practices.length,
              })}
            </CText>
            <CText style={styles.progressName} numberOfLines={1}>
              {displayName}
            </CText>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.imageWrap}>
              <SignImage sign={sign} size={signImageSize} />
            </View>
          </View>

          <CText style={styles.prompt}>
            {pickLocalized(currentQuestion.prompt, i18n.language)}
          </CText>

          <View style={styles.options}>
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrectOption =
                option.id === currentQuestion.correctOptionId;

              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  disabled={hasAnswered}
                  onPress={() => handleSelectOption(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    !hasAnswered && isSelected ? styles.optionSelected : null,
                    hasAnswered && isCorrectOption ? styles.optionCorrect : null,
                    hasAnswered && isSelected && !isCorrectOption
                      ? styles.optionWrong
                      : null,
                    !hasAnswered && pressed ? styles.pressed : null,
                  ]}
                >
                  <CText
                    style={[
                      styles.optionLabel,
                      hasAnswered && isCorrectOption
                        ? styles.optionLabelCorrect
                        : null,
                      hasAnswered && isSelected && !isCorrectOption
                        ? styles.optionLabelWrong
                        : null,
                    ]}
                  >
                    {pickLocalized(option.label, i18n.language)}
                  </CText>
                </Pressable>
              );
            })}
          </View>

          {hasAnswered && currentQuestion.explanation ? (
            <View style={styles.feedbackCard}>
              <CText style={styles.feedbackTitle}>
                {isCorrect
                  ? t("signs.practiceCorrect")
                  : t("signs.practiceIncorrect")}
              </CText>
              {hasPlusAccess ? (
                <CText style={styles.feedbackBody}>
                  {pickLocalized(currentQuestion.explanation, i18n.language)}
                </CText>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    track(ANALYTICS_EVENTS.premiumGateAction.key, {
                      action: "open_paywall",
                      source: "explanation",
                    });
                    openPaywall({ source: "explanation" });
                  }}
                  testID="question-explanation-locked"
                >
                  <CText style={styles.feedbackBody}>
                    {t("monetizationV2.explanationLocked")}
                  </CText>
                </Pressable>
              )}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!hasAnswered}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              !hasAnswered ? styles.primaryButtonDisabled : null,
              hasAnswered && pressed ? styles.pressed : null,
            ]}
          >
            <CText style={styles.primaryButtonLabel}>
              {isLastQuestion ? t("signs.practiceFinish") : t("signs.practiceNext")}
            </CText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

export default withRoadSignsFeature(SignPracticeScreen);

function useStyles({
  accentInk,
  accentSoft,
  safeBottom,
}: {
  accentInk: string;
  accentSoft: string;
  safeBottom: number;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      scroll: {
        flex: 1,
      },
      content: {
        padding: spacing.exact(24),
        paddingBottom: spacing.exact(24) + safeBottom,
        gap: spacing.exact(16),
      },
      progressRow: {
        gap: spacing.exact(4),
      },
      progressLabel: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textMuted,
        textTransform: "uppercase",
      },
      progressName: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
      },
      heroCard: {
        padding: spacing.exact(16),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: spacing.exact(6),
        shadowOffset: { width: 0, height: spacing.exact(2) },
        elevation: 1,
      },
      imageWrap: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: spacing.exact(160),
        borderRadius: radius.lg,
        padding: spacing.exact(16),
        backgroundColor: accentSoft,
      },
      prompt: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
      },
      options: {
        gap: spacing.exact(8),
      },
      option: {
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(16),
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      },
      optionSelected: {
        borderColor: accents.amber.fill,
        backgroundColor: accents.amber.soft,
      },
      optionCorrect: {
        borderColor: accents.green.fill,
        backgroundColor: accents.green.soft,
      },
      optionWrong: {
        borderColor: accents.red.fill,
        backgroundColor: accents.red.soft,
      },
      optionLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textPrimary,
      },
      optionLabelCorrect: {
        color: accents.green.ink,
        fontFamily: getFontFamily("semiBold"),
      },
      optionLabelWrong: {
        color: accents.red.ink,
        fontFamily: getFontFamily("semiBold"),
      },
      feedbackCard: {
        gap: spacing.exact(4),
        padding: spacing.exact(16),
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
      },
      feedbackTitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
      },
      feedbackBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(22),
        color: colors.textSecondary,
      },
      primaryButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(16),
        borderRadius: radius.lg,
        backgroundColor: accentSoft,
      },
      primaryButtonDisabled: {
        opacity: 0.45,
      },
      primaryButtonLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: accentInk,
      },
      resultWrap: {
        flex: 1,
        padding: spacing.exact(24),
        paddingBottom: spacing.exact(24) + safeBottom,
        justifyContent: "space-between",
      },
      resultCard: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(12),
        paddingHorizontal: spacing.exact(16),
      },
      resultIconWrap: {
        width: spacing.exact(72),
        height: spacing.exact(72),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.xxl,
        backgroundColor: accentSoft,
      },
      resultTitle: {
        fontSize: responsiveFont(24),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        color: colors.textPrimary,
        textAlign: "center",
      },
      resultScore: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
        textAlign: "center",
      },
      resultSubtitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(22),
        color: colors.textSecondary,
        textAlign: "center",
      },
      missingState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.exact(24),
      },
      missingTitle: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
        textAlign: "center",
      },
      pressed: {
        opacity: 0.9,
      },
    })
  );
}
