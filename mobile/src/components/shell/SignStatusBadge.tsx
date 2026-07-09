import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

export type SignLearningStatus = "new" | "mastered" | "wrong";

type SignStatusBadgeProps = {
  status: SignLearningStatus;
  label: string;
};

export function SignStatusBadge({ status, label }: SignStatusBadgeProps) {
  const palette =
    status === "mastered"
      ? greenWaveAccent.green
      : status === "wrong"
        ? greenWaveAccent.red
        : greenWaveAccent.blue;

  const iconName =
    status === "mastered"
      ? "checkmark-circle"
      : status === "wrong"
        ? "close-circle"
        : "document-text-outline";

  return (
    <View style={[styles.badge, { backgroundColor: palette.soft }]}>
      <Ionicons color={palette.ink} name={iconName} size={14} />
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: greenWave.radius.pill,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
});
