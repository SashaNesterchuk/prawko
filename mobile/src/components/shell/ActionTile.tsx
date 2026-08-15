import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { type GreenWaveAccent } from "../../theme/green-wave";

export type ActionTileStyle = "default" | "raised" | "inactive" | "faded";

type ActionTileProps = {
  title: string;
  subtitle: string;
  accent?: GreenWaveAccent;
  premium?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: ActionTileStyle;
  /** Full-width horizontal layout (Figma Action tile at FILL width). */
  fullWidth?: boolean;
  /** Selected language / option state (green fill + check). */
  selected?: boolean;
  testID?: string;
};

export function ActionTile({
  title,
  subtitle,
  accent: _accent = "green",
  premium = false,
  icon,
  onPress,
  style = "default",
  fullWidth = false,
  selected = false,
  testID,
}: ActionTileProps) {
  const isInline = fullWidth || style === "faded";
  const styles = useStyles({ style, isInline, selected });
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const showTrailing = isInline && selected;

  const body = (
    <>
      {icon ? (
        <View style={styles.iconWrap}>
          <View style={styles.icon}>{icon}</View>
        </View>
      ) : null}

      <View style={styles.copy}>
        <CText style={styles.title} semiBold numberOfLines={1}>
          {title}
        </CText>
        <CText style={styles.subtitle} regular numberOfLines={2}>
          {subtitle}
        </CText>
      </View>

      {showTrailing ? (
        <View style={styles.trailingWrap}>
          <Icon
            color={theme.colors.onAccent}
            name="check"
            size={responsiveFont(24)}
          />
        </View>
      ) : null}

      {premium ? <PremiumBadge /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        disabled={style === "inactive"}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          pressed && style !== "inactive" ? styles.pressed : null,
        ]}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.tile} testID={testID}>
      {body}
    </View>
  );
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

function useStyles({
  style = "default",
  isInline = false,
  selected = false,
}: {
  style?: ActionTileStyle;
  isInline?: boolean;
  selected?: boolean;
} = {}) {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
    tile: {
      flex: isInline ? undefined : 1,
      width: isInline ? ("100%" as const) : undefined,
      minWidth: spacing.exact(100),
      position: "relative" as const,
      flexDirection: isInline ? ("row" as const) : ("column" as const),
      alignItems: isInline ? ("center" as const) : ("flex-start" as const),
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: selected
        ? theme.accents.green.fill
        : style === "faded"
          ? "rgba(255,255,255,0.6)"
          : colors.white,
      opacity: style === "inactive" ? 0.4 : 1,
      ...(style === "raised" && !selected ? elevation.sharp : null),
    },
    pressed: {
      opacity: style === "inactive" ? 0.4 : 0.9,
    },
    iconWrap: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: spacing.sm,
      borderRadius: radius.md,
      overflow: "hidden" as const,
      backgroundColor: colors.paper,
    },
    icon: {
      width: spacing.exact(24),
      height: spacing.exact(24),
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    copy: {
      flex: isInline ? 1 : undefined,
      width: isInline ? undefined : ("100%" as const),
      minWidth: 0,
      flexDirection: "column" as const,
      gap: spacing.exact(0),
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      letterSpacing: -0.16,
      color: selected ? colors.white : colors.ink,
    },
    subtitle: {
      width: "100%" as const,
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: selected ? colors.paper : colors.ink3,
    },
    trailingWrap: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: spacing.sm,
      borderRadius: radius.md,
      overflow: "hidden" as const,
      backgroundColor: colors.surface2,
    },
    badge: {
      position: "absolute" as const,
      top: spacing.md,
      right: spacing.md,
      width: spacing.exact(20),
      height: spacing.exact(20),
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
  }));
}
