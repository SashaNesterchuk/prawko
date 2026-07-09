import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type DailyWarmupCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  badgeLabel?: string;
  onPress?: () => void;
};

export function DailyWarmupCard({
  title,
  description,
  buttonLabel,
  badgeLabel,
  onPress,
}: DailyWarmupCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <BoltIcon />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {badgeLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.description}>{description}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      >
        <Text style={styles.buttonLabel}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

function BoltIcon() {
  return (
    <Ionicons
      color={greenWaveAccent.amber.fill}
      name="flash-outline"
      size={24}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "column",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: greenWave.spacing.sm,
  },
  titleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  badge: {
    paddingHorizontal: greenWave.spacing.sm,
    paddingVertical: greenWave.spacing.xs,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.soft,
  },
  badgeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWaveAccent.green.ink,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: greenWave.color.inkSecondary,
  },
  button: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWaveAccent.green.soft,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWaveAccent.green.ink,
  },
});
