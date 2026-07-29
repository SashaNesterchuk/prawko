import { View } from "react-native";

import {
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type DualColorProgressBarProps = {
  correct: number;
  wrong: number;
  total: number;
  height?: number;
};

export function DualColorProgressBar({
  correct,
  wrong,
  total,
  height = 8,
}: DualColorProgressBarProps) {
  const theme = useTheme();
  const safeTotal = Math.max(total, 0);
  const wrongWidth =
    safeTotal > 0
      ? (`${Math.min((wrong / safeTotal) * 100, 100)}%` as PercentageString)
      : ("0%" as PercentageString);
  const correctWidth =
    safeTotal > 0
      ? (`${Math.min((correct / safeTotal) * 100, 100)}%` as PercentageString)
      : ("0%" as PercentageString);
  const styles = useStyles({
    height,
    wrongWidth,
    correctWidth,
    wrongColor: theme.accents.red.fill,
    correctColor: theme.accents.green.fill,
  });

  return (
    <View style={styles.track}>
      {wrong > 0 ? <View style={styles.wrongFill} /> : null}
      {correct > 0 ? <View style={styles.correctFill} /> : null}
    </View>
  );
}

function useStyles({
  height,
  wrongWidth,
  correctWidth,
  wrongColor,
  correctColor,
}: {
  height: number;
  wrongWidth: PercentageString;
  correctWidth: PercentageString;
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
      width: wrongWidth,
      height: "100%",
      backgroundColor: wrongColor,
    },
    correctFill: {
      width: correctWidth,
      height: "100%",
      backgroundColor: correctColor,
    },
  }));
}
