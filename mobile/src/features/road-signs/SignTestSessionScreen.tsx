import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { QuestionFeedbackBottomSheet } from "../questions/training/QuestionFeedbackBottomSheet";
import {
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { getRoadSignById } from "./catalog";
import type { SignTestQuestion } from "./category-test";
import { pickLocalized } from "./content/localized";
import { SignImage } from "./SignImage";
import { useSignBookmarksStore } from "../../state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";

const OPTION_LETTERS = ["A", "B", "C", "D"];
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
  const styles = useStyles();
  const signImageSize = spacing.exact(160);
  const premiumIconSize = responsiveFont(12);
  const recordAttempt = useSignPracticeProgressStore(
    (state) => state.recordAttempt
  );
  const isSignBookmarked = useSignBookmarksStore((state) => state.isSaved);
  const toggleSignBookmark = useSignBookmarksStore((state) => state.toggleSaved);
  const recordedQuestionIdsRef = useRef<Set<string>>(new Set());

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const currentQuestion: SignTestQuestion | undefined = questions[questionIndex];
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
  const isBookmarked = currentQuestion
    ? isSignBookmarked(currentQuestion.signId)
    : false;

  const handleSelectOption = (optionId: string) => {
    if (hasAnswered || !currentQuestion) {
      return;
    }

    setSelectedOptionId(optionId);

    if (!recordedQuestionIdsRef.current.has(currentQuestion.id)) {
      recordedQuestionIdsRef.current.add(currentQuestion.id);
      recordAttempt({
        signId: currentQuestion.signId,
        correctCount: optionId === currentQuestion.correctOptionId ? 1 : 0,
        totalQuestions: 1,
      });
    }
  };

  const handleContinue = () => {
    if (!hasAnswered) {
      return;
    }

    if (questionIndex >= questions.length - 1) {
      router.back();
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelectedOptionId(null);
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
            <Text style={styles.emptyTitle}>{t("signs.testUnavailable")}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.emptyButtonLabel}>{t("common.back")}</Text>
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

        <View style={styles.header}>
          <NavigationButton
            accessibilityLabel={t("common.close", { defaultValue: "Close" })}
            inset
            onPress={() => router.back()}
            type="close"
          />

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? (
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            ) : null}
          </View>

          <Text style={styles.headerCounter}>
            {`${questionIndex + 1} / ${questions.length}`}
          </Text>
        </View>

        <ScrollView
          horizontal
          style={styles.pillsScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {questions.map((question, index) => {
            const isActive = index === questionIndex;
            const isDone = index < questionIndex;

            return (
              <View
                key={question.id}
                style={[
                  styles.pill,
                  isActive ? styles.pillActive : null,
                  isDone ? styles.pillDone : null,
                ]}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    isActive ? styles.pillLabelActive : null,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.imageCard}>
            <SignImage inset={0} sign={currentSign} size={signImageSize} />
          </View>

          <View style={styles.options}>
            {currentQuestion.options.map((option, index) => {
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
                  <View style={styles.optionLetterWrap}>
                    <Text style={styles.optionLetter}>
                      {OPTION_LETTERS[index] ?? "?"}
                    </Text>
                  </View>
                  <Text style={styles.optionLabel}>
                    {pickLocalized(option.label, i18n.language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      <QuestionFeedbackBottomSheet
        visible={hasAnswered}
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
            : t("question.nextQuestion")
        }
        feedbackAccentFill={feedbackAccent.fill}
        feedbackAccentInk={feedbackAccent.ink}
        feedbackGradientColors={feedbackGradientColors}
        premiumIconSize={premiumIconSize}
        showExplain={false}
        onReportProblem={handleReportProblem}
        onToggleBookmark={handleToggleBookmark}
        onNext={handleContinue}
      />
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
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
      pill: {
        minWidth: spacing.exact(33),
        height: spacing.exact(32),
        paddingHorizontal: spacing.exact(12),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
      },
      pillActive: {
        backgroundColor: colors.ink,
      },
      pillDone: {
        backgroundColor: colors.paper,
      },
      pillLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(24),
        fontWeight: "400",
        color: colors.ink2,
      },
      pillLabelActive: {
        color: colors.white,
      },
      scroll: {
        flex: 1,
      },
      content: {
        flexGrow: 0,
        paddingBottom: spacing.exact(24),
        gap: spacing.exact(12),
      },
      imageCard: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: spacing.exact(220),
        marginHorizontal: 0,
        backgroundColor: colors.white,
        paddingVertical: spacing.exact(39),
      },
      options: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      option: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(12),
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
      },
      optionSelected: {
        borderWidth: 1,
        borderColor: accents.amber.fill,
      },
      optionCorrect: {
        borderWidth: 1,
        borderColor: accents.green.fill,
        backgroundColor: accents.green.soft,
      },
      optionWrong: {
        borderWidth: 1,
        borderColor: accents.red.fill,
        backgroundColor: accents.red.soft,
      },
      optionLetterWrap: {
        width: spacing.exact(24),
        height: spacing.exact(24),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: colors.paper,
      },
      optionLetter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontWeight: "600",
        color: colors.ink2,
      },
      optionLabel: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.ink,
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
