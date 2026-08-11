import { View } from "react-native";

import {
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";

type MonoProgressBarProps = {
  /** Fill percent 0–100 (learned / coverage). */
  progress: number;
  height?: number;
};

/** Single gray progress track for learned/coverage (Signs home). */
export function MonoProgressBar({
  progress,
  height = 8,
}: MonoProgressBarProps) {
  const normalized = Math.max(0, Math.min(Math.round(progress), 100));
  const styles = useStyles({
    height,
    fillWidth: `${normalized}%` as PercentageString,
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: normalized,
      }}
      style={styles.track}
    >
      {normalized > 0 ? <View style={styles.fill} /> : null}
    </View>
  );
}

function useStyles({
  height,
  fillWidth,
}: {
  height: number;
  fillWidth: PercentageString;
}) {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    track: {
      width: "100%",
      height: spacing.exact(height),
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.ink2,
    },
  }));
}
