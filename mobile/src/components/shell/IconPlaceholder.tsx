import { StyleSheet, Text, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

export function IconPlaceholder({
  color = greenWave.color.ink,
  size = 24,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Text style={[styles.glyph, { color, fontSize: Math.round(size * 0.72) }]}>
        *
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontWeight: "700",
    lineHeight: undefined,
  },
});
