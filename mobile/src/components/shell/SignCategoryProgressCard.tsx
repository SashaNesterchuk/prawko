import { Pressable, StyleSheet, Text, View } from "react-native";

import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign, RoadSignCategory } from "../../features/road-signs/types";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

export type SignCategoryProgress = {
  correct: number;
  wrong: number;
  seen: number;
  total: number;
};

type SignCategoryProgressCardProps = {
  category: RoadSignCategory;
  title: string;
  previewSign?: RoadSign;
  progress: SignCategoryProgress;
  onPress?: () => void;
};

export function SignCategoryProgressCard({
  category,
  title,
  previewSign,
  progress,
  onPress,
}: SignCategoryProgressCardProps) {
  const accent = greenWaveAccent[category.accent];
  const answered = progress.correct + progress.wrong;
  const percent =
    progress.total > 0
      ? Math.round((answered / progress.total) * 100)
      : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(percent, 100)}%`,
                backgroundColor: accent.fill,
              },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statGood]}>✓</Text>
            <Text style={styles.statValue}>{progress.correct}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statBad]}>✕</Text>
            <Text style={styles.statValue}>{progress.wrong}</Text>
          </View>
          <Text style={styles.fraction}>{`${answered} / ${progress.total}`}</Text>
        </View>
      </View>

      {previewSign ? (
        <View style={styles.previewWrap} pointerEvents="none">
          <SignImage sign={previewSign} size={76} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    minHeight: 108,
    paddingVertical: greenWave.spacing.lg,
    paddingLeft: greenWave.spacing.lg,
    paddingRight: 92,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.paper,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.92,
  },
  content: {
    gap: greenWave.spacing.sm,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
    paddingRight: greenWave.spacing.sm,
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
  statsRow: {
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
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  statGood: {
    color: greenWaveAccent.green.ink,
  },
  statBad: {
    color: greenWaveAccent.red.ink,
  },
  statValue: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    color: greenWave.color.inkSecondary,
  },
  fraction: {
    marginLeft: "auto",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    color: greenWave.color.inkSecondary,
  },
  previewWrap: {
    position: "absolute",
    right: greenWave.spacing.md,
    top: 0,
    bottom: 0,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
});
