import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
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
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const forwardLabelText = forwardLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.row}>
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.button, styles.buttonLeft, pressed ? styles.pressed : null]}
        >
          <Icon color={theme.colors.inkSecondary} name="back" size={responsiveFont(18)} />
          <Text style={styles.buttonLabel}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {canGoForward ? (
        <Pressable
          accessibilityRole="button"
          onPress={onForward}
          style={({ pressed }) => [styles.button, styles.buttonRight, pressed ? styles.pressed : null]}
        >
          <Text style={styles.buttonLabel}>{forwardLabelText}</Text>
          <Icon color={theme.colors.inkSecondary} name="chevron" size={responsiveFont(18)} />
        </Pressable>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    buttonLeft: {
      alignSelf: "flex-start",
    },
    buttonRight: {
      alignSelf: "flex-end",
      marginLeft: "auto",
    },
    buttonLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "600",
      color: colors.inkSecondary,
    },
    spacer: {
      flex: 1,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
