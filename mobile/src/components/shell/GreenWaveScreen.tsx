import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";

export function GreenWaveScreen({ children }: PropsWithChildren) {
  const styles = useStyles();

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.sky} />
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
    sky: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "32%",
      backgroundColor: colors.skySoft,
    },
  }));
}
