import { Modal, Pressable, View } from "react-native";

import { Icon } from "../icons";
import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import {
  getQuestionCountOptions,
  type QuestionCountSelection,
} from "./question-count-options";

export {
  DEFAULT_QUESTION_COUNT,
  getDefaultQuestionCount,
  getQuestionCountOptions,
  QUESTION_COUNT_PRESETS as QUESTION_COUNT_OPTIONS,
  resolveQuestionCountDialog,
  shouldShowQuestionCountDialog,
  toQuestionLimit,
  type QuestionCountSelection,
} from "./question-count-options";

type QuestionCountDialogProps = {
  title: string;
  subtitle: string;
  startLabel: string;
  allLabel: string;
  totalCount: number;
  selectedCount: QuestionCountSelection;
  visible: boolean;
  options?: QuestionCountSelection[];
  getOptionLabel?: (
    option: QuestionCountSelection,
    totalCount: number
  ) => string;
  testID?: string;
  onClose: () => void;
  onSelectCount: (count: QuestionCountSelection) => void;
  onStart: () => void;
};

export function QuestionCountDialog({
  title,
  subtitle,
  startLabel,
  allLabel,
  totalCount,
  selectedCount,
  visible,
  options: customOptions,
  getOptionLabel,
  testID = "question-count-dialog",
  onClose,
  onSelectCount,
  onStart,
}: QuestionCountDialogProps) {
  const theme = useTheme();
  const styles = useStyles();
  const options = customOptions ?? getQuestionCountOptions(totalCount);
  const isSingleRow = options.length > 0 && options.length <= 3;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay} testID={testID}>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
            testID="question-count-close"
          >
            <Icon color={theme.colors.ink2} name="close" size={24} />
          </Pressable>

          <CText style={styles.title}>{title}</CText>
          <CText style={styles.subtitle}>{subtitle}</CText>

          <View style={styles.grid}>
            {options.map((option) => {
              const isSelected = selectedCount === option;
              const fallbackLabel =
                option === "all"
                  ? allLabel.includes("{{count}}")
                    ? allLabel.replace("{{count}}", String(totalCount))
                    : `${allLabel} (${totalCount})`
                  : String(option);
              const label = getOptionLabel
                ? getOptionLabel(option, totalCount)
                : fallbackLabel;

              return (
                <Pressable
                  key={String(option)}
                  accessibilityRole="button"
                  onPress={() => onSelectCount(option)}
                  style={({ pressed }) => [
                    styles.option,
                    isSingleRow ? styles.optionSingleRow : null,
                    isSelected ? styles.optionSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`question-count-option-${option}`}
                >
                  <CText
                    style={[
                      styles.optionLabel,
                      isSelected ? styles.optionLabelSelected : null,
                    ]}
                  >
                    {label}
                  </CText>
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
            testID="question-count-start"
          >
            <CText style={styles.startLabel}>{startLabel}</CText>
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
      fontFamily: getFontFamily("bold"),
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
    optionSingleRow: {
      flexBasis: 0,
      minWidth: 0,
    },
    optionSelected: {
      borderColor: theme.accents.green.fill,
      backgroundColor: theme.accents.green.fill,
    },
    optionLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
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
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.white,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
