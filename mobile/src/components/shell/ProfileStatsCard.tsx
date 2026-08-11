import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ProfileStatsCardProps = {
  title: string;
  detailsLabel: string;
  metrics: {
    readiness: number;
    coverage: number;
    streak: number;
  };
  metricLabels: {
    readiness: string;
    coverage: string;
    streak: string;
  };
  onPressDetails?: () => void;
};

export function ProfileStatsCard({
  title,
  detailsLabel,
  metrics,
  metricLabels,
  onPressDetails,
}: ProfileStatsCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const statItems = [
    {
      key: "readiness",
      value: `${metrics.readiness}%`,
      label: metricLabels.readiness,
    },
    {
      key: "coverage",
      value: `${metrics.coverage}%`,
      label: metricLabels.coverage,
    },
    {
      key: "streak",
      value: String(metrics.streak),
      label: metricLabels.streak,
    },
  ] as const;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <CText style={styles.title}>{title}</CText>
        <Pressable
          accessibilityRole="button"
          disabled={!onPressDetails}
          onPress={onPressDetails}
          style={({ pressed }) => [
            styles.detailsButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <CText style={styles.detailsLabel}>{detailsLabel}</CText>
          <Ionicons
            color={theme.accents.blue.ink}
            name="chevron-forward"
            size={responsiveFont(20)}
          />
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        {statItems.map((item) => (
          <View key={item.key} style={styles.metric}>
            <CText style={styles.metricValue}>{item.value}</CText>
            <CText style={styles.metricLabel}>{item.label}</CText>
          </View>
        ))}
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      borderRadius: radius.xl,
      backgroundColor: colors.white,
      overflow: "hidden",
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.16,
      color: colors.ink,
    },
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    detailsLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      color: theme.accents.blue.ink,
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    metric: {
      flex: 1,
      alignItems: "center",
      gap: spacing.xs,
    },
    metricValue: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.ink,
    },
    metricLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      textAlign: "center",
      color: colors.inkMuted,
    },
  }));
}
