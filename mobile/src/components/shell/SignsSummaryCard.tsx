import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { DualColorProgressBar } from "./DualColorProgressBar";
import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignsSummaryCardProps = {
  title: string;
  progress: number;
  seen: number;
  total: number;
  correct: number;
  wrong: number;
  correctAnswersLabel: string;
  trainAllLabel: string;
  onTrainAll?: () => void;
};

export function SignsSummaryCard({
  title,
  progress,
  seen,
  total,
  correct,
  wrong,
  correctAnswersLabel,
  trainAllLabel,
  onTrainAll,
}: SignsSummaryCardProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(progress, 100));
  const styles = useStyles();
  const trainLabel = trainAllLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.readiness}>{`${Math.round(clamped)}%`}</Text>
        </View>

        <Text style={styles.coverage}>{`${seen} / ${total}`}</Text>

        <DualColorProgressBar
          correct={correct}
          wrong={wrong}
          total={total}
          height={8}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <Text style={styles.statsLabel}>{correctAnswersLabel}</Text>
          <Text style={styles.statsValue}>{`${correct} / ${seen}`}</Text>
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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.white,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.07,
      shadowRadius: spacing.exact(10),
      shadowOffset: { width: 0, height: spacing.exact(4) },
      elevation: 2,
    },
    topSection: {
      gap: spacing.exact(0),
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
    coverage: {
      marginTop: 0,
      marginBottom: spacing.exact(12),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
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
