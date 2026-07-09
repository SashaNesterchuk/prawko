import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

type SignDetailNavProps = {
  backLabel: string;
  forwardLabel: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
};

export function SignDetailNav({
  backLabel,
  forwardLabel,
  canGoBack = true,
  canGoForward = true,
  onBack,
  onForward,
}: SignDetailNavProps) {
  return (
    <View style={styles.row}>
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.button, styles.buttonLeft, pressed ? styles.pressed : null]}
        >
          <Ionicons color={greenWave.color.inkSecondary} name="chevron-back" size={18} />
          <Text style={styles.buttonLabel}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {canGoForward ? (
        <Pressable
          accessibilityRole="button"
          onPress={onForward}
          style={({ pressed }) => [styles.button, styles.buttonRight, pressed ? styles.pressed : null]}
        >
          <Text style={styles.buttonLabel}>{forwardLabel}</Text>
          <Ionicons color={greenWave.color.inkSecondary} name="chevron-forward" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: greenWave.spacing.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
    paddingVertical: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  buttonLeft: {
    alignSelf: "flex-start",
  },
  buttonRight: {
    alignSelf: "flex-end",
    marginLeft: "auto",
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.inkSecondary,
  },
  spacer: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
  },
});
