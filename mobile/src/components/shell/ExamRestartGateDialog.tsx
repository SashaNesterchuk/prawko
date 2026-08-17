import { Modal, Pressable, View } from "react-native";

import { Icon } from "../icons";
import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ExamRestartGateDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  watchAdLabel: string;
  premiumLabel: string;
  isWatchingAd?: boolean;
  onClose: () => void;
  onWatchAd: () => void;
  onPremium: () => void;
  /** iOS: fires after the modal finish dismissing. */
  onDismiss?: () => void;
};

export function ExamRestartGateDialog({
  visible,
  title,
  body,
  watchAdLabel,
  premiumLabel,
  isWatchingAd = false,
  onClose,
  onWatchAd,
  onPremium,
  onDismiss,
}: ExamRestartGateDialogProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <Modal
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.overlay} testID="exam-restart-gate">
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            disabled={isWatchingAd}
            onPress={onClose}
            testID="exam-restart-gate-close"
            style={({ pressed }) => [
              styles.closeButton,
              pressed && !isWatchingAd ? styles.pressed : null,
            ]}
          >
            <Icon color={theme.colors.ink2} name="close" size={24} />
          </Pressable>

          <CText style={styles.title}>{title}</CText>
          <CText style={styles.body}>{body}</CText>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isWatchingAd}
              onPress={onWatchAd}
              testID="exam-restart-gate-watch"
              style={({ pressed }) => [
                styles.actionButton,
                styles.watchButton,
                isWatchingAd ? styles.disabled : null,
                pressed && !isWatchingAd ? styles.pressed : null,
              ]}
            >
              <Icon name="play" size={20} color={theme.colors.white} />
              <CText style={styles.watchLabel}>{watchAdLabel}</CText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isWatchingAd}
              onPress={onPremium}
              testID="exam-restart-gate-premium"
              style={({ pressed }) => [
                styles.actionButton,
                styles.premiumButton,
                isWatchingAd ? styles.disabled : null,
                pressed && !isWatchingAd ? styles.pressed : null,
              ]}
            >
              <Icon name="premium" size={20} color={theme.accents.green.fill} />
              <CText style={styles.premiumLabel}>{premiumLabel}</CText>
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
      borderRadius: radius.xxxl,
      padding: spacing.exact(32),
      backgroundColor: colors.paper,
      shadowColor: colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: spacing.exact(32),
      shadowOffset: { width: 0, height: spacing.exact(26) },
      elevation: 12,
      gap: spacing.md,
    },
    closeButton: {
      alignSelf: "flex-end",
    },
    title: {
      marginTop: spacing.exact(-4),
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("bold"),
      textAlign: "center",
      color: colors.ink,
    },
    body: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      textAlign: "center",
      color: colors.ink2,
    },
    actions: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
    },
    watchButton: {
      backgroundColor: theme.accents.green.fill,
    },
    premiumButton: {
      backgroundColor: colors.white,
      borderWidth: 1.5,
      borderColor: theme.accents.green.fill,
    },
    watchLabel: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(26),
      fontFamily: getFontFamily("semiBold"),
      color: colors.white,
    },
    premiumLabel: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(26),
      fontFamily: getFontFamily("semiBold"),
      color: theme.accents.green.fill,
    },
    disabled: {
      opacity: 0.6,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
