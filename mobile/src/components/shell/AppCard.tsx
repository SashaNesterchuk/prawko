import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";

type AppCardProps = PropsWithChildren<{
  accent?: boolean;
  onPress?: () => void;
}>;

export function AppCard({ accent = false, children, onPress }: AppCardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

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

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    base: {
      borderRadius: theme.radius.xlarge,
      padding: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 2,
    },
    accent: {
      borderColor: theme.colors.accentMuted,
      backgroundColor: theme.colors.cardAccent,
    },
    pressed: {
      opacity: 0.88,
    },
  });
