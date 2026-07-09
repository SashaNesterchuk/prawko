import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { type GreenWaveAccent } from "../../theme/green-wave";

type ActionTileProps = {
  title: string;
  subtitle: string;
  accent?: GreenWaveAccent;
  premium?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
};

export function ActionTile({
  title,
  subtitle,
  accent = "green",
  premium = false,
  icon,
  onPress,
}: ActionTileProps) {
  const theme = useTheme();
  const accentColor = theme.accents[accent];
  const styles = useStyles({ iconBackground: accentColor.soft });

  const body = (
    <>
      <View style={styles.iconWrap}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {premium ? <PremiumBadge /> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.tile}>{body}</View>;
}

function PremiumBadge() {
  const styles = useStyles();

  return (
    <View style={styles.badge}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}

function useStyles({ iconBackground }: { iconBackground?: string } = {}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    tile: {
      flex: 1,
      minWidth: spacing.exact(100),
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      alignContent: "center",
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
      opacity: 0.9,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: iconBackground,
    },
    icon: {
      width: spacing.exact(24),
      height: spacing.exact(24),
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      minWidth: spacing.exact(100),
      flexDirection: "column",
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.exact(10),
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    subtitle: {
      width: "100%",
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkMuted,
    },
    badge: {
      width: spacing.exact(24),
      height: spacing.exact(24),
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    lockShackle: {
      width: spacing.exact(8),
      height: spacing.exact(5),
      borderWidth: 1.5,
      borderBottomWidth: 0,
      borderColor: colors.onAccent,
      borderTopLeftRadius: spacing.exact(4),
      borderTopRightRadius: spacing.exact(4),
      marginBottom: -1,
    },
    lockBody: {
      width: spacing.exact(11),
      height: spacing.exact(7),
      borderRadius: spacing.exact(2),
      backgroundColor: colors.onAccent,
    },
  }));
}
