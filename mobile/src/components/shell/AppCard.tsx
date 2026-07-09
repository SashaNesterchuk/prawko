import { PropsWithChildren } from "react";
import { Pressable, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";

type AppCardProps = PropsWithChildren<{
  accent?: boolean;
  onPress?: () => void;
}>;

export function AppCard({ accent = false, children, onPress }: AppCardProps) {
  const styles = useStyles();

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          accent ? styles.accent : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.base, accent ? styles.accent : null]}>{children}</View>;
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    base: {
      borderRadius: radius.xlarge,
      padding: spacing.exact(18),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: spacing.exact(16),
      shadowOffset: {
        width: 0,
        height: spacing.exact(8),
      },
      elevation: 2,
    },
    accent: {
      borderColor: colors.accentMuted,
      backgroundColor: colors.cardAccent,
    },
    pressed: {
      opacity: 0.88,
    },
  }));
}
