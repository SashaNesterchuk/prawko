import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

export type TopicReadinessStatus = "not_started" | "bad" | "normal" | "good";

type TopicReadinessCardProps = {
  title: string;
  seen: number;
  total: number;
  readiness?: number;
  mistakes?: number;
  correct?: number;
  wrong?: number;
  status?: TopicReadinessStatus;
  onPress?: () => void;
};

const STATUS_COLORS: Record<
  Exclude<TopicReadinessStatus, "not_started">,
  { fill: string; ink: string }
> = {
  bad: { fill: greenWaveAccent.red.fill, ink: greenWaveAccent.red.ink },
  normal: { fill: greenWaveAccent.amber.fill, ink: greenWaveAccent.amber.ink },
  good: { fill: greenWaveAccent.green.fill, ink: greenWaveAccent.green.ink },
};

export function resolveTopicReadinessStatus(
  seen: number,
  readiness: number
): TopicReadinessStatus {
  if (seen <= 0) {
    return "not_started";
  }

  if (readiness >= 85) {
    return "good";
  }

  if (readiness >= 40) {
    return "normal";
  }

  return "bad";
}

export function TopicReadinessCard({
  title,
  seen,
  total,
  readiness,
  mistakes,
  correct,
  wrong,
  status,
  onPress,
}: TopicReadinessCardProps) {
  const normalizedReadiness = Math.max(0, Math.min(readiness ?? 0, 100));
  const resolvedStatus =
    status ?? resolveTopicReadinessStatus(seen, normalizedReadiness);
  const isStarted = resolvedStatus !== "not_started";
  const statusColor = isStarted ? STATUS_COLORS[resolvedStatus] : null;

  const resolvedWrong = wrong ?? mistakes ?? 0;
  const resolvedCorrect = correct ?? Math.max(0, seen - resolvedWrong);

  const body = (
    <View style={styles.inner}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {isStarted && resolvedStatus === "good" ? (
          <View style={styles.readinessGroup}>
            <Text style={styles.readinessLabel}>Готовність</Text>
            <Text style={[styles.readinessValue, { color: statusColor?.ink }]}>
              {normalizedReadiness}%
            </Text>
          </View>
        ) : isStarted ? (
          <Text style={[styles.readinessValue, { color: statusColor?.ink }]}>
            {normalizedReadiness}%
          </Text>
        ) : null}
      </View>

      <View style={styles.track}>
        {isStarted ? (
          <View
            style={[
              styles.fill,
              {
                width: `${normalizedReadiness}%`,
                backgroundColor: statusColor?.fill,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsGroup}>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statGood]}>✓</Text>
            <Text style={styles.footerLabel}>{resolvedCorrect}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statBad]}>✕</Text>
            <Text style={styles.footerLabel}>{resolvedWrong}</Text>
          </View>
        </View>
        <Text style={styles.footerLabel}>{`${seen}/${total}`}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.card}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  inner: {
    flex: 1,
    flexDirection: "column",
    gap: greenWave.spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  readinessGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  readinessLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  readinessValue: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  track: {
    height: 4,
    width: "100%",
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: greenWave.radius.pill,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: greenWave.spacing.sm,
  },
  statsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  statGood: {
    color: greenWaveAccent.green.ink,
  },
  statBad: {
    color: greenWaveAccent.red.ink,
  },
  footerLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
});
