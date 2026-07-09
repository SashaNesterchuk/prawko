import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  ProfileStatMetrics,
  WeekDayActivity,
} from "../../features/profile/profile-stats";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

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
              color={greenWaveAccent.blue.ink}
              name="chevron-forward"
              size={20}
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
                  <Ionicons color="#ffffff" name="water" size={12} />
                ) : day.isStreakDay && !day.isToday ? (
                  <Ionicons
                    color={greenWaveAccent.amber.fill}
                    name="flame"
                    size={12}
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

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: greenWave.radius.xl,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerSection: {
    paddingTop: greenWave.spacing.lg,
    paddingHorizontal: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: greenWave.spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  detailsLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: greenWaveAccent.blue.ink,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.24,
    color: greenWave.color.ink,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  weekSection: {
    paddingHorizontal: greenWave.spacing.xl,
    paddingVertical: greenWave.spacing.md,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayCell: {
    alignItems: "center",
    gap: greenWave.spacing.xs,
    padding: greenWave.spacing.xs,
    borderRadius: greenWave.radius.lg,
    minWidth: 32,
  },
  dayCellToday: {
    backgroundColor: greenWave.color.inkMuted,
  },
  weekdayLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "500",
    color: greenWave.color.inkMuted,
  },
  dayNumber: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.14,
    color: greenWave.color.ink,
  },
  dayTextToday: {
    color: "#ffffff",
  },
  dayIconSlot: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
