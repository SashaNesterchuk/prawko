import { Text, View } from "react-native";

import { useResponsiveStyles } from "../../../portable-ui";

import type { QuestionStepState } from "./visible-steps";

export function QuestionStepPill({
  index,
  stepState,
}: {
  index: number;
  stepState: QuestionStepState;
}) {
  const styles = useQuestionStepPillStyles({ stepState });

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{index + 1}</Text>
    </View>
  );
}

function useQuestionStepPillStyles({
  stepState,
}: {
  stepState: QuestionStepState;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => {
      const backgroundColor =
        stepState === "correct"
          ? accents.green.fill
          : stepState === "wrong"
            ? accents.red.fill
            : stepState === "current"
              ? colors.textPrimary
              : colors.track;

      return {
        pill: {
          minWidth: spacing.exact(36),
          height: spacing.exact(32),
          paddingHorizontal: spacing.exact(12),
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
        },
        label: {
          fontSize: responsiveFont(16),
          lineHeight: responsiveFont(24),
          color:
            stepState === "upcoming" ? colors.textSecondary : colors.onAccent,
        },
      };
    }
  );
}
