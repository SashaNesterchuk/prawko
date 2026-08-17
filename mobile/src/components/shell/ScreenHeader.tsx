import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: ReactNode;
};

export function ScreenHeader({
  title,
  onBack,
  backLabel = "Назад",
  rightSlot,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          testID="nav-back"
        >
          <Icon color={theme.colors.ink} name="back" size={responsiveFont(22)} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <CText style={styles.headerTitle} numberOfLines={1}>
        {title}
      </CText>

      {rightSlot ?? <View style={styles.backSpacer} />}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingHorizontal: spacing.xxl,
    },
    backButton: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    backSpacer: {
      width: spacing.exact(40),
      height: spacing.exact(40),
    },
    headerTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
