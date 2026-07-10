import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
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
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";

const OPTION_LETTERS = ["A", "B", "C", "D"];

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
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const spacing = useResponsiveSpacing();
  const styles = useStyles({ safeBottom });
  const closeIconSize = responsiveFont(22);
  const reportIconSize = responsiveFont(16);
  const signImageSize = spacing.exact(160);
  const recordAttempt = useSignPracticeProgressStore(
    (state) => state.recordAttempt
  );
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

  const prompt =
    currentQuestion.prompt != null
      ? pickLocalized(currentQuestion.prompt, i18n.language)
      : t("signs.testDefaultPrompt");

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={closeIconSize} />
          </Pressable>

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

        {questions.length > 6 ? (
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
        ) : (
          <View style={styles.pillsRowStatic}>
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
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.imageCard}>
            <SignImage sign={currentSign} size={signImageSize} />
          </View>

          <Text style={styles.prompt}>{prompt}</Text>

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

          {hasAnswered && currentQuestion.explanation ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>
                {isCorrect
                  ? t("signs.practiceCorrect")
                  : t("signs.practiceIncorrect")}
              </Text>
              <Text style={styles.feedbackBody}>
                {pickLocalized(currentQuestion.explanation, i18n.language)}
              </Text>
            </View>
          ) : null}

          {hasAnswered ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.continueButtonLabel}>
                {questionIndex >= questions.length - 1
                  ? t("signs.practiceFinish")
                  : t("signs.practiceNext")}
              </Text>
            </Pressable>
          ) : null}

          <Pressable accessibilityRole="button" style={styles.reportRow}>
            <Ionicons
              color={colors.textMuted}
              name="chatbox-ellipses-outline"
              size={reportIconSize}
            />
            <Text style={styles.reportLabel}>{t("signs.reportProblem")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      closeButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        backgroundColor: colors.surface,
      },
      headerCopy: {
        flex: 1,
        gap: spacing.exact(2),
      },
      headerTitle: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontWeight: "700",
        color: colors.textPrimary,
      },
      headerSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
      pillsScroll: {
        flexGrow: 0,
        flexShrink: 0,
        maxHeight: spacing.exact(52),
      },
      pillsRow: {
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingBottom: spacing.exact(12),
        alignItems: "center",
      },
      pillsRowStatic: {
        flexDirection: "row",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingBottom: spacing.exact(12),
      },
      pill: {
        width: spacing.exact(36),
        height: spacing.exact(36),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
      },
      pillActive: {
        backgroundColor: colors.textPrimary,
      },
      pillDone: {
        backgroundColor: colors.paper,
      },
      pillLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "600",
        color: colors.textSecondary,
      },
      pillLabelActive: {
        color: colors.onAccent,
      },
      scroll: {
        flex: 1,
      },
      content: {
        flexGrow: 0,
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(24) + safeBottom,
        gap: spacing.exact(12),
      },
      imageCard: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: spacing.exact(180),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        padding: spacing.exact(16),
      },
      prompt: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        color: colors.textPrimary,
        textAlign: "center",
      },
      options: {
        gap: spacing.exact(8),
      },
      option: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(16),
        borderRadius: radius.xl,
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
        width: spacing.exact(28),
        height: spacing.exact(28),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: colors.paper,
      },
      optionLetter: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "700",
        color: colors.textSecondary,
      },
      optionLabel: {
        flex: 1,
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textPrimary,
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
        fontWeight: "600",
        color: colors.textPrimary,
      },
      feedbackBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(22),
        color: colors.textSecondary,
      },
      continueButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.exact(12),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
      },
      continueButtonLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        color: colors.onAccent,
      },
      reportRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(4),
        paddingVertical: spacing.exact(12),
      },
      reportLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textMuted,
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
