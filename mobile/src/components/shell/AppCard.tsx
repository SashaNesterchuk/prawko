import { PropsWithChildren } from "react";
import { Pressable, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";

type AppCardProps = PropsWithChildren<{
  accent?: boolean;
  onPress?: () => void;
  testID?: string;
}>;

export function AppCard({
  accent = false,
  children,
  onPress,
  testID,
}: AppCardProps) {
  const styles = useStyles();

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        testID={testID}
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

  return (
    <View style={[styles.base, accent ? styles.accent : null]} testID={testID}>
      {children}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, elevation, radius, spacing, theme }) => ({
    base: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      backgroundColor: colors.white,
      ...elevation.card,
    },
    accent: {
      backgroundColor: theme.accents.green.soft,
    },
    pressed: {
      opacity: 0.88,
    },
  }));
}
