import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { useResponsiveStyles, type PercentageString } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignsSummaryCardProps = {
  title: string;
  readiness: number;
  seen: number;
  total: number;
  totalAnswersLabel: string;
  trainAllLabel: string;
  onTrainAll?: () => void;
};

export function SignsSummaryCard({
  title,
  readiness,
  seen,
  total,
  totalAnswersLabel,
  trainAllLabel,
  onTrainAll,
}: SignsSummaryCardProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(readiness, 100));
  const styles = useStyles({ fillWidth: `${clamped}%` as PercentageString });
  const trainLabel = trainAllLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.readiness}>{`${Math.round(clamped)}%`}</Text>
      </View>

      <View style={styles.track}>
        <View style={styles.fill} />
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <Text style={styles.statsLabel}>{totalAnswersLabel}</Text>
          <Text style={styles.statsValue}>{`${seen} / ${total}`}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onTrainAll}
          style={({ pressed }) => [styles.trainButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.trainButtonLabel}>{trainLabel}</Text>
          <Icon color={theme.colors.ink} name="chevron" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function useStyles({ fillWidth }: { fillWidth: PercentageString }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: spacing.exact(8),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(28),
      lineHeight: responsiveFont(34),
      fontWeight: "700",
      letterSpacing: -0.56,
      color: colors.ink,
    },
    readiness: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      fontWeight: "700",
      color: colors.ink,
    },
    track: {
      height: spacing.exact(6),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: spacing.exact(6),
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    statsCopy: {
      flex: 1,
      gap: spacing.exact(2),
    },
    statsLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    statsValue: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(22),
      fontWeight: "600",
      color: colors.ink,
    },
    trainButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      paddingVertical: spacing.exact(10),
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
    },
    trainButtonLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "600",
      color: colors.ink,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
