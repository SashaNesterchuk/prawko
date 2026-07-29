import { Modal, Pressable, Text, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";

type TrainingExitDialogProps = {
  body: string;
  continueLabel: string;
  finishLabel: string;
  /** vertical: finish on top (training/exam). horizontal: continue | finish side by side (reset). */
  layout?: "vertical" | "horizontal";
  onContinue: () => void;
  onFinish: () => void;
  title: string;
  visible: boolean;
};

export function TrainingExitDialog({
  body,
  continueLabel,
  finishLabel,
  layout = "vertical",
  onContinue,
  onFinish,
  title,
  visible,
}: TrainingExitDialogProps) {
  const styles = useStyles();
  const isHorizontal = layout === "horizontal";

  const finishButton = (
    <Pressable
      accessibilityRole="button"
      onPress={onFinish}
      style={({ pressed }) => [
        styles.actionButton,
        isHorizontal ? styles.actionButtonGrow : null,
        styles.finishButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.finishLabel}>{finishLabel}</Text>
    </Pressable>
  );

  const continueButton = (
    <Pressable
      accessibilityRole="button"
      onPress={onContinue}
      style={({ pressed }) => [
        styles.actionButton,
        isHorizontal ? styles.actionButtonGrow : null,
        styles.continueButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.continueLabel,
          isHorizontal ? styles.continueLabelMuted : null,
        ]}
      >
        {continueLabel}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onContinue}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View
            style={[
              styles.actions,
              isHorizontal ? styles.actionsHorizontal : null,
            ]}
          >
            {isHorizontal ? (
              <>
                {continueButton}
                {finishButton}
              </>
            ) : (
              <>
                {finishButton}
                {continueButton}
              </>
            )}
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
      borderRadius: radius.xxxl,
      padding: spacing.exact(32),
      backgroundColor: colors.paper,
      shadowColor: colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: spacing.exact(32),
      shadowOffset: { width: 0, height: spacing.exact(26) },
      elevation: 12,
      gap: spacing.exact(32),
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
      color: colors.ink2,
    },
    actions: {
      gap: spacing.sm,
    },
    actionsHorizontal: {
      flexDirection: "row",
    },
    actionButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
    },
    actionButtonGrow: {
      flex: 1,
    },
    finishButton: {
      backgroundColor: theme.accents.red.fill,
    },
    continueButton: {
      backgroundColor: colors.white,
    },
    finishLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.white,
    },
    continueLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.ink,
    },
    continueLabelMuted: {
      color: colors.ink2,
    },
    pressed: {
      opacity: 0.88,
    },
  }));
}
