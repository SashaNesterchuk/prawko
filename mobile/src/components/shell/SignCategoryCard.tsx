import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Image, Pressable, Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign, RoadSignCategory } from "../../features/road-signs/types";

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
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const accent = theme.accents[category.accent];
  const styles = useStyles({ iconBackgroundColor: accent.soft });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        {previewSign ? (
          <SignImage sign={previewSign} size={36} />
        ) : previewUrl ? (
          <Image resizeMode="contain" source={{ uri: previewUrl }} style={styles.preview} />
        ) : (
          <Ionicons
            color={accent.fill}
            name={category.iconName as ComponentProps<typeof Ionicons>["name"]}
            size={responsiveFont(24)}
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
        <Ionicons
          color={theme.colors.inkMuted}
          name="chevron-forward"
          size={responsiveFont(18)}
        />
      </View>
    </Pressable>
  );
}

function useStyles({
  iconBackgroundColor,
}: {
  iconBackgroundColor: string;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    pressed: {
      opacity: 0.9,
    },
    iconWrap: {
      width: spacing.exact(48),
      height: spacing.exact(48),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: iconBackgroundColor,
      overflow: "hidden",
    },
    preview: {
      width: spacing.exact(36),
      height: spacing.exact(36),
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    subtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    count: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "600",
      color: colors.inkSecondary,
    },
  }));
}
