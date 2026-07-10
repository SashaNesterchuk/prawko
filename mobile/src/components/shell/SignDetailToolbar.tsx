import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignDetailToolbarProps = {
  code: string;
  categoryLabel: string;
  currentIndex: number;
  totalCount: number;
  onClose?: () => void;
  closeLabel?: string;
  rightSlot?: ReactNode;
};

export function SignDetailToolbar({
  code,
  categoryLabel,
  currentIndex,
  totalCount,
  onClose,
  closeLabel = "Close",
  rightSlot,
}: SignDetailToolbarProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <View style={styles.header}>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <Icon color={theme.colors.ink} name="close" size={responsiveFont(22)} />
        </Pressable>
      ) : (
        <View style={styles.iconSpacer} />
      )}

      <View style={styles.titleBlock}>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.category} numberOfLines={1}>
          {categoryLabel}
        </Text>
      </View>

      <View style={styles.metaBlock}>
        <Text style={styles.counter}>{`${currentIndex + 1} / ${totalCount}`}</Text>
        {rightSlot ?? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <Icon color={theme.colors.ink} name="star" size={responsiveFont(20)} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    iconButton: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    iconSpacer: {
      width: spacing.exact(40),
      height: spacing.exact(40),
    },
    titleBlock: {
      flex: 1,
      gap: spacing.exact(2),
    },
    code: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "700",
      color: colors.ink,
    },
    category: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    metaBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    counter: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
