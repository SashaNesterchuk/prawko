import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignDetailNavProps = {
  backLabel: string;
  forwardLabel: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
};

export function SignDetailNav({
  backLabel,
  forwardLabel,
  canGoBack = true,
  canGoForward = true,
  onBack,
  onForward,
}: SignDetailNavProps) {
  const theme = useTheme();
  const styles = useStyles();
  const forwardLabelText = forwardLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.row}>
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        >
          <Icon color={theme.colors.ink2} name="back" size={20} />
          <CText style={styles.buttonLabel}>{backLabel}</CText>
        </Pressable>
      ) : (
        <View style={styles.buttonPlaceholder} />
      )}

      {canGoForward ? (
        <Pressable
          accessibilityRole="button"
          onPress={onForward}
          style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        >
          <CText style={styles.buttonLabel}>{forwardLabelText}</CText>
          <Icon color={theme.colors.ink2} name="chevron" size={20} />
        </Pressable>
      ) : (
        <View style={styles.buttonPlaceholder} />
      )}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    buttonPlaceholder: {
      flex: 1,
    },
    buttonLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("regular"),
      color: colors.ink2,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
