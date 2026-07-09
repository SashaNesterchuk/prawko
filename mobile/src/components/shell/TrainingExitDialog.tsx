import { Modal, Pressable, Text, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

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
  const theme = useTheme();
  const styles = useStyles();

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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.overlayBackdrop,
    },
    card: {
      width: "100%",
      borderRadius: radius.xxl,
      padding: spacing.xl,
      backgroundColor: colors.paper,
      shadowColor: colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: spacing.exact(32),
      shadowOffset: { width: 0, height: spacing.exact(26) },
      elevation: 12,
      gap: spacing.xl,
    },
    title: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.64,
      textAlign: "center",
      color: colors.ink,
    },
    body: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      textAlign: "center",
      color: colors.inkSecondary,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
    },
    continueButton: {
      backgroundColor: colors.white,
    },
    finishButton: {
      backgroundColor: theme.accents.red.fill,
    },
    continueLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.inkSecondary,
    },
    finishLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.onAccent,
    },
    pressed: {
      opacity: 0.88,
    },
  }));
}
