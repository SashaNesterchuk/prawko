import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  greenWave,
  greenWaveAccent,
  type GreenWaveAccent,
} from "../../theme/green-wave";

type ActionTileProps = {
  title: string;
  subtitle: string;
  accent?: GreenWaveAccent;
  premium?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
};

export function ActionTile({
  title,
  subtitle,
  accent = "green",
  premium = false,
  icon,
  onPress,
}: ActionTileProps) {
  const accentColor = greenWaveAccent[accent];

  const body = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: accentColor.soft }]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {premium ? <PremiumBadge /> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.tile}>{body}</View>;
}

function PremiumBadge() {
  return (
    <View style={styles.badge}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 100,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    overflow: "hidden",
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 100,
    flexDirection: "column",
    gap: greenWave.spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  subtitle: {
    width: "100%",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  badge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xs,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
  },
  lockShackle: {
    width: 8,
    height: 5,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "#ffffff",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: -1,
  },
  lockBody: {
    width: 11,
    height: 7,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
});
