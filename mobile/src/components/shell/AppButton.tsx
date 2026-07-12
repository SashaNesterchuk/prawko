import { Pressable, Text } from "react-native";

import { getTypographyStyle, useResponsiveStyles } from "../../portable-ui";

type AppButtonVariant = "primary" | "secondary" | "ghost";

type AppButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
};

export function AppButton({
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: AppButtonProps) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : null,
        variant === "secondary" ? styles.secondary : null,
        variant === "ghost" ? styles.ghost : null,
        variant === "primary" && !disabled ? styles.primaryShadow : null,
        disabled && variant === "primary" ? styles.primaryDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.primaryLabel : styles.secondaryLabel,
          variant === "ghost" ? styles.ghostLabel : null,
          disabled && variant === "primary" ? styles.primaryDisabledLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, elevation, radius, spacing, theme }) => ({
    base: {
      minHeight: spacing.exact(52),
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
    },
    primary: {
      backgroundColor: theme.accents.green.fill,
    },
    primaryShadow: {
      ...elevation.raised,
    },
    primaryDisabled: {
      backgroundColor: colors.surface2,
    },
    secondary: {
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
    },
    ghost: {
      backgroundColor: colors.transparent,
      borderWidth: 1,
      borderColor: colors.line,
    },
    pressed: {
      opacity: 0.96,
    },
    label: {
      ...getTypographyStyle("headingM"),
    },
    primaryLabel: {
      color: colors.onAccent,
    },
    primaryDisabledLabel: {
      color: colors.ink3,
    },
    secondaryLabel: {
      color: colors.ink,
    },
    ghostLabel: {
      color: colors.ink,
    },
  }));
}
