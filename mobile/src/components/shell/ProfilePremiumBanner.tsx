import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ProfilePremiumBannerProps = {
  title: string;
  description: string;
  onPress?: () => void;
};

export function ProfilePremiumBanner({
  title,
  description,
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
      <View style={styles.iconWrap}>
        <Ionicons color={theme.colors.white} name="diamond" size={responsiveFont(24)} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    banner: {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
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
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.accents.amber.fill,
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
      color: theme.colors.white,
    },
    description: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.onAccentSoft,
    },
  }));
}
