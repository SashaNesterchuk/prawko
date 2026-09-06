import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { resolveDualColorProgressSegments } from "./dual-color-progress";

const FILL_DURATION_MS = 700;
const FILL_EASING = Easing.out(Easing.cubic);

type DualColorProgressBarProps = {
  correct: number;
  wrong: number;
  total: number;
  height?: number;
  /** Fill from the previous width (or empty) when counts change. */
  animated?: boolean;
};

export function DualColorProgressBar({
  correct,
  wrong,
  total,
  height = 8,
  animated = true,
}: DualColorProgressBarProps) {
  const theme = useTheme();
  const { wrongPercent, correctPercent, filledPercent, accessibilityText } =
    resolveDualColorProgressSegments({ correct, wrong, total });
  const trackWidth = useSharedValue(0);
  const wrongFraction = useSharedValue(0);
  const correctFraction = useSharedValue(0);
  const styles = useStyles({
    height,
    wrongColor: theme.accents.red.fill,
    correctColor: theme.accents.green.fill,
  });

  useEffect(() => {
    const nextWrong = wrongPercent / 100;
    const nextCorrect = correctPercent / 100;

    if (!animated) {
      wrongFraction.value = nextWrong;
      correctFraction.value = nextCorrect;
      return;
    }

    wrongFraction.value = withTiming(nextWrong, {
      duration: FILL_DURATION_MS,
      easing: FILL_EASING,
    });
    correctFraction.value = withTiming(nextCorrect, {
      duration: FILL_DURATION_MS,
      easing: FILL_EASING,
    });
  }, [
    animated,
    correctFraction,
    correctPercent,
    wrongFraction,
    wrongPercent,
  ]);

  const wrongFillStyle = useAnimatedStyle(() => ({
    width: trackWidth.value * wrongFraction.value,
  }));
  const correctFillStyle = useAnimatedStyle(() => ({
    width: trackWidth.value * correctFraction.value,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(filledPercent),
        text: accessibilityText,
      }}
      onLayout={(event) => {
        trackWidth.value = event.nativeEvent.layout.width;
      }}
      style={styles.track}
    >
      <Animated.View style={[styles.wrongFill, wrongFillStyle]} />
      <Animated.View style={[styles.correctFill, correctFillStyle]} />
    </View>
  );
}

function useStyles({
  height,
  wrongColor,
  correctColor,
}: {
  height: number;
  wrongColor: string;
  correctColor: string;
}) {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    track: {
      width: "100%",
      height: spacing.exact(height),
      flexDirection: "row",
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
      overflow: "hidden",
    },
    wrongFill: {
      width: 0,
      height: "100%",
      backgroundColor: wrongColor,
    },
    correctFill: {
      width: 0,
      height: "100%",
      backgroundColor: correctColor,
    },
  }));
}
