import { Pressable, Text, View } from "react-native";

import { IconPlaceholder } from "../../../components/shell/IconPlaceholder";
import { useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

type QuestionChoice = {
  id: string;
  label: string;
};

export function QuestionChoiceOption({
  choice,
  hasAnswered,
  isBooleanQuestion,
  isCorrectChoice,
  isSelected,
  onPress,
}: {
  choice: QuestionChoice;
  hasAnswered: boolean;
  isBooleanQuestion: boolean;
  isCorrectChoice: boolean;
  isSelected: boolean;
  onPress: () => void;
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
    >
      {!isBooleanQuestion ? (
        revealCorrect || revealWrong ? (
          <IconPlaceholder
            color={filled ? colors.onAccent : accents.green.fill}
          />
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{choice.id.toUpperCase()}</Text>
          </View>
        )
      ) : null}
      <Text style={styles.label}>{choice.label}</Text>
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
          fontWeight: "600",
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
          fontWeight: filled || revealCorrect ? "600" : "400",
        },
      };
    }
  );
}
