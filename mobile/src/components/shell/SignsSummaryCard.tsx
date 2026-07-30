import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import {
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignsSummaryCardProps = {
  title: string;
  /** Mastery percent 0–100 (correct / total). Drives the bar fill. */
  progress: number;
  seen: number;
  total: number;
  totalAnswersLabel: string;
  trainAllLabel: string;
  onTrainAll?: () => void;
};

export function SignsSummaryCard({
  title,
  progress,
  seen,
  total,
  totalAnswersLabel,
  trainAllLabel,
  onTrainAll,
}: SignsSummaryCardProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(progress, 100));
  const styles = useStyles({
    fillWidth: `${clamped}%` as PercentageString,
  });
  const trainLabel = trainAllLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.readiness}>{`${Math.round(clamped)}%`}</Text>
        </View>

        <View style={styles.track}>
          {clamped > 0 ? <View style={styles.fill} /> : null}
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <Text style={styles.statsLabel}>{totalAnswersLabel}</Text>
          <Text style={styles.statsValue}>{`${seen} / ${total}`}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onTrainAll}
          style={({ pressed }) => [
            styles.trainButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.trainButtonLabel}>{trainLabel}</Text>
          <Icon color={theme.colors.ink2} name="chevron" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function useStyles({ fillWidth }: { fillWidth: PercentageString }) {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing }) => ({
    card: {
      borderRadius: radius.xxl,
      backgroundColor: colors.white,
      overflow: "hidden",
      ...elevation.raised,
    },
    topSection: {
      gap: spacing.exact(4),
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.48,
      color: colors.ink,
    },
    readiness: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "600",
      letterSpacing: -0.24,
      color: colors.ink,
    },
    track: {
      height: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.ink3,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    statsCopy: {
      flex: 1,
      gap: spacing.exact(4),
    },
    statsLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink3,
    },
    statsValue: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.ink,
    },
    trainButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
    },
    trainButtonLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.ink2,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
