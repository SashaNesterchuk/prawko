import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ProfilePremiumBannerProps = {
  title: string;
  description: string;
  priceBadge?: string;
  onPress?: () => void;
};

export function ProfilePremiumBanner({
  title,
  description,
  priceBadge,
  onPress,
}: ProfilePremiumBannerProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            color={theme.colors.white}
            name="crown-outline"
            size={responsiveFont(24)}
          />
        </View>
        {priceBadge ? (
          <View style={styles.priceBadge}>
            <CText style={styles.priceBadgeText}>{priceBadge}</CText>
          </View>
        ) : null}
      </View>
      <View style={styles.copy}>
        <CText style={styles.title}>{title}</CText>
        <CText style={styles.description}>{description}</CText>
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    banner: {
      width: "100%",
      gap: spacing.md,
      padding: spacing.exact(24),
      borderRadius: radius.xl,
      backgroundColor: theme.accents.green.fill,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    pressed: {
      opacity: 0.92,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.accents.amber.fill,
    },
    priceBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.white,
    },
    priceBadgeText: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: theme.accents.green.ink,
    },
    copy: {
      gap: spacing.xs,
    },
    title: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: theme.colors.white,
    },
    description: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.onAccentSoft,
    },
  }));
}
