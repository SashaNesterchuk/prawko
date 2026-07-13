import { View } from "react-native";

import { useResponsiveStyles, type PercentageString } from "../../portable-ui";

type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const normalized = Math.max(0, Math.min(progress, 100));
  const styles = useStyles({ fillWidth: `${normalized}%` as PercentageString });

  return (
    <View style={styles.track}>
      <View style={styles.fill} />
    </View>
  );
}

function useStyles({ fillWidth }: { fillWidth: PercentageString }) {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    track: {
      height: spacing.exact(10),
      borderRadius: radius.pill,
      backgroundColor: colors.cardMuted,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
  }));
}
