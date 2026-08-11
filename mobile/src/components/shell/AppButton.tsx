import { Pressable } from "react-native";

import {
  CText,
  getTypographyStyle,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";

type AppButtonVariant = "primary" | "danger" | "secondary" | "ghost";

type AppButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: AppButtonVariant;
};

export function AppButton({
  disabled = false,
  label,
  onPress,
  testID,
  variant = "primary",
}: AppButtonProps) {
  const styles = useStyles();
  const isFilled = variant === "primary" || variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : null,
        variant === "danger" ? styles.danger : null,
        variant === "secondary" ? styles.secondary : null,
        variant === "ghost" ? styles.ghost : null,
        isFilled && !disabled ? styles.primaryShadow : null,
        disabled && isFilled ? styles.primaryDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <CText
        style={[
          styles.label,
          isFilled ? styles.primaryLabel : styles.secondaryLabel,
          variant === "ghost" ? styles.ghostLabel : null,
          disabled && isFilled ? styles.primaryDisabledLabel : null,
        ]}
      >
        {label}
      </CText>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
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
    danger: {
      backgroundColor: theme.accents.red.fill,
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
      ...withResponsiveFont(getTypographyStyle("headingM"), responsiveFont),
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
  })
  );
}
