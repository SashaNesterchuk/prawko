import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Icon } from "../../../components/icons";
import { AppButton } from "../../../components/shell/AppButton";
import { useResponsiveStyles } from "../../../portable-ui";
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

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View pointerEvents="none" style={styles.scrim} />
      <LinearGradient
        colors={[...feedbackGradientColors]}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Icon
              name={isCorrectAnswer ? "bulletCorrect" : "bulletWrong"}
              size={24}
              color={feedbackAccentFill}
            />
            <Text style={styles.title}>
              {isCorrectAnswer
                ? t("question.resultCorrect")
                : t("question.resultWrong")}
            </Text>
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
          <Text style={styles.body}>{explanationText}</Text>
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
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {showMasteryProgress ? (
          <>
            <View style={styles.gapXs} />
            <Text style={styles.masteryProgress}>
              {t("question.masteryProgress", {
                current: masteryCurrent,
                target: masteryTarget,
                defaultValue: "Закріплення: {{current}}/{{target}}",
              })}
            </Text>
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
              <Text style={styles.explainText}>
                {isCorrectAnswer
                  ? t("question.explainOthers")
                  : t("question.explainMistake")}
              </Text>
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

        <AppButton label={nextLabel} onPress={onNext} />
      </LinearGradient>
    </View>
  );
}

function useStyles({ feedbackTitleColor }: { feedbackTitleColor: string }) {
  return useResponsiveStyles(
    ({ accents, colors, elevation, radius, responsiveFont, spacing }) => ({
      host: {
        ...StyleSheetAbsoluteFill,
        justifyContent: "flex-end",
        zIndex: 30,
      },
      scrim: {
        ...StyleSheetAbsoluteFill,
        backgroundColor: colors.overlayScrim,
      },
      sheet: {
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(24),
        ...elevation.modal,
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
        fontWeight: "600",
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
        fontWeight: "600",
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
    })
  );
}

const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
