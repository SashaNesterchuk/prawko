import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AD_POLICY } from "@prawko/config";

import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { QuestionChoiceOption } from "../questions/training/QuestionChoiceOption";
import { QuestionFeedbackActions } from "../questions/training/QuestionFeedbackActions";
import { QuestionFeedbackBottomSheet } from "../questions/training/QuestionFeedbackBottomSheet";
import { QuestionFeedbackPushStage } from "../questions/training/QuestionFeedbackPushStage";
import { QuestionStepPill } from "../questions/training/QuestionStepPill";
import { getQuestionStepState } from "../questions/training/visible-steps";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { recordQuestionAnsweredForAds } from "../ads/ad-session-policy";
import { useAdInterstitialActions } from "../ads/show-interstitial";
import { getRoadSignById } from "./catalog";
import type { SignTestQuestion } from "./category-test";
import { pickLocalized } from "./content/localized";
import { SignImage } from "./SignImage";
import { useSignBookmarksStore } from "../../state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";
import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { openSupportEmail } from "../support/support-email";

type SignTestAnswer = {
  isCorrect: boolean;
};

type SignTestSessionScreenProps = {
  questions: SignTestQuestion[];
  title: string;
  subtitle?: string;
};

export function SignTestSessionScreen({
  questions,
  title,
  subtitle,
}: SignTestSessionScreenProps) {
  const { t, i18n } = useTranslation();
  const { track } = useAnalytics();
  const { accents, colors } = useTheme();
  const spacing = useResponsiveSpacing();
  const responsiveFont = useResponsiveFonts().responsiveFont;
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const signImageSize = spacing.exact(160);
  const premiumIconSize = responsiveFont(12);
  const {
    maybeShowInterstitial,
    preloadInterstitial,
    showInterstitialForTrigger,
  } = useAdInterstitialActions();
  const recordAttempt = useSignPracticeProgressStore(
    (state) => state.recordAttempt
  );
  const toggleSignBookmark = useSignBookmarksStore((state) => state.toggleSaved);
  const recordedQuestionIdsRef = useRef<Set<string>>(new Set());
  const questionStartedAtRef = useRef(Date.now());
  const didTrackStartRef = useRef(false);
  const didTrackEndRef = useRef(false);
  const shouldAttemptPracticeAdRef = useRef(false);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, SignTestAnswer>>({});

  const currentQuestion: SignTestQuestion | undefined = questions[questionIndex];
  const currentSignId = currentQuestion?.signId;
  const isBookmarked = useSignBookmarksStore((state) =>
    currentSignId ? Boolean(state.savedSignIds[currentSignId]) : false
  );
  const currentSign = useMemo(
    () =>
      currentQuestion ? getRoadSignById(currentQuestion.signId) : undefined,
    [currentQuestion]
  );

  const hasAnswered = selectedOptionId != null;
  const isCorrect =
    hasAnswered && selectedOptionId === currentQuestion?.correctOptionId;
  const feedbackAccent = isCorrect ? accents.green : accents.red;
  const feedbackGradientColors = [
    feedbackAccent.wash,
    colors.white,
  ] as const;
  const explanationText = currentQuestion?.explanation
    ? pickLocalized(currentQuestion.explanation, i18n.language)
    : null;
  useEffect(() => {
    if (didTrackStartRef.current) {
      return;
    }

    didTrackStartRef.current = true;
    track(ANALYTICS_EVENTS.signTestStarted.key, {
      question_total: questions.length,
    });
  }, [questions.length, track]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [questionIndex]);

  const handleSelectOption = (optionId: string) => {
    if (hasAnswered || !currentQuestion) {
      return;
    }

    const isCorrectAnswer = optionId === currentQuestion.correctOptionId;

    setSelectedOptionId(optionId);
    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: { isCorrect: isCorrectAnswer },
    }));

    if (!recordedQuestionIdsRef.current.has(currentQuestion.id)) {
      recordedQuestionIdsRef.current.add(currentQuestion.id);
      recordAttempt({
        signId: currentQuestion.signId,
        correctCount: isCorrectAnswer ? 1 : 0,
        totalQuestions: 1,
      });
    }

    recordQuestionAnsweredForAds();
    shouldAttemptPracticeAdRef.current = true;
    track(ANALYTICS_EVENTS.signTestQuestionAnswered.key, {
      answer_duration_ms: Math.max(0, Date.now() - questionStartedAtRef.current),
      is_correct: isCorrectAnswer,
      question_id: currentQuestion.id,
      question_index: questionIndex + 1,
      question_total: questions.length,
      sign_id: currentQuestion.signId,
    });
  };

  const handleCloseSession = (input?: {
    outcome?: "abandoned" | "completed";
    shouldAttemptPracticeInterstitial?: boolean;
  }) => {
    const answeredCount = recordedQuestionIdsRef.current.size;
    const shouldAttemptPracticeInterstitial =
      input?.shouldAttemptPracticeInterstitial ??
      shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;
    if (!didTrackEndRef.current) {
      didTrackEndRef.current = true;
      track(ANALYTICS_EVENTS.signTestEnded.key, {
        answered_count: answeredCount,
        correct_count: Object.values(answers).filter((answer) => answer.isCorrect)
          .length,
        outcome: input?.outcome ?? "abandoned",
        question_total: questions.length,
      });
    }

    // Navigate first — never await AdMob on the outgoing screen. The
    // interstitial controller waits for UI idle before native show(), so do
    // not fire from a setTimeout that races the pop animation.
    router.back();

    if (
      shouldAttemptPracticeInterstitial &&
      answeredCount >= AD_POLICY.questionsBetweenInterstitials
    ) {
      void showInterstitialForTrigger("after_question_answer");
      return;
    }

    void showInterstitialForTrigger("after_practice_session_complete", {
      practiceAnsweredCount: answeredCount,
    });
  };

  const handleContinue = () => {
    if (!hasAnswered) {
      return;
    }

    const shouldAttemptPracticeInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;

    if (questionIndex >= questions.length - 1) {
      handleCloseSession({
        outcome: "completed",
        shouldAttemptPracticeInterstitial,
      });
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelectedOptionId(null);

    if (shouldAttemptPracticeInterstitial) {
      maybeShowInterstitial("after_question_answer");
    } else if (
      recordedQuestionIdsRef.current.size >=
      AD_POLICY.questionsBetweenInterstitials - 2
    ) {
      void preloadInterstitial();
    }
  };

  const handleReportProblem = () => {
    if (!currentQuestion) {
      return;
    }

    track(ANALYTICS_EVENTS.questionProblemReportRequested.key, {
      question_id: currentQuestion.id,
      source: "sign_test",
    });
    void openSupportEmail({
      subject: t("signs.reportProblemSubject", {
        signId: currentQuestion.signId,
        defaultValue: `Problem with sign ${currentQuestion.signId}`,
      }),
    });
  };

  const handleToggleBookmark = () => {
    if (!currentQuestion) {
      return;
    }

    const isBookmarkedNext = toggleSignBookmark(currentQuestion.signId);
    track(ANALYTICS_EVENTS.questionBookmarkChanged.key, {
      is_bookmarked: isBookmarkedNext,
      question_id: currentQuestion.id,
      source: "sign_test",
    });
  };

  if (questions.length === 0 || !currentQuestion || !currentSign) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <View style={styles.emptyState}>
            <CText style={styles.emptyTitle}>{t("signs.testUnavailable")}</CText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CText style={styles.emptyButtonLabel}>{t("common.back")}</CText>
            </Pressable>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-sign-test"
      >
        <StatusBar style="dark" />

        <View style={styles.header}>
          <NavigationButton
            accessibilityLabel={t("common.close", { defaultValue: "Close" })}
            inset
            onPress={() => {
              void handleCloseSession();
            }}
            testID="sign-test-close"
            type="close"
          />

          <View style={styles.headerCopy}>
            <CText style={styles.headerTitle}>{title}</CText>
            {subtitle ? (
              <CText style={styles.headerSubtitle}>{subtitle}</CText>
            ) : null}
          </View>

          <CText style={styles.headerCounter} testID="sign-test-counter">
            {`${questionIndex + 1} / ${questions.length}`}
          </CText>
        </View>

        <ScrollView
          horizontal
          style={styles.pillsScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {questions.map((question, index) => (
            <QuestionStepPill
              key={question.id}
              index={index}
              stepState={getQuestionStepState(
                answers[question.id],
                index,
                questionIndex
              )}
            />
          ))}
        </ScrollView>

        <QuestionFeedbackPushStage
          visible={hasAnswered}
          contentBottomInset={insets.bottom + 24}
          contentContainerStyle={styles.content}
          resetKey={currentQuestion?.id}
          feedback={
            <QuestionFeedbackBottomSheet
              visible
              isCorrectAnswer={Boolean(isCorrect)}
              explanationText={explanationText}
              isBookmarked={isBookmarked}
              feedbackAccentFill={feedbackAccent.fill}
              feedbackAccentInk={feedbackAccent.ink}
              feedbackGradientColors={feedbackGradientColors}
              premiumIconSize={premiumIconSize}
              showExplain={false}
              excludeSignId={currentSignId}
              onReportProblem={handleReportProblem}
              onToggleBookmark={handleToggleBookmark}
            />
          }
          feedbackActions={
            <QuestionFeedbackActions
              isCorrectAnswer={Boolean(isCorrect)}
              nextLabel={
                questionIndex >= questions.length - 1
                  ? t("question.finish")
                  : isCorrect
                    ? t("question.nextQuestion")
                    : t("question.gotIt")
              }
              onNext={() => {
                void handleContinue();
              }}
            />
          }
        >
          <View style={styles.imageCard}>
            <SignImage inset={0} sign={currentSign} size={signImageSize} />
          </View>

          <View style={styles.options}>
            {currentQuestion.options.map((option, index) => (
              <QuestionChoiceOption
                key={option.id}
                choice={{
                  id: option.id,
                  label: pickLocalized(option.label, i18n.language),
                }}
                choiceIndex={index}
                hasAnswered={hasAnswered}
                isBooleanQuestion={false}
                isCorrectChoice={option.id === currentQuestion.correctOptionId}
                isSelected={selectedOptionId === option.id}
                onPress={() => handleSelectOption(option.id)}
                testID={`sign-test-option-index-${index}`}
              />
            ))}
          </View>
        </QuestionFeedbackPushStage>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(16),
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      headerCopy: {
        flex: 1,
        gap: 0,
      },
      headerTitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      headerSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.ink3,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.ink2,
      },
      pillsScroll: {
        flexGrow: 0,
        flexShrink: 0,
        maxHeight: spacing.exact(44),
      },
      pillsRow: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(12),
        alignItems: "center",
      },
      scroll: {
        flex: 1,
      },
      content: {
        flexGrow: 0,
        gap: spacing.exact(12),
      },
      imageCard: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: spacing.exact(220),
        marginHorizontal: 0,
        paddingVertical: spacing.exact(39),
      },
      options: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.exact(24),
        gap: spacing.exact(16),
      },
      emptyTitle: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
        textAlign: "center",
      },
      emptyButton: {
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(24),
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
      },
      emptyButtonLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
      },
      pressed: {
        opacity: 0.9,
      },
    })
  );
}
