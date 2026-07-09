import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type SignCatalogCardProps = {
  sign: RoadSign;
  showWrongBadge?: boolean;
  onPress?: () => void;
};

export function SignCatalogCard({
  sign,
  showWrongBadge = false,
  onPress,
}: SignCatalogCardProps) {
  const { i18n } = useTranslation();
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.topRow}>
        <Text style={styles.code}>{sign.code}</Text>
        <View style={styles.topActions}>
          {showWrongBadge ? (
            <View style={styles.wrongBadge}>
              <Ionicons color={greenWaveAccent.red.ink} name="close" size={12} />
            </View>
          ) : null}
          <Ionicons color={greenWave.color.inkMuted} name="bookmark-outline" size={18} />
        </View>
      </View>

      <View style={styles.imageWrap}>
        <SignImage sign={sign} size={120} />
      </View>

      <Text style={styles.name} numberOfLines={3}>
        {displayName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
    opacity: 0.92,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  code: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.inkMuted,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  wrongBadge: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.red.soft,
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  name: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: greenWave.color.ink,
    textAlign: "center",
  },
});
