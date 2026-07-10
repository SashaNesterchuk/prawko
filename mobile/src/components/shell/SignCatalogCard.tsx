import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "../icons";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";

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
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
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
              <Icon color={theme.accents.red.ink} name="close" size={responsiveFont(12)} />
            </View>
          ) : null}
          <Icon color={theme.colors.inkMuted} name="star" size={responsiveFont(18)} />
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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
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
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "600",
      color: colors.inkMuted,
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    wrongBadge: {
      width: spacing.exact(22),
      height: spacing.exact(22),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: theme.accents.red.soft,
    },
    imageWrap: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(140),
    },
    name: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: colors.ink,
      textAlign: "center",
    },
  }));
}
