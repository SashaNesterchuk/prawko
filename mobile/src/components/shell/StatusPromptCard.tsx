import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type StatusPromptCardProps = {
  eyebrow: string;
  title: string;
  onPress?: () => void;
};

const ACCENT = greenWaveAccent.amber;

export function StatusPromptCard({
  eyebrow,
  title,
  onPress,
}: StatusPromptCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconBox}>
        <CalendarIcon />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.trailing}>
        <View style={styles.chevron} />
      </View>
    </Pressable>
  );
}

function CalendarIcon() {
  return (
    <View style={styles.icon}>
      <View style={styles.calBody} />
      <View style={styles.calHeader} />
      <View style={[styles.calLeg, { left: 6 }]} />
      <View style={[styles.calLeg, { right: 6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    borderWidth: 2,
    borderColor: ACCENT.fill,
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.paper,
  },
  copy: {
    flex: 1,
    flexDirection: "column",
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  trailing: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
  },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: ACCENT.ink,
    transform: [{ rotate: "45deg" }],
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  calBody: {
    width: 18,
    height: 15,
    borderWidth: 2,
    borderColor: ACCENT.ink,
    borderRadius: 3,
  },
  calHeader: {
    position: "absolute",
    top: 4,
    width: 18,
    height: 4,
    backgroundColor: ACCENT.ink,
  },
  calLeg: {
    position: "absolute",
    top: 1,
    width: 2,
    height: 4,
    borderRadius: 1,
    backgroundColor: ACCENT.ink,
  },
});
