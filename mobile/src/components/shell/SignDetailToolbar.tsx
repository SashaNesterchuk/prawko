import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { NavigationButton } from "./NavigationButton";
import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignDetailToolbarProps = {
  code: string;
  categoryLabel: string;
  currentIndex: number;
  totalCount: number;
  isBookmarked?: boolean;
  bookmarkLabel?: string;
  onToggleBookmark?: () => void;
  onClose?: () => void;
  closeLabel?: string;
  rightSlot?: ReactNode;
};

export function SignDetailToolbar({
  code,
  categoryLabel,
  currentIndex,
  totalCount,
  isBookmarked = false,
  bookmarkLabel,
  onToggleBookmark,
  onClose,
  closeLabel = "Close",
  rightSlot,
}: SignDetailToolbarProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.header}>
      {onClose ? (
        <NavigationButton
          accessibilityLabel={closeLabel}
          inset
          onPress={onClose}
          type="close"
        />
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
            accessibilityLabel={bookmarkLabel}
            accessibilityState={{ selected: isBookmarked }}
            disabled={!onToggleBookmark}
            hitSlop={8}
            onPress={onToggleBookmark}
            style={({ pressed }) => [styles.bookmarkButton, pressed ? styles.pressed : null]}
          >
            <Icon
              color={
                isBookmarked ? theme.accents.amber.fill : theme.colors.icon
              }
              name={isBookmarked ? "stateActive" : "stateDefault"}
              size={24}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    iconSpacer: {
      width: spacing.exact(40),
      height: spacing.exact(40),
    },
    titleBlock: {
      flex: 1,
      gap: 0,
    },
    code: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.ink,
    },
    category: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink3,
    },
    metaBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    counter: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink2,
    },
    bookmarkButton: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
