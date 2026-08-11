import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CText, useResponsiveStyles } from "../../portable-ui";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";

type SignGridItemProps = {
  sign: RoadSign;
  onPress?: () => void;
};

export function SignGridItem({ sign, onPress }: SignGridItemProps) {
  const { i18n } = useTranslation();
  const styles = useStyles();
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
        <CText style={styles.title} numberOfLines={2}>
          {displayName}
        </CText>
        <CText style={styles.code} numberOfLines={1}>
          {sign.code}
        </CText>
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    tile: {
      flex: 1,
      minWidth: spacing.exact(96),
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
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
    copy: {
      width: "100%",
      alignItems: "center",
      gap: spacing.exact(2),
    },
    title: {
      width: "100%",
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(14),
      fontWeight: "600",
      color: colors.ink,
      textAlign: "center",
    },
    code: {
      width: "100%",
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(14),
      color: colors.inkMuted,
      textAlign: "center",
    },
  }));
}
