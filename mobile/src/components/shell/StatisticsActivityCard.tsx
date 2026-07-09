import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { WeekDayActivity } from "../../features/profile/profile-stats";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

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
                        ? "#ffffff"
                        : greenWaveAccent.amber.fill
                    }
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
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.md,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  metricValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  weekSection: {
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.lg,
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
  dayNumberMuted: {
    color: greenWave.color.inkMuted,
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
