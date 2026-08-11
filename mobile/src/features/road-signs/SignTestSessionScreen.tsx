import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { QuestionChoiceOption } from "../questions/training/QuestionChoiceOption";
import { QuestionFeedbackBottomSheet } from "../questions/training/QuestionFeedbackBottomSheet";
import { QuestionFeedbackPushStage } from "../questions/training/QuestionFeedbackPushStage";
import { QuestionStepPill } from "../questions/training/QuestionStepPill";
import { getQuestionStepState } from "../questions/training/visible-steps";
import {
  CText,
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

type SignTestAnswer = {
  isCorrect: boolean;
};

const SUPPORT_EMAIL = "support@prawko.app";

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
  const correctChoiceBullets =
    hasAnswered && !isCorrect && currentQuestion
      ? currentQuestion.options
          .filter((option) => option.id === currentQuestion.correctOptionId)
          .map((option) => pickLocalized(option.label, i18n.language))
      : [];

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
  };

  const handleCloseSession = (input?: {
    shouldAttemptPracticeInterstitial?: boolean;
  }) => {
    const answeredCount = recordedQuestionIdsRef.current.size;
    const shouldAttemptPracticeInterstitial =
      input?.shouldAttemptPracticeInterstitial ??
      shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;

    // Navigate first — never await AdMob on the outgoing screen (same as
    // question training exit / opposite of the old freeze on TestFlight).
    router.back();

    setTimeout(() => {
      if (shouldAttemptPracticeInterstitial && answeredCount >= 12) {
        void showInterstitialForTrigger("after_question_answer");
        return;
      }

      void showInterstitialForTrigger("after_practice_session_complete", {
        practiceAnsweredCount: answeredCount,
      });
    }, 400);
  };

  const handleContinue = () => {
    if (!hasAnswered) {
      return;
    }

    const shouldAttemptPracticeInterstitial = shouldAttemptPracticeAdRef.current;
    shouldAttemptPracticeAdRef.current = false;

    if (questionIndex >= questions.length - 1) {
      if (shouldAttemptPracticeInterstitial) {
        handleCloseSession({ shouldAttemptPracticeInterstitial });
      } else {
        router.back();
      }
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelectedOptionId(null);

    if (shouldAttemptPracticeInterstitial) {
      maybeShowInterstitial("after_question_answer");
    } else if (recordedQuestionIdsRef.current.size >= 10) {
      void preloadInterstitial();
    }
  };

  const handleReportProblem = () => {
    if (!currentQuestion) {
      return;
    }

    const subject = t("signs.reportProblemSubject", {
      signId: currentQuestion.signId,
      defaultValue: `Problem with sign ${currentQuestion.signId}`,
    });
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    );
  };

  const handleToggleBookmark = () => {
    if (!currentQuestion) {
      return;
    }

    toggleSignBookmark(currentQuestion.signId);
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
            type="close"
          />

          <View style={styles.headerCopy}>
            <CText style={styles.headerTitle}>{title}</CText>
            {subtitle ? (
              <CText style={styles.headerSubtitle}>{subtitle}</CText>
            ) : null}
          </View>

          <CText style={styles.headerCounter}>
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
          feedback={
            <QuestionFeedbackBottomSheet
              visible
              isCorrectAnswer={Boolean(isCorrect)}
              explanationText={explanationText}
              correctChoiceBullets={correctChoiceBullets}
              showMasteryProgress={false}
              masteryCurrent={0}
              masteryTarget={0}
              isBookmarked={isBookmarked}
              nextLabel={
                questionIndex >= questions.length - 1
                  ? t("question.finish")
                  : isCorrect
                    ? t("question.nextQuestion")
                    : t("question.gotIt")
              }
              feedbackAccentFill={feedbackAccent.fill}
              feedbackAccentInk={feedbackAccent.ink}
              feedbackGradientColors={feedbackGradientColors}
              premiumIconSize={premiumIconSize}
              showExplain={false}
              onReportProblem={handleReportProblem}
              onToggleBookmark={handleToggleBookmark}
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
        fontWeight: "400",
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
        fontWeight: "600",
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
        fontWeight: "600",
        color: colors.textPrimary,
      },
      pressed: {
        opacity: 0.9,
      },
    })
  );
}
