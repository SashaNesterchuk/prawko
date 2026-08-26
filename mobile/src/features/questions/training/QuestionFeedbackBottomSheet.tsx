import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { ExplanationSignStrip } from "../../../components/shell/ExplanationSignStrip";
import { CText, getFontFamily, useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

type QuestionFeedbackBottomSheetProps = {
  visible: boolean;
  isCorrectAnswer: boolean;
  explanationText: string | null;
  isBookmarked: boolean;
  feedbackAccentFill: string;
  feedbackAccentInk: string;
  feedbackGradientColors: readonly [string, string];
  premiumIconSize: number;
  showExplain?: boolean;
  /** Sign already rendered in the question body, kept out of the sign strip. */
  excludeSignId?: string;
  onReportProblem: () => void;
  onToggleBookmark: () => void;
  onExplain?: () => void;
};

export function QuestionFeedbackBottomSheet({
  visible,
  isCorrectAnswer,
  explanationText,
  isBookmarked,
  feedbackAccentFill,
  feedbackAccentInk,
  feedbackGradientColors,
  premiumIconSize,
  showExplain = false,
  excludeSignId,
  onReportProblem,
  onToggleBookmark,
  onExplain,
}: QuestionFeedbackBottomSheetProps) {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const styles = useStyles({ feedbackTitleColor: feedbackAccentInk });

  if (!visible) {
    return null;
  }

  return (
    <LinearGradient
      colors={[...feedbackGradientColors]}
      end={{ x: 0.5, y: 1 }}
      start={{ x: 0.5, y: 0 }}
      style={styles.sheet}
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

      <ExplanationSignStrip
        excludeSignId={excludeSignId}
        text={explanationText}
      />

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
      body: {
        alignSelf: "stretch",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
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
    })
  );
}
