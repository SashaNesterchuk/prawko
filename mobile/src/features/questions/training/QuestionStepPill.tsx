import { Pressable, type LayoutChangeEvent, View } from "react-native";

import { CText, useResponsiveStyles } from "../../../portable-ui";

import type { QuestionStepState } from "./visible-steps";

export function QuestionStepPill({
  index,
  onLayout,
  onPress,
  stepState,
  testID,
}: {
  index: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPress?: () => void;
  stepState: QuestionStepState;
  testID?: string;
}) {
  const styles = useQuestionStepPillStyles({ stepState });
  const resolvedTestID = testID ?? `question-step-${index}-${stepState}`;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: stepState === "current" }}
        onLayout={onLayout}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null]}
        testID={resolvedTestID}
      >
        <CText style={styles.label}>{index + 1}</CText>
      </Pressable>
    );
  }

  return (
    <View
      style={styles.pill}
      onLayout={onLayout}
      testID={resolvedTestID}
    >
      <CText style={styles.label}>{index + 1}</CText>
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
              : stepState === "answered"
                ? accents.blue.soft
                : colors.track;

      const labelColor =
        stepState === "upcoming"
          ? colors.textSecondary
          : stepState === "answered"
            ? accents.blue.ink
            : colors.onAccent;

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
          color: labelColor,
        },
        pressed: {
          opacity: 0.88,
        },
      };
    }
  );
}
