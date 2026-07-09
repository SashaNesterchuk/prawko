import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type DailyWarmupCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  badgeLabel?: string;
  onPress?: () => void;
};

export function DailyWarmupCard({
  title,
  description,
  buttonLabel,
  badgeLabel,
  onPress,
}: DailyWarmupCardProps) {
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <BoltIcon />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {badgeLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.description}>{description}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      >
        <Text style={styles.buttonLabel}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

function BoltIcon() {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();

  return (
    <Ionicons
      color={theme.accents.amber.fill}
      name="flash-outline"
      size={responsiveFont(24)}
    />
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      flexDirection: "column",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    titleGroup: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    title: {
      flexShrink: 1,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.soft,
    },
    badgeLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: theme.accents.green.ink,
    },
    description: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.inkSecondary,
    },
    button: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: theme.accents.green.soft,
    },
    pressed: {
      opacity: 0.85,
    },
    buttonLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: theme.accents.green.ink,
    },
  }));
}
