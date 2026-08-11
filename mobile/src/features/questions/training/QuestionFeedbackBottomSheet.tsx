import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { AppButton } from "../../../components/shell/AppButton";
import { CText, getFontFamily, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

type QuestionFeedbackBottomSheetProps = {
  visible: boolean;
  isCorrectAnswer: boolean;
  explanationText: string | null;
  correctChoiceBullets: string[];
  showMasteryProgress: boolean;
  masteryCurrent: number;
  masteryTarget: number;
  isBookmarked: boolean;
  nextLabel: string;
  feedbackAccentFill: string;
  feedbackAccentInk: string;
  feedbackGradientColors: readonly [string, string];
  premiumIconSize: number;
  showExplain?: boolean;
  /**
   * Training uses a single primary CTA. Exam answer review uses Previous/Next
   * ghost controls as in Figma exam-answers frames.
   */
  navigationMode?: "next" | "previousNext";
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  previousLabel?: string;
  onPrevious?: () => void;
  onReportProblem: () => void;
  onToggleBookmark: () => void;
  onExplain?: () => void;
  onNext: () => void;
};

export function QuestionFeedbackBottomSheet({
  visible,
  isCorrectAnswer,
  explanationText,
  correctChoiceBullets,
  showMasteryProgress,
  masteryCurrent,
  masteryTarget,
  isBookmarked,
  nextLabel,
  feedbackAccentFill,
  feedbackAccentInk,
  feedbackGradientColors,
  premiumIconSize,
  showExplain = true,
  navigationMode = "next",
  canGoPrevious = false,
  canGoNext = true,
  previousLabel,
  onPrevious,
  onReportProblem,
  onToggleBookmark,
  onExplain,
  onNext,
}: QuestionFeedbackBottomSheetProps) {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles({ feedbackTitleColor: feedbackAccentInk });

  if (!visible) {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 24);
  const resolvedPreviousLabel = previousLabel ?? t("question.previousShort");

  return (
    <LinearGradient
      colors={[...feedbackGradientColors]}
      end={{ x: 0.5, y: 1 }}
      start={{ x: 0.5, y: 0 }}
      style={[styles.sheet, { paddingBottom: bottomPad }]}
      testID="question-feedback"
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon
            name={isCorrectAnswer ? "bulletCorrect" : "bulletWrong"}
            size={24}
            color={feedbackAccentFill}
          />
          <CText style={styles.title}>
            {isCorrectAnswer
              ? t("question.resultCorrect")
              : t("question.resultWrong")}
          </CText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("question.reportProblem")}
            hitSlop={8}
            onPress={onReportProblem}
            style={styles.iconButton}
          >
            <Icon name="problem" size={24} color={colors.icon} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isBookmarked
                ? t("question.removeBookmark")
                : t("question.bookmark")
            }
            hitSlop={8}
            onPress={onToggleBookmark}
            style={styles.iconButton}
          >
            <Icon
              name={isBookmarked ? "stateActive" : "stateDefault"}
              size={24}
              color={isBookmarked ? accents.amber.fill : colors.icon}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.gapMd} />

      {explanationText ? (
        <CText style={styles.body}>{explanationText}</CText>
      ) : null}

      {correctChoiceBullets.length > 0 ? (
        <>
          <View style={styles.gapXs} />
          <View style={styles.bullets}>
            {correctChoiceBullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletIcon}>
                  <Icon
                    name="bulletDot"
                    size={16}
                    color={feedbackAccentInk}
                  />
                </View>
                <CText style={styles.bulletText}>{bullet}</CText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {showMasteryProgress ? (
        <>
          <View style={styles.gapXs} />
          <CText style={styles.masteryProgress}>
            {t("question.masteryProgress", {
              current: masteryCurrent,
              target: masteryTarget,
              defaultValue: "Закріплення: {{current}}/{{target}}",
            })}
          </CText>
        </>
      ) : null}

      {showExplain ? (
        <>
          <View style={styles.gapMd} />
          <Pressable
            accessibilityRole="button"
            style={styles.explainRow}
            onPress={onExplain}
          >
            <CText style={styles.explainText}>
              {isCorrectAnswer
                ? t("question.explainOthers")
                : t("question.explainMistake")}
            </CText>
            <View style={styles.premiumBadge}>
              <Icon
                name="premiumSmall"
                size={premiumIconSize}
                color={colors.onAccent}
              />
            </View>
          </Pressable>
        </>
      ) : null}

      <View style={styles.gapMd} />

      {navigationMode === "previousNext" ? (
        <View style={styles.navRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoPrevious }}
            disabled={!canGoPrevious}
            onPress={onPrevious}
            style={({ pressed }) => [
              styles.navButton,
              !canGoPrevious ? styles.navButtonDisabled : null,
              pressed && canGoPrevious ? styles.navButtonPressed : null,
            ]}
          >
            <Icon name="back" size={20} color={colors.ink2} />
            <CText style={styles.navButtonText}>{resolvedPreviousLabel}</CText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoNext }}
            disabled={!canGoNext}
            onPress={onNext}
            style={({ pressed }) => [
              styles.navButton,
              !canGoNext ? styles.navButtonDisabled : null,
              pressed && canGoNext ? styles.navButtonPressed : null,
            ]}
            testID="question-feedback-next"
          >
            <CText style={styles.navButtonText}>{nextLabel}</CText>
            <Icon name="chevron" size={20} color={colors.ink2} />
          </Pressable>
        </View>
      ) : (
        <AppButton
          label={nextLabel}
          onPress={onNext}
          testID="question-feedback-next"
          variant={isCorrectAnswer ? "primary" : "danger"}
        />
      )}
    </LinearGradient>
  );
}

function useStyles({ feedbackTitleColor }: { feedbackTitleColor: string }) {
  return useResponsiveStyles(
    ({ accents, colors, elevation, radius, responsiveFont, spacing }) => ({
      sheet: {
        alignSelf: "stretch",
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(24),
        ...elevation.raised,
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(10),
      },
      titleRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      title: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        letterSpacing: -0.2,
        color: feedbackTitleColor,
      },
      headerActions: {
        flexDirection: "row",
        alignItems: "center",
      },
      iconButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
      },
      gapMd: {
        height: spacing.exact(16),
      },
      gapXs: {
        height: spacing.exact(8),
      },
      body: {
        alignSelf: "stretch",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      bullets: {
        alignSelf: "stretch",
        gap: spacing.exact(8),
      },
      bulletRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.exact(4),
      },
      bulletIcon: {
        width: spacing.exact(20),
        height: spacing.exact(20),
        alignItems: "center",
        justifyContent: "center",
      },
      bulletText: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      masteryProgress: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: accents.green.ink,
      },
      explainRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(10),
        paddingVertical: spacing.exact(12),
        alignSelf: "stretch",
      },
      explainText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: accents.blue.ink,
      },
      premiumBadge: {
        width: spacing.exact(20),
        height: spacing.exact(20),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        alignItems: "center",
        justifyContent: "center",
      },
      navRow: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "stretch",
      },
      navButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
        minHeight: spacing.exact(48),
      },
      navButtonDisabled: {
        opacity: 0.2,
      },
      navButtonPressed: {
        opacity: 0.85,
      },
      navButtonText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.ink2,
      },
    })
  );
}
