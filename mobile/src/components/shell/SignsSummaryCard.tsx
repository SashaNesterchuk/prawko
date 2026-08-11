import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { DualColorProgressBar } from "./DualColorProgressBar";
import { resolveSignsSummaryDisplay } from "./signs-summary-display";

type SignsSummaryCardProps = {
  title: string;
  /** Completion percent 0–100 (seen / total). Optional override; derived when omitted. */
  progress?: number;
  correct: number;
  wrong: number;
  seen: number;
  total: number;
  correctAnswersLabel: string;
  trainAllLabel: string;
  onTrainAll?: () => void;
};

export function SignsSummaryCard({
  title,
  progress,
  correct,
  wrong,
  seen,
  total,
  correctAnswersLabel,
  trainAllLabel,
  onTrainAll,
}: SignsSummaryCardProps) {
  const theme = useTheme();
  const display = resolveSignsSummaryDisplay({
    correct,
    wrong,
    seen,
    total,
  });
  const learnedPercent =
    progress != null
      ? Math.max(0, Math.min(Math.round(progress), 100))
      : display.learnedPercent;
  const styles = useStyles();
  const trainLabel = trainAllLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <CText style={styles.title}>{title}</CText>
          <CText style={styles.readiness}>{`${learnedPercent}%`}</CText>
        </View>

        <CText style={styles.fraction}>{display.coverageLabel}</CText>

        <DualColorProgressBar
          correct={correct}
          wrong={wrong}
          total={total}
          height={8}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <CText style={styles.statsLabel}>{correctAnswersLabel}</CText>
          <CText style={styles.statsValue}>{display.correctAnswersLabel}</CText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onTrainAll}
          style={({ pressed }) => [
            styles.trainButton,
            pressed ? styles.pressed : null,
          ]}
          testID="signs-train-all"
        >
          <CText style={styles.trainButtonLabel}>{trainLabel}</CText>
          <Icon color={theme.colors.ink2} name="chevron" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function useStyles() {
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
    fraction: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.ink,
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
