import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { getCategoryAccent } from "../../features/road-signs/catalog";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type SignListItemProps = {
  sign: RoadSign;
  categoryLabel: string;
  onPress?: () => void;
};

export function SignListItem({ sign, categoryLabel, onPress }: SignListItemProps) {
  const { i18n } = useTranslation();
  const accent = greenWaveAccent[getCategoryAccent(sign.categoryId)];
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.thumbWrap, { backgroundColor: accent.soft }]}>
        <SignImage sign={sign} size={44} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {`${sign.code} · ${categoryLabel}`}
        </Text>
      </View>

      <Ionicons color={greenWave.color.inkMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
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
  thumbWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    overflow: "hidden",
  },
  copy: {
    flex: 1,
    gap: greenWave.spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
});
