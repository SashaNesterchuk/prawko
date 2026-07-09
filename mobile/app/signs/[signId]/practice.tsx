import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignsScreenHeader } from "../../../src/components/shell/SignsScreenHeader";
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
import { greenWave, greenWaveAccent } from "../../../src/theme/green-wave";

type PracticePhase = "question" | "result";

export default function SignPracticeScreen() {
  const { t, i18n } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
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
  const accent = category ? greenWaveAccent[category.accent] : greenWaveAccent.amber;

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

          <View style={[styles.resultWrap, { paddingBottom: 24 + safeBottom }]}>
            <View style={styles.resultCard}>
              <View style={[styles.resultIconWrap, { backgroundColor: accent.soft }]}>
                <Ionicons color={accent.ink} name="checkmark-circle" size={40} />
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
                { backgroundColor: accent.soft },
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.primaryButtonLabel, { color: accent.ink }]}>
                {t("common.back")}
              </Text>
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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 24 + safeBottom },
          ]}
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
            <View style={[styles.imageWrap, { backgroundColor: accent.soft }]}>
              <SignImage sign={sign} size={120} />
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
              { backgroundColor: accent.soft },
              !hasAnswered ? styles.primaryButtonDisabled : null,
              hasAnswered && pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.primaryButtonLabel, { color: accent.ink }]}>
              {isLastQuestion ? t("signs.practiceFinish") : t("signs.practiceNext")}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.lg,
  },
  progressRow: {
    gap: greenWave.spacing.xs,
  },
  progressLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: greenWave.color.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  progressName: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  heroCard: {
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    borderRadius: greenWave.radius.lg,
    padding: greenWave.spacing.lg,
  },
  prompt: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  options: {
    gap: greenWave.spacing.sm,
  },
  option: {
    paddingVertical: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
    borderWidth: 1,
    borderColor: greenWave.color.line,
  },
  optionSelected: {
    borderColor: greenWaveAccent.amber.fill,
    backgroundColor: greenWaveAccent.amber.soft,
  },
  optionCorrect: {
    borderColor: greenWaveAccent.green.fill,
    backgroundColor: greenWaveAccent.green.soft,
  },
  optionWrong: {
    borderColor: greenWaveAccent.red.fill,
    backgroundColor: greenWaveAccent.red.soft,
  },
  optionLabel: {
    fontSize: 16,
    lineHeight: 24,
    color: greenWave.color.ink,
  },
  optionLabelCorrect: {
    color: greenWaveAccent.green.ink,
    fontWeight: "600",
  },
  optionLabelWrong: {
    color: greenWaveAccent.red.ink,
    fontWeight: "600",
  },
  feedbackCard: {
    gap: greenWave.spacing.xs,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
  },
  feedbackTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  feedbackBody: {
    fontSize: 14,
    lineHeight: 22,
    color: greenWave.color.inkSecondary,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  resultWrap: {
    flex: 1,
    padding: greenWave.spacing.xl,
    justifyContent: "space-between",
  },
  resultCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
  },
  resultIconWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.xxl,
  },
  resultTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  resultScore: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: greenWave.color.inkSecondary,
    textAlign: "center",
  },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xl,
  },
  missingTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.9,
  },
});
