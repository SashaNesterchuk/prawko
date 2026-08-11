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

type SignsScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: ReactNode;
};

export function SignsScreenHeader({
  title,
  onBack,
  backLabel = "Назад",
  rightSlot,
}: SignsScreenHeaderProps) {
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
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
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
      letterSpacing: -0.2,
      color: colors.ink,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
