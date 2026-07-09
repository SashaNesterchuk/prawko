import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type SignsSummaryCardProps = {
  title: string;
  readiness: number;
  seen: number;
  total: number;
  totalAnswersLabel: string;
  trainAllLabel: string;
  onTrainAll?: () => void;
};

export function SignsSummaryCard({
  title,
  readiness,
  seen,
  total,
  totalAnswersLabel,
  trainAllLabel,
  onTrainAll,
}: SignsSummaryCardProps) {
  const clamped = Math.max(0, Math.min(readiness, 100));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.readiness}>{`${Math.round(clamped)}%`}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${clamped}%`, backgroundColor: greenWaveAccent.green.fill },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <Text style={styles.statsLabel}>{totalAnswersLabel}</Text>
          <Text style={styles.statsValue}>{`${seen} / ${total}`}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onTrainAll}
          style={({ pressed }) => [styles.trainButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.trainButtonLabel}>{trainAllLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: greenWave.spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.56,
    color: greenWave.color.ink,
  },
  readiness: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
    color: greenWave.color.ink,
  },
  track: {
    height: 6,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.track,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: greenWave.radius.pill,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: greenWave.spacing.md,
  },
  statsCopy: {
    flex: 1,
    gap: 2,
  },
  statsLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  statsValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  trainButton: {
    paddingVertical: 10,
    paddingHorizontal: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.paper,
  },
  trainButtonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  pressed: {
    opacity: 0.9,
  },
});
