import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign, RoadSignCategory } from "../../features/road-signs/types";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type SignCategoryCardProps = {
  category: RoadSignCategory;
  previewSign?: RoadSign;
  previewUrl?: string;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
};

export function SignCategoryCard({
  category,
  previewSign,
  previewUrl,
  title,
  subtitle,
  onPress,
}: SignCategoryCardProps) {
  const accent = greenWaveAccent[category.accent];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent.soft }]}>
        {previewSign ? (
          <SignImage sign={previewSign} size={36} />
        ) : previewUrl ? (
          <Image resizeMode="contain" source={{ uri: previewUrl }} style={styles.preview} />
        ) : (
          <Ionicons
            color={accent.fill}
            name={category.iconName as ComponentProps<typeof Ionicons>["name"]}
            size={24}
          />
        )}
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {title ?? category.titlePl}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle ?? category.subtitlePl}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.count}>{category.count}</Text>
        <Ionicons color={greenWave.color.inkMuted} name="chevron-forward" size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    overflow: "hidden",
  },
  preview: {
    width: 36,
    height: 36,
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
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
  },
  count: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.inkSecondary,
  },
});
