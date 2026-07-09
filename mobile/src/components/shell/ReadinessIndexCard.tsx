import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";
import { ProgressRing } from "./ProgressRing";

type ReadinessIndexCardProps = {
  progress: number;
  title: string;
  subtitle: string;
  ringLabel: string;
  detailsLabel?: string;
  ringColor?: string;
  onPress?: () => void;
  onPressDetails?: () => void;
};

export function ReadinessIndexCard({
  progress,
  title,
  subtitle,
  ringLabel,
  detailsLabel,
  ringColor,
  onPress,
  onPressDetails,
}: ReadinessIndexCardProps) {
  const clamped = Math.max(0, Math.min(progress, 100));
  const handlePress = onPress ?? onPressDetails;

  return (
    <Pressable
      accessibilityRole={handlePress ? "button" : undefined}
      disabled={!handlePress}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && handlePress ? styles.pressed : null,
      ]}
    >
      <ProgressRing progress={clamped} color={ringColor}>
        <Text style={styles.ringValue}>{`${Math.round(clamped)}%`}</Text>
        <Text style={styles.ringLabel}>{ringLabel}</Text>
      </ProgressRing>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {detailsLabel ? (
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>{detailsLabel}</Text>
            <View style={styles.chevron} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.lg,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xxl,
    backgroundColor: greenWave.color.surface,
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ringValue: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.64,
    color: greenWave.color.ink,
  },
  ringLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "500",
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  copy: {
    flex: 1,
    flexDirection: "column",
    gap: greenWave.spacing.sm,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkSecondary,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: greenWave.spacing.sm,
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
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: greenWaveAccent.blue.ink,
    transform: [{ rotate: "45deg" }],
  },
});
