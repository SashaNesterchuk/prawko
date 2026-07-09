import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type TrainingExitDialogProps = {
  body: string;
  continueLabel: string;
  finishLabel: string;
  onContinue: () => void;
  onFinish: () => void;
  title: string;
  visible: boolean;
};

export function TrainingExitDialog({
  body,
  continueLabel,
  finishLabel,
  onContinue,
  onFinish,
  title,
  visible,
}: TrainingExitDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onContinue}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [
                styles.actionButton,
                styles.continueButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.continueLabel}>{continueLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onFinish}
              style={({ pressed }) => [
                styles.actionButton,
                styles.finishButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.finishLabel}>{finishLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.xl,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  card: {
    width: "100%",
    borderRadius: greenWave.radius.xxl,
    padding: greenWave.spacing.xl,
    backgroundColor: greenWave.color.paper,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 26 },
    elevation: 12,
    gap: greenWave.spacing.xl,
  },
  title: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.64,
    textAlign: "center",
    color: greenWave.color.ink,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: greenWave.spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: greenWave.spacing.xl,
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
  },
  continueButton: {
    backgroundColor: "#ffffff",
  },
  finishButton: {
    backgroundColor: greenWaveAccent.red.fill,
  },
  continueLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.inkSecondary,
  },
  finishLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.onAccent,
  },
  pressed: {
    opacity: 0.88,
  },
});
