import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { AppButton } from "../../../components/shell/AppButton";
import { CText, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

type QuestionFeedbackActionsProps = {
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  isCorrectAnswer: boolean;
  /**
   * Training uses a single primary CTA. Exam answer review uses Previous/Next
   * ghost controls as in Figma exam-answers frames.
   */
  navigationMode?: "next" | "previousNext";
  nextLabel: string;
  nextTestID?: string;
  previousLabel?: string;
  previousTestID?: string;
  onNext: () => void;
  onPrevious?: () => void;
};

/**
 * Controls that stay pinned over the feedback panel while the question and the
 * explanation scroll underneath them.
 */
export function QuestionFeedbackActions({
  canGoNext = true,
  canGoPrevious = false,
  isCorrectAnswer,
  navigationMode = "next",
  nextLabel,
  nextTestID,
  previousLabel,
  previousTestID,
  onNext,
  onPrevious,
}: QuestionFeedbackActionsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();

  if (navigationMode === "next") {
    return (
      <AppButton
        label={nextLabel}
        onPress={onNext}
        testID={nextTestID ?? "question-feedback-next"}
        variant={isCorrectAnswer ? "primary" : "danger"}
      />
    );
  }

  const resolvedPreviousLabel = previousLabel ?? t("question.previousShort");

  return (
    <View style={styles.navRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGoPrevious }}
        disabled={!canGoPrevious}
        onPress={onPrevious}
        testID={previousTestID}
        style={({ pressed }) => [
          styles.navButton,
          !canGoPrevious ? styles.navButtonDisabled : null,
          pressed && canGoPrevious ? styles.navButtonPressed : null,
        ]}
      >
        <Icon name="back" size={20} color={colors.ink2} />
        <CText style={styles.navButtonText}>{resolvedPreviousLabel}</CText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={onNext}
        style={({ pressed }) => [
          styles.navButton,
          !canGoNext ? styles.navButtonDisabled : null,
          pressed && canGoNext ? styles.navButtonPressed : null,
        ]}
        testID={nextTestID ?? "question-feedback-next"}
      >
        <CText style={styles.navButtonText}>{nextLabel}</CText>
        <Icon name="chevron" size={20} color={colors.ink2} />
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
    },
    navButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(8),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(12),
      minHeight: spacing.exact(48),
    },
    navButtonDisabled: {
      opacity: 0.2,
    },
    navButtonPressed: {
      opacity: 0.85,
    },
    navButtonText: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.ink2,
    },
  }));
}
