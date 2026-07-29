import { Modal, Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export const SIGN_TRAINING_COUNT_OPTIONS = [10, 20, 40] as const;

type SignQuestionCountDialogProps = {
  title: string;
  subtitle: string;
  startLabel: string;
  allLabel: string;
  totalCount: number;
  selectedCount: number | "all";
  visible: boolean;
  onClose: () => void;
  onSelectCount: (count: number | "all") => void;
  onStart: () => void;
};

export function SignQuestionCountDialog({
  title,
  subtitle,
  startLabel,
  allLabel,
  totalCount,
  selectedCount,
  visible,
  onClose,
  onSelectCount,
  onStart,
}: SignQuestionCountDialogProps) {
  const theme = useTheme();
  const styles = useStyles();
  const options: Array<number | "all"> = [
    ...SIGN_TRAINING_COUNT_OPTIONS,
    "all",
  ];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon color={theme.colors.ink2} name="close" size={24} />
          </Pressable>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.grid}>
            {options.map((option) => {
              const isSelected = selectedCount === option;
              const label =
                option === "all"
                  ? allLabel.includes("{{count}}")
                    ? allLabel.replace("{{count}}", String(totalCount))
                    : `${allLabel} (${totalCount})`
                  : String(option);

              return (
                <Pressable
                  key={String(option)}
                  accessibilityRole="button"
                  onPress={() => onSelectCount(option)}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected ? styles.optionSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected ? styles.optionLabelSelected : null,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [
              styles.startButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.startLabel}>{startLabel}</Text>
          </Pressable>
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
      fontWeight: "700",
      letterSpacing: -0.64,
      textAlign: "center",
      color: colors.ink,
    },
    subtitle: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      textAlign: "center",
      color: colors.ink2,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    option: {
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: "47%",
      minWidth: "46%",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: theme.accents.green.fill,
      backgroundColor: theme.accents.green.fill,
    },
    optionLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    optionLabelSelected: {
      color: colors.white,
    },
    startButton: {
      marginTop: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    startLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.white,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
