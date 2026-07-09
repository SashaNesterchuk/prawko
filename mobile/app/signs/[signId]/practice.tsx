import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignsScreenHeader } from "../../../src/components/shell/SignsScreenHeader";
import {
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

type PracticePhase = "question" | "result";

export default function SignPracticeScreen() {
  const { t, i18n } = useTranslation();
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

  const currentQuestion: SignPractice | undefined = practices[questionIndex];
  const isLastQuestion = questionIndex >= practices.length - 1;
  const hasAnswered = selectedOptionId != null;
  const isCorrect =
    hasAnswered && selectedOptionId === currentQuestion?.correctOptionId;

  const displayName = sign
    ? getSignDisplayName(sign.id, i18n.language, sign.code)
    : t("signs.title");

  const handleSelectOption = (optionId: string) => {
    if (hasAnswered || !currentQuestion) {
      return;
    }

    setSelectedOptionId(optionId);

    if (optionId === currentQuestion.correctOptionId) {
      setCorrectCount((value) => value + 1);
    }
  };

  const handleContinue = () => {
    if (!hasAnswered) {
      return;
    }

    if (isLastQuestion) {
      setPhase("result");
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelectedOptionId(null);
  };

  if (!sign || practices.length === 0 || !currentQuestion) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <SignsScreenHeader
            title={t("signs.practiceTitle")}
            backLabel={t("common.back")}
            onBack={() => router.back()}
          />
          <View style={styles.missingState}>
            <Text style={styles.missingTitle}>{t("signs.notFoundTitle")}</Text>
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
          <SignsScreenHeader
            title={t("signs.practiceTitle")}
            backLabel={t("common.back")}
            onBack={() => router.back()}
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
              <Text style={styles.resultTitle}>{t("signs.practiceComplete")}</Text>
              <Text style={styles.resultScore}>
                {t("signs.practiceScore", {
                  correct: correctCount,
                  total: practices.length,
                })}
              </Text>
              <Text style={styles.resultSubtitle}>{displayName}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>{t("common.back")}</Text>
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
        <SignsScreenHeader
          title={t("signs.practiceTitle")}
          backLabel={t("common.back")}
          onBack={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {t("signs.practiceProgress", {
                current: questionIndex + 1,
                total: practices.length,
              })}
            </Text>
            <Text style={styles.progressName} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.imageWrap}>
              <SignImage sign={sign} size={signImageSize} />
            </View>
          </View>

          <Text style={styles.prompt}>
            {pickLocalized(currentQuestion.prompt, i18n.language)}
          </Text>

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
                  <Text
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
            <Text style={styles.primaryButtonLabel}>
              {isLastQuestion ? t("signs.practiceFinish") : t("signs.practiceNext")}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

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
        fontWeight: "600",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      },
      progressName: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
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
        fontWeight: "600",
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
        fontWeight: "600",
      },
      optionLabelWrong: {
        color: accents.red.ink,
        fontWeight: "600",
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
        fontWeight: "600",
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
        fontWeight: "700",
        color: colors.textPrimary,
        textAlign: "center",
      },
      resultScore: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
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
        fontWeight: "600",
        color: colors.textPrimary,
        textAlign: "center",
      },
      pressed: {
        opacity: 0.9,
      },
    })
  );
}
