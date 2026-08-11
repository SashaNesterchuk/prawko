import { Pressable, View } from "react-native";

import { Icon } from "../../../components/icons";
import { CText, getFontFamily, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

type QuestionChoice = {
  id: string;
  label: string;
};

export function QuestionChoiceOption({
  choice,
  choiceIndex,
  hasAnswered,
  isBooleanQuestion,
  isCorrectChoice,
  isSelected,
  onPress,
  testID,
}: {
  choice: QuestionChoice;
  choiceIndex: number;
  hasAnswered: boolean;
  isBooleanQuestion: boolean;
  isCorrectChoice: boolean;
  isSelected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { accents, colors } = useTheme();
  const revealCorrect = hasAnswered && isCorrectChoice;
  const revealWrong = hasAnswered && isSelected && !isCorrectChoice;
  const filled = (isSelected && isCorrectChoice) || revealWrong;
  const styles = useQuestionChoiceStyles({
    dimmed: hasAnswered && !isSelected && !isCorrectChoice,
    filled,
    isBooleanQuestion,
    isCorrectChoice,
    revealCorrect,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={choice.label}
      disabled={hasAnswered}
      onPress={onPress}
      style={styles.container}
      testID={testID ?? `question-choice-index-${choiceIndex}`}
    >
      {!isBooleanQuestion ? (
        revealCorrect || revealWrong ? (
          <Icon
            name={revealCorrect ? "check" : "close"}
            size={24}
            color={filled ? colors.onAccent : accents.green.fill}
          />
        ) : (
          <View style={styles.badge}>
            <CText style={styles.badgeText}>
              {String.fromCharCode(65 + choiceIndex)}
            </CText>
          </View>
        )
      ) : null}
      <CText style={styles.label}>{choice.label}</CText>
    </Pressable>
  );
}

function useQuestionChoiceStyles({
  dimmed,
  filled,
  isBooleanQuestion,
  isCorrectChoice,
  revealCorrect,
}: {
  dimmed: boolean;
  filled: boolean;
  isBooleanQuestion: boolean;
  isCorrectChoice: boolean;
  revealCorrect: boolean;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => {
      const fillColor = isCorrectChoice ? accents.green.fill : accents.red.fill;
      const labelColor = filled
        ? colors.onAccent
        : revealCorrect
          ? accents.green.ink
          : colors.textPrimary;

      return {
        container: {
          ...(isBooleanQuestion
            ? {
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.exact(12),
                paddingVertical: spacing.exact(24),
              }
            : {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.exact(12),
                padding: spacing.exact(12),
              }),
          borderRadius: spacing.exact(12),
          backgroundColor: filled ? fillColor : colors.surface,
          borderWidth: revealCorrect && !filled ? 2 : 0,
          borderColor:
            revealCorrect && !filled ? accents.green.fill : colors.transparent,
          opacity: dimmed ? 0.4 : 1,
        },
        badge: {
          width: spacing.exact(24),
          height: spacing.exact(24),
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: colors.line,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: {
          fontSize: responsiveFont(12),
          lineHeight: responsiveFont(16),
          fontFamily: getFontFamily("semiBold"),
          color: colors.textMuted,
        },
        label: {
          ...(isBooleanQuestion
            ? {
                fontSize: responsiveFont(14),
                lineHeight: responsiveFont(20),
                textAlign: "center",
              }
            : {
                flex: 1,
                fontSize: responsiveFont(14),
                lineHeight: responsiveFont(20),
              }),
          color: labelColor,
          fontFamily: getFontFamily(filled || revealCorrect ? "semiBold" : "regular"),
        },
      };
    }
  );
}
