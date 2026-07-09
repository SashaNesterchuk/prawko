import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

export function GreenWaveScreen({ children }: PropsWithChildren) {
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.sky} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: greenWave.color.paper,
  },
  sky: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32%",
    backgroundColor: greenWave.color.skySoft,
  },
});
