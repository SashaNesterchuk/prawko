import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../../src/components/shell/GreenWaveScreen";
import {
  getRoadSignById,
  getRoadSignCategory,
  isRoadSignCategoryId,
} from "../../../../src/features/road-signs/catalog";
import {
  buildCategorySignTestQuestions,
  type CategorySignTestQuestion,
} from "../../../../src/features/road-signs/category-test";
import { pickLocalized } from "../../../../src/features/road-signs/content/localized";
import { SignImage } from "../../../../src/features/road-signs/SignImage";
import { greenWave, greenWaveAccent } from "../../../../src/theme/green-wave";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function CategorySignTestScreen() {
  const { t, i18n } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const resolvedCategoryId =
    categoryId && isRoadSignCategoryId(categoryId) ? categoryId : "A";

  const category = useMemo(
    () => getRoadSignCategory(resolvedCategoryId),
    [resolvedCategoryId]
  );

  const questions = useMemo(
    () => buildCategorySignTestQuestions(resolvedCategoryId),
    [resolvedCategoryId]
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const currentQuestion: CategorySignTestQuestion | undefined =
    questions[questionIndex];
  const currentSign = useMemo(
    () =>
      currentQuestion ? getRoadSignById(currentQuestion.signId) : undefined,
    [currentQuestion]
  );

  const hasAnswered = selectedOptionId != null;
  const isCorrect =
    hasAnswered && selectedOptionId === currentQuestion?.correctOptionId;

  const handleSelectOption = (optionId: string) => {
    if (hasAnswered) {
      return;
    }

    setSelectedOptionId(optionId);
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
              style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}
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
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={greenWave.color.ink} name="close" size={22} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{t("signs.signTestTitle")}</Text>
            {category ? (
              <Text style={styles.headerSubtitle}>
                {t(`signs.categories.${category.id}.title`)}
              </Text>
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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 24 + safeBottom },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.imageCard}>
            <SignImage sign={currentSign} size={160} />
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
              color={greenWave.color.inkMuted}
              name="chatbox-ellipses-outline"
              size={16}
            />
            <Text style={styles.reportLabel}>{t("signs.reportProblem")}</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.surface,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
    color: greenWave.color.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  headerCounter: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  pillsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 52,
  },
  pillsRow: {
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.md,
    alignItems: "center",
  },
  pillsRowStatic: {
    flexDirection: "row",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.md,
  },
  pill: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
  },
  pillActive: {
    backgroundColor: greenWave.color.ink,
  },
  pillDone: {
    backgroundColor: greenWave.color.paper,
  },
  pillLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.inkSecondary,
  },
  pillLabelActive: {
    color: greenWave.color.onAccent,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: greenWave.spacing.xl,
    paddingTop: greenWave.spacing.sm,
    gap: greenWave.spacing.md,
    flexGrow: 0,
  },
  imageCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    padding: greenWave.spacing.lg,
  },
  prompt: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  options: {
    gap: greenWave.spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
  },
  optionSelected: {
    borderWidth: 1,
    borderColor: greenWaveAccent.amber.fill,
  },
  optionCorrect: {
    borderWidth: 1,
    borderColor: greenWaveAccent.green.fill,
    backgroundColor: greenWaveAccent.green.soft,
  },
  optionWrong: {
    borderWidth: 1,
    borderColor: greenWaveAccent.red.fill,
    backgroundColor: greenWaveAccent.red.soft,
  },
  optionLetterWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.paper,
  },
  optionLetter: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: greenWave.color.inkSecondary,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: greenWave.color.ink,
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
  continueButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
  },
  continueButtonLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: greenWave.color.onAccent,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: greenWave.spacing.xs,
    paddingVertical: greenWave.spacing.md,
  },
  reportLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: greenWave.color.inkMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xl,
    gap: greenWave.spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  emptyButton: {
    paddingVertical: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.xl,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
  },
  emptyButtonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  pressed: {
    opacity: 0.9,
  },
});
