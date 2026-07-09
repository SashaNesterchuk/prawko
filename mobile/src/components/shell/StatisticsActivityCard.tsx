import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import type { WeekDayActivity } from "../../features/profile/profile-stats";

type StatisticsActivityCardProps = {
  learningDays: number;
  sessions: number;
  streak: number;
  weekDays: WeekDayActivity[];
  labels: {
    learningDays: string;
    sessions: string;
    streak: string;
  };
};

export function StatisticsActivityCard({
  learningDays,
  sessions,
  streak,
  weekDays,
  labels,
}: StatisticsActivityCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const metrics = [
    { key: "learningDays", value: String(learningDays), label: labels.learningDays },
    { key: "sessions", value: String(sessions), label: labels.sessions },
    { key: "streak", value: String(streak), label: labels.streak },
  ] as const;

  return (
    <View style={styles.card}>
      <View style={styles.metricsRow}>
        {metrics.map((metric) => (
          <View key={metric.key} style={styles.metric}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.weekSection}>
        <View style={styles.weekRow}>
          {weekDays.map((day) => (
            <View
              key={day.isoDate}
              style={[styles.dayCell, day.isToday ? styles.dayCellToday : null]}
            >
              <Text
                style={[
                  styles.weekdayLabel,
                  day.isToday ? styles.dayTextToday : null,
                ]}
              >
                {day.weekdayLabel}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  day.isToday ? styles.dayTextToday : null,
                  !day.isToday && !day.hasActivity && !day.isStreakDay
                    ? styles.dayNumberMuted
                    : null,
                ]}
              >
                {day.dayOfMonth}
              </Text>
              <View style={styles.dayIconSlot}>
                {day.isStreakDay ? (
                  <Ionicons
                    color={
                      day.isToday
                        ? theme.colors.white
                        : theme.accents.amber.fill
                    }
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
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
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
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    metric: {
      flex: 1,
      alignItems: "center",
      gap: spacing.xs,
    },
    metricValue: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.ink,
    },
    metricLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      textAlign: "center",
      color: colors.inkSecondary,
    },
    weekSection: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
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
    dayNumberMuted: {
      color: colors.inkMuted,
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
