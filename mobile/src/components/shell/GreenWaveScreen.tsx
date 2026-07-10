import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export function GreenWaveScreen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.root}>
      <LinearGradient
        // colors={[colors.backgroundSky, colors.paper, colors.paper]}
        colors={[colors.backgroundSky, colors.paper, colors.paper]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.38, 1]}
        pointerEvents="none"
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors }) => ({
    root: {
      flex: 1,
      backgroundColor: colors.paper,
    },
  }));
}
