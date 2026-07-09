import { StyleSheet, Text, View } from "react-native";

import {
  greenWave,
  greenWaveAccent,
} from "../../theme/green-wave";
import { resolveTopicReadinessStatus } from "./TopicReadinessCard";

type TopicsOverviewCardProps = {
  readiness: number;
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  title?: string;
  answeredLabel?: string;
};

export function TopicsOverviewCard({
  readiness,
  answered,
  total,
  correct,
  wrong,
  title = "Готовність",
  answeredLabel = "Всього відповідей",
}: TopicsOverviewCardProps) {
  const clamped = Math.max(0, Math.min(readiness, 100));
  const status = resolveTopicReadinessStatus(answered, clamped);
  const statusColor =
    status === "not_started"
      ? { fill: greenWave.color.track, ink: greenWave.color.inkMuted }
      : status === "good"
        ? greenWaveAccent.green
        : status === "normal"
          ? greenWaveAccent.amber
          : greenWaveAccent.red;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.readinessValue, { color: statusColor.ink }]}>
          {clamped}%
        </Text>
      </View>

      <View style={styles.track}>
        {answered > 0 ? (
          <View
            style={[
              styles.fill,
              {
                width: `${clamped}%`,
                backgroundColor: statusColor.fill,
              },
            ]}
          />
        ) : null}
      </View>

      <Text style={styles.answersLabel}>{answeredLabel}</Text>
      <Text style={styles.answersValue}>
        {`${answered} / ${total}`}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, styles.statIconGood]}>
            <Text style={styles.statIconLabel}>✓</Text>
          </View>
          <Text style={styles.statValue}>{correct}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, styles.statIconBad]}>
            <Text style={styles.statIconLabel}>✕</Text>
          </View>
          <Text style={styles.statValue}>{wrong}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
    gap: greenWave.spacing.xs,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  readinessValue: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  track: {
    height: 4,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
    overflow: "hidden",
    marginTop: greenWave.spacing.xs,
  },
  fill: {
    height: 4,
    borderRadius: greenWave.radius.pill,
  },
  answersLabel: {
    marginTop: greenWave.spacing.sm,
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  answersValue: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.ink,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.lg,
    marginTop: greenWave.spacing.sm,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  statIcon: {
    width: 18,
    height: 18,
    borderRadius: greenWave.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconGood: {
    backgroundColor: greenWaveAccent.green.soft,
  },
  statIconBad: {
    backgroundColor: greenWaveAccent.red.soft,
  },
  statIconLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: greenWave.color.ink,
  },
  statValue: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.ink,
  },
});
