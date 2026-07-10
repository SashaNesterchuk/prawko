import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { Icon } from "../icons";
import { useTheme } from "../../providers/ThemeProvider";
import { getCategoryAccent } from "../../features/road-signs/catalog";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";

type SignListItemProps = {
  sign: RoadSign;
  categoryLabel: string;
  onPress?: () => void;
};

export function SignListItem({ sign, categoryLabel, onPress }: SignListItemProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const accent = theme.accents[getCategoryAccent(sign.categoryId)];
  const styles = useStyles({ thumbBackgroundColor: accent.soft });
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.thumbWrap}>
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

      <Icon
        color={theme.colors.inkMuted}
        name="chevron"
        size={responsiveFont(18)}
      />
    </Pressable>
  );
}

function useStyles({
  thumbBackgroundColor,
}: {
  thumbBackgroundColor: string;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    row: {
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
    thumbWrap: {
      width: spacing.exact(56),
      height: spacing.exact(56),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: thumbBackgroundColor,
      overflow: "hidden",
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
    meta: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
  }));
}
