import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";
import { greenWave } from "../../theme/green-wave";

type SignGridItemProps = {
  sign: RoadSign;
  onPress?: () => void;
};

export function SignGridItem({ sign, onPress }: SignGridItemProps) {
  const { i18n } = useTranslation();
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
    >
      <SignImage sign={sign} size={72} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={styles.code} numberOfLines={1}>
          {sign.code}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 96,
    alignItems: "center",
    gap: greenWave.spacing.sm,
    padding: greenWave.spacing.md,
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
  copy: {
    width: "100%",
    alignItems: "center",
    gap: 2,
  },
  title: {
    width: "100%",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
  code: {
    width: "100%",
    fontSize: 11,
    lineHeight: 14,
    color: greenWave.color.inkMuted,
    textAlign: "center",
  },
});
