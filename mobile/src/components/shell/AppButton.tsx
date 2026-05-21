import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";

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
  const theme = useTheme();
  const styles = getStyles(theme);

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

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    base: {
      minHeight: 54,
      borderRadius: theme.radius.large,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    primary: {
      backgroundColor: theme.colors.accent,
    },
    secondary: {
      backgroundColor: theme.colors.cardMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      fontSize: 15,
      fontWeight: "700",
    },
    primaryLabel: {
      color: theme.colors.onAccent,
    },
    secondaryLabel: {
      color: theme.colors.textPrimary,
    },
    ghostLabel: {
      color: theme.colors.textPrimary,
    },
  });
