import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import {
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { type GreenWaveAccent } from "../../theme/green-wave";

type ActionTileStyle = "default" | "raised" | "inactive" | "faded";

type ActionTileProps = {
  title: string;
  subtitle: string;
  accent?: GreenWaveAccent;
  premium?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: ActionTileStyle;
};

export function ActionTile({
  title,
  subtitle,
  accent = "green",
  premium = false,
  icon,
  onPress,
  style = "default",
}: ActionTileProps) {
  const theme = useTheme();
  const styles = useStyles({ style });

  const body = (
    <>
      <View style={styles.iconWrap}>
        {icon ? (
          <View style={styles.icon}>{icon}</View>
        ) : null}
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
        disabled={style === "inactive"}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          pressed && style !== "inactive" ? styles.pressed : null,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.tile}>{body}</View>;
}

function PremiumBadge() {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <View style={styles.badge}>
      <Icon
        color={theme.colors.onAccent}
        name="premiumSmall"
        size={responsiveFont(12)}
      />
    </View>
  );
}

function useStyles({ style = "default" }: { style?: ActionTileStyle } = {}) {
  return useResponsiveStyles(({ colors, elevation, radius, spacing, theme }) => ({
    tile: {
      flex: 1,
      minWidth: spacing.exact(100),
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      alignContent: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor:
        style === "faded" ? "rgba(255,255,255,0.6)" : colors.white,
      opacity: style === "inactive" ? 0.4 : 1,
      ...(style === "raised" ? elevation.sharp : null),
    },
    pressed: {
      opacity: style === "inactive" ? 0.4 : 0.9,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.paper,
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
      gap: spacing.exact(0),
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.exact(10),
    },
    title: {
      flex: 1,
      ...getTypographyStyle("headingS"),
      color: colors.ink,
    },
    subtitle: {
      width: "100%",
      ...getTypographyStyle("labelS"),
      color: colors.ink3,
    },
    badge: {
      width: spacing.exact(20),
      height: spacing.exact(20),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
  }));
}
