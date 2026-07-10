import { Pressable, Text } from "react-native";

import { getFontFamily, useResponsiveStyles } from "../../portable-ui";

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
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.primaryLabel : styles.secondaryLabel,
          variant === "ghost" ? styles.ghostLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    base: {
      minHeight: spacing.exact(54),
      borderRadius: radius.large,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.exact(18),
    },
    primary: {
      backgroundColor: colors.accent,
    },
    secondary: {
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    ghost: {
      backgroundColor: colors.transparent,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      fontSize: responsiveFont(15),
      fontFamily: getFontFamily("bold"),
    },
    primaryLabel: {
      color: colors.onAccent,
    },
    secondaryLabel: {
      color: colors.textPrimary,
    },
    ghostLabel: {
      color: colors.textPrimary,
    },
  }));
}
