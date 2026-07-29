import { Pressable } from "react-native";

import { Icon, type IconName } from "../icons";
import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type NavigationButtonType = "close" | "back";

type NavigationButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  type?: NavigationButtonType;
  /**
   * Figma Navigation button surface — white translucent inset block.
   * Use on green-wave quiz headers (e.g. training / result).
   */
  inset?: boolean;
  /** Light glyph for solid green surfaces such as the paywall. */
  tone?: "default" | "onAccent";
};

const ICON_BY_TYPE: Record<NavigationButtonType, IconName> = {
  close: "close",
  back: "back",
};

export function NavigationButton({
  accessibilityLabel,
  inset = false,
  onPress,
  tone = "default",
  type = "close",
}: NavigationButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const iconColor = tone === "onAccent" ? colors.onAccent : colors.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        inset ? styles.inset : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon name={ICON_BY_TYPE[type]} size={24} color={iconColor} />
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    base: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.lg,
    },
    inset: {
      backgroundColor: colors.inset,
    },
    pressed: {
      opacity: 0.85,
    },
  }));
}
