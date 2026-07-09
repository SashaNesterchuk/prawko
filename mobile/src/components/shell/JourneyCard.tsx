import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type JourneyCardProps = {
  eyebrow: string;
  title: string;
  sectionLabel: string;
  progress: number;
  nextLabel: string;
  nextValue: string;
  buttonLabel: string;
  onPress?: () => void;
};

export function JourneyCard({
  eyebrow,
  title,
  sectionLabel,
  progress,
  nextLabel,
  nextValue,
  buttonLabel,
  onPress,
}: JourneyCardProps) {
  const clamped = Math.max(0, Math.min(progress, 100));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.headerGradient} />
        <View style={styles.eyebrowRow}>
          <BookIcon />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{sectionLabel}</Text>
          <Text style={styles.metaText}>{`${Math.round(clamped)}%`}</Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${clamped}%` }]} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.nextCopy}>
          <Text style={styles.nextLabel} numberOfLines={1}>
            {nextLabel}
          </Text>
          <Text style={styles.nextValue} numberOfLines={1}>
            {nextValue}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.buttonLabel}>{buttonLabel}</Text>
          <View style={styles.chevron} />
        </Pressable>
      </View>
    </View>
  );
}

function BookIcon() {
  return (
    <View style={styles.bookIcon}>
      <View style={styles.bookPage} />
      <View style={styles.bookPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "column",
    borderRadius: greenWave.radius.xl,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#221f1b",
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: {
    width: "100%",
    flexDirection: "column",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    backgroundColor: greenWaveAccent.green.fill,
    overflow: "hidden",
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: greenWaveAccent.green.ink,
    opacity: 0.38,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  eyebrow: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: "#ffffff",
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.48,
    color: "#ffffff",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: "#ffffff",
    opacity: 0.9,
  },
  track: {
    width: "100%",
    height: 8,
    borderRadius: greenWave.radius.pill,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: greenWave.radius.pill,
    backgroundColor: "#ffffff",
  },
  footer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    padding: greenWave.spacing.lg,
  },
  nextCopy: {
    flex: 1,
    flexDirection: "column",
    gap: greenWave.spacing.xs,
  },
  nextLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  nextValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.ink,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
    paddingLeft: greenWave.spacing.md,
    paddingRight: greenWave.spacing.sm,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWaveAccent.blue.soft,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: greenWaveAccent.blue.ink,
  },
  chevron: {
    width: 7,
    height: 7,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: greenWaveAccent.blue.ink,
    transform: [{ rotate: "45deg" }],
  },
  bookIcon: {
    width: 24,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bookPage: {
    width: 8,
    height: 16,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    borderRadius: 1.5,
  },
});
