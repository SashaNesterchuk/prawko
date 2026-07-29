import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import {
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ProfileSettingsRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon: ReactNode;
  iconBackground?: string;
  titleColor?: string;
  trailing?: "value" | "switch" | "premium" | "none";
  switchValue?: boolean;
  onPress?: () => void;
  onSwitchChange?: (value: boolean) => void;
  isLast?: boolean;
};

export function ProfileSettingsRow({
  title,
  subtitle,
  value,
  icon,
  iconBackground,
  titleColor,
  trailing = "value",
  switchValue = false,
  onPress,
  onSwitchChange,
  isLast = false,
}: ProfileSettingsRowProps) {
  const theme = useTheme();
  const styles = useStyles({
    iconBackgroundColor: iconBackground ?? theme.colors.paper,
    titleColor: titleColor ?? theme.colors.ink,
  });
  const content = (
    <>
      <View style={styles.iconWrap}>
        {icon}
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {trailing === "value" && value ? (
        <Text style={styles.value}>{value}</Text>
      ) : null}
      {trailing === "switch" ? (
        <Switch
          accessibilityLabel={title}
          onValueChange={onSwitchChange}
          thumbColor={theme.colors.white}
          trackColor={{
            false: theme.colors.track,
            true: theme.accents.green.fill,
          }}
          value={switchValue}
        />
      ) : null}
      {trailing === "premium" ? <PremiumMiniBadge /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          !isLast ? styles.rowBorder : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, !isLast ? styles.rowBorder : null]}>{content}</View>
  );
}

type ProfileSettingsGroupProps = {
  children: ReactNode;
};

export function ProfileSettingsGroup({ children }: ProfileSettingsGroupProps) {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

function PremiumMiniBadge() {
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons
        color={colors.white}
        name="crown-outline"
        size={responsiveFont(14)}
      />
    </View>
  );
}

function useStyles({
  iconBackgroundColor,
  titleColor,
}: {
  iconBackgroundColor?: string;
  titleColor?: string;
} = {}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    group: {
      width: "100%",
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    pressed: {
      opacity: 0.85,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: iconBackgroundColor ?? colors.paper,
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("medium"),
      letterSpacing: -0.16,
      color: titleColor ?? colors.ink,
    },
    subtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkMuted,
    },
    value: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      color: theme.accents.blue.ink,
    },
    badge: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: theme.accents.green.fill,
    },
  }));
}
