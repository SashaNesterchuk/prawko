import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { greenWaveAccent } from "../../theme/green-wave";

export function PaywallScreen({ children }: PropsWithChildren) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: greenWaveAccent.green.fill,
  },
});
