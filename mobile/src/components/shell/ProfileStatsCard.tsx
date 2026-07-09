import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import type {
  ProfileStatMetrics,
  WeekDayActivity,
} from "../../features/profile/profile-stats";

type ProfileStatsCardProps = {
  title: string;
  detailsLabel: string;
  metrics: ProfileStatMetrics;
  metricLabels: {
    sessions: string;
    accuracy: string;
    exams: string;
    streak: string;
  };
  weekDays: WeekDayActivity[];
  onPressDetails?: () => void;
};

export function ProfileStatsCard({
  title,
  detailsLabel,
  metrics,
  metricLabels,
  weekDays,
  onPressDetails,
}: ProfileStatsCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const statItems = [
    { key: "sessions", value: String(metrics.sessions), label: metricLabels.sessions },
    {
      key: "accuracy",
      value: `${metrics.accuracy}%`,
      label: metricLabels.accuracy,
    },
    { key: "exams", value: String(metrics.exams), label: metricLabels.exams },
    { key: "streak", value: String(metrics.streak), label: metricLabels.streak },
  ] as const;

  return (
    <View style={styles.card}>
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!onPressDetails}
            onPress={onPressDetails}
            style={({ pressed }) => [
              styles.detailsButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.detailsLabel}>{detailsLabel}</Text>
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
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.weekSection}>
        <View style={styles.weekRow}>
          {weekDays.map((day) => (
            <View
              key={day.isoDate}
              style={[styles.dayCell, day.isToday ? styles.dayCellToday : null]}
            >
              <Text
                style={[styles.weekdayLabel, day.isToday ? styles.dayTextToday : null]}
              >
                {day.weekdayLabel}
              </Text>
              <Text
                style={[styles.dayNumber, day.isToday ? styles.dayTextToday : null]}
              >
                {day.dayOfMonth}
              </Text>
              <View style={styles.dayIconSlot}>
                {day.isToday && day.hasActivity ? (
                  <Ionicons color={theme.colors.white} name="water" size={responsiveFont(12)} />
                ) : day.isStreakDay && !day.isToday ? (
                  <Ionicons
                    color={theme.accents.amber.fill}
                    name="flame"
                    size={responsiveFont(12)}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
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
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    headerSection: {
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    pressed: {
      opacity: 0.7,
    },
    detailsLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
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
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "600",
      letterSpacing: -0.24,
      color: colors.ink,
    },
    metricLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkMuted,
    },
    weekSection: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    weekRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dayCell: {
      alignItems: "center",
      gap: spacing.xs,
      padding: spacing.xs,
      borderRadius: radius.lg,
      minWidth: spacing.exact(32),
    },
    dayCellToday: {
      backgroundColor: colors.inkMuted,
    },
    weekdayLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(12),
      fontWeight: "500",
      color: colors.inkMuted,
    },
    dayNumber: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "500",
      letterSpacing: -0.14,
      color: colors.ink,
    },
    dayTextToday: {
      color: colors.white,
    },
    dayIconSlot: {
      width: spacing.exact(12),
      height: spacing.exact(12),
      alignItems: "center",
      justifyContent: "center",
    },
  }));
}
