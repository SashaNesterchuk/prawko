import { StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";
import { resolveTopicReadinessStatus } from "./TopicReadinessCard";

type StatisticsTopicProgressRowProps = {
  title: string;
  seen: number;
  total: number;
  progress: number;
};

export function StatisticsTopicProgressRow({
  title,
  seen,
  total,
  progress,
}: StatisticsTopicProgressRowProps) {
  const normalized = Math.max(0, Math.min(progress, 100));
  const status = resolveTopicReadinessStatus(seen, normalized);
  const barColor =
    status === "good"
      ? greenWaveAccent.green.fill
      : status === "normal"
        ? greenWaveAccent.amber.fill
        : status === "bad"
          ? greenWaveAccent.red.fill
          : greenWave.color.track;

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta}>{`${seen} / ${total}`}</Text>
      </View>

      <View style={styles.barGroup}>
        <View style={styles.track}>
          {seen > 0 ? (
            <View
              style={[
                styles.fill,
                {
                  width: `${normalized}%`,
                  backgroundColor: barColor,
                },
              ]}
            />
          ) : null}
        </View>
        <Text style={styles.percent}>{`${normalized}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 96,
    gap: greenWave.spacing.xs,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: greenWave.color.ink,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  barGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: greenWave.radius.pill,
  },
  percent: {
    width: 40,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
    color: greenWave.color.ink,
  },
});
