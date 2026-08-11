import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../../components/icons";
import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { useAppShellStore } from "../../state/app-shell";
import type { AppThemeAccent } from "../../theme";
import { getQuestionTopicTitle } from "../question-topics/catalog";

import {
  formatExamDurationParts,
  getProgressBarAccent,
  type ExamResultOutcome,
  type ExamResultQuestionChip,
  type ExamResultScopeSection,
  type ExamResultTopicStat,
  type ExamScoreDelta,
} from "./exam-result-stats";

/** How far the content has to scroll before the top fade is at full strength. */
const TOP_FADE_RAMP = 16;

type ExamResultViewProps = {
  correctAnswersCount: number;
  durationSeconds: number;
  onClose: () => void;
  onNewAttempt: () => void;
  onPrimaryAction: () => void;
  onReviewAnswers: () => void;
  outcome: ExamResultOutcome;
  passPoints: number;
  scoreDelta: ExamScoreDelta | null;
  scorePoints: number;
  scopeSections: ExamResultScopeSection[];
  testID?: string;
  topicStats: ExamResultTopicStat[];
  totalPointsTarget: number;
  totalQuestionsAnswered: number;
  weakestTopicLabel: string | null;
};

export function ExamResultView({
  correctAnswersCount,
  durationSeconds,
  onClose,
  onNewAttempt,
  onPrimaryAction,
  onReviewAnswers,
  outcome,
  passPoints,
  scoreDelta,
  scorePoints,
  scopeSections,
  testID,
  topicStats,
  totalPointsTarget,
  totalQuestionsAnswered,
  weakestTopicLabel,
}: ExamResultViewProps) {
  const { t } = useTranslation();
  const { accents, background, colors } = useTheme();
  const passed = outcome === "passed";
  const isPositiveResult = passed;
  const resultAccent = isPositiveResult ? accents.green : accents.red;
  const styles = useStyles({
    scoreColor: resultAccent.fill,
    statusBadgeColor: resultAccent.fill,
  });
  const durationParts = formatExamDurationParts(durationSeconds);
  const scrollY = useSharedValue(0);
  const handleScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, TOP_FADE_RAMP],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const title =
    outcome === "passed"
      ? t("exam.resultPassedTitle")
      : outcome === "failed"
        ? t("exam.resultFailedTitle")
        : t(`exam.outcomes.${outcome}.title`);

  const primaryLabel = isPositiveResult
    ? t("exam.resultFinishCta")
    : t("exam.workOnMistakesCta");

  const whatsNextBody = isPositiveResult
    ? t("exam.whatsNextPassedBody")
    : weakestTopicLabel
      ? t("exam.whatsNextFailedBody", { topic: weakestTopicLabel })
      : t("exam.whatsNextFailedBodyGeneric");

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        testID={testID}
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="close"
            accessibilityLabel={t("common.close")}
            onPress={onClose}
          />
        </View>

        <View style={styles.scrollArea}>
          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.statusBadge}>
                <Icon
                  name={isPositiveResult ? "check" : "close"}
                  size={40}
                  color={colors.white}
                />
              </View>

              <CText style={styles.title}>{title}</CText>
              <CText style={styles.passThreshold}>
                {t("exam.passThresholdLine", { pass: passPoints })}
              </CText>
              <CText style={styles.score}>
                {t("exam.scoreSlashTotal", {
                  score: scorePoints,
                  total: totalPointsTarget,
                })}
              </CText>

              {scoreDelta ? (
                <View
                  style={[
                    styles.deltaBadge,
                    scoreDelta.percentPoints > 0
                      ? styles.deltaBadgePositive
                      : styles.deltaBadgeNegative,
                  ]}
                >
                  <CText
                    style={[
                      styles.deltaBadgeText,
                      scoreDelta.percentPoints > 0
                        ? styles.deltaBadgeTextPositive
                        : styles.deltaBadgeTextNegative,
                    ]}
                  >
                    {scoreDelta.percentPoints > 0
                      ? t("exam.deltaBetter", {
                          percent: Math.abs(scoreDelta.percentPoints),
                        })
                      : t("exam.deltaWorse", {
                          percent: Math.abs(scoreDelta.percentPoints),
                        })}
                  </CText>
                </View>
              ) : null}

              <CText style={styles.statLine}>
                {t("exam.correctAnswersLine", {
                  correct: correctAnswersCount,
                  total: totalQuestionsAnswered,
                })}
              </CText>

              <View style={styles.timeRow}>
                <CText style={styles.statLine}>
                  {t("exam.examTimeLine", {
                    minutes: durationParts.minutes,
                    seconds: durationParts.seconds,
                  })}
                </CText>
                {isPositiveResult ? (
                  <Icon name="cup" size={16} color={accents.amber.fill} />
                ) : null}
              </View>
            </View>

            {topicStats.length > 0 ? (
              <View style={styles.card}>
                {topicStats.map((stat) => (
                  <TopicProgressRow key={stat.topicId} stat={stat} />
                ))}
              </View>
            ) : null}

            {scopeSections.length > 0 ? (
              <View style={styles.card}>
                {scopeSections.map((section) => (
                  <ScopeQuestionsBlock
                    key={section.scope}
                    section={section}
                    title={
                      section.scope === "base"
                        ? t("exam.baseQuestionsTitle")
                        : t("exam.specialistQuestionsTitle")
                    }
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <CText style={styles.whatsNextTitle}>
                {t("exam.whatsNextTitle")}
              </CText>
              <CText style={styles.whatsNextBody}>{whatsNextBody}</CText>
            </View>
          </Animated.ScrollView>

          <Animated.View
            pointerEvents="none"
            style={[styles.topFade, topFadeStyle]}
          >
            <LinearGradient
              colors={[background.start, background.transparent]}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={styles.footerWrap}>
          <LinearGradient
            colors={[background.transparent, background.end]}
            end={{ x: 0.5, y: 1 }}
            locations={[0, 0.4]}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            style={styles.footerFade}
          />
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={onPrimaryAction}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <CText style={styles.primaryButtonText}>{primaryLabel}</CText>
            </Pressable>

            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onReviewAnswers}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="checkmark" size={20} color={colors.ink2} />
                <CText style={styles.secondaryButtonText}>
                  {t("exam.answersCta")}
                </CText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={onNewAttempt}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="replay" size={20} color={colors.ink2} />
                <CText style={styles.secondaryButtonText}>
                  {t("exam.newAttemptCta")}
                </CText>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function TopicProgressRow({
  stat,
}: {
  stat: ExamResultTopicStat;
}) {
  const { accents, colors } = useTheme();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const styles = useStyles();
  const accentKey = getProgressBarAccent(stat.percent);
  const fillColor = accents[accentKey as AppThemeAccent].fill;

  return (
    <View style={styles.topicRow}>
      <CText style={styles.topicLabel} numberOfLines={1}>
        {getQuestionTopicTitle(stat.topicId, preferredLocale)}
      </CText>
      <View style={styles.topicMeter}>
        <View style={styles.topicTrack}>
          <View
            style={[
              styles.topicFill,
              {
                width: `${Math.max(0, Math.min(100, stat.percent))}%`,
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>
        <CText style={styles.topicPercent}>{stat.percent}%</CText>
      </View>
    </View>
  );
}

function ScopeQuestionsBlock({
  section,
  title,
}: {
  section: ExamResultScopeSection;
  title: string;
}) {
  const styles = useStyles();

  return (
    <View style={styles.scopeBlock}>
      <View style={styles.scopeHeader}>
        <CText style={styles.scopeTitle}>{title}</CText>
        <CText style={styles.scopeCount}>
          {section.correctCount} / {section.totalCount}
        </CText>
      </View>
      <View style={styles.chipGrid}>
        {section.questions.map((question) => (
          <QuestionResultChip key={question.questionSourceId} question={question} />
        ))}
      </View>
    </View>
  );
}

function QuestionResultChip({
  question,
}: {
  question: ExamResultQuestionChip;
}) {
  const { accents, colors } = useTheme();
  const styles = useStyles();

  const palette =
    question.status === "correct"
      ? {
          backgroundColor: accents.green.soft,
          color: accents.green.ink,
        }
      : question.status === "wrong"
        ? {
            backgroundColor: accents.red.soft,
            color: accents.red.ink,
          }
        : {
            backgroundColor: colors.surface2,
            color: colors.ink3,
          };

  return (
    <View style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
      <CText style={[styles.chipText, { color: palette.color }]}>
        {question.number}
      </CText>
      {question.isBookmarked ? (
        <View style={styles.bookmarkFlag}>
          <Icon name="stateActive" size={12} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

export function ExamResultCenteredState({
  actionLabel,
  actionTestID,
  description,
  onAction,
  testID,
  title,
}: {
  actionLabel?: string;
  actionTestID?: string;
  description: string;
  onAction?: () => void;
  testID?: string;
  title: string;
}) {
  const styles = useStyles();

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        testID={testID}
      >
        <StatusBar style="dark" />
        <View style={styles.centeredState}>
          <CText style={styles.centeredTitle}>{title}</CText>
          <CText style={styles.centeredBody}>{description}</CText>
          {actionLabel && onAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={onAction}
              testID={actionTestID}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.centeredAction,
                pressed ? styles.pressed : null,
              ]}
            >
              <CText style={styles.primaryButtonText}>{actionLabel}</CText>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({
  scoreColor,
  statusBadgeColor,
}: {
  scoreColor?: string;
  statusBadgeColor?: string;
} = {}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      header: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(8),
      },
      scrollArea: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(160),
        gap: spacing.exact(8),
      },
      topFade: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: spacing.exact(48),
      },
      hero: {
        alignItems: "center",
        gap: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      statusBadge: {
        width: spacing.exact(80),
        height: spacing.exact(80),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: statusBadgeColor ?? accents.green.fill,
        marginBottom: spacing.exact(8),
      },
      title: {
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -0.64,
        textAlign: "center",
        color: colors.ink,
      },
      passThreshold: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.ink2,
      },
      score: {
        fontSize: responsiveFont(40),
        lineHeight: responsiveFont(40),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -0.8,
        textAlign: "center",
        color: scoreColor ?? accents.green.fill,
        marginTop: spacing.exact(0),
      },
      deltaBadge: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(8),
        paddingVertical: spacing.exact(4),
      },
      deltaBadgePositive: {
        backgroundColor: accents.green.soft,
      },
      deltaBadgeNegative: {
        backgroundColor: accents.red.soft,
      },
      deltaBadgeText: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
      },
      deltaBadgeTextPositive: {
        color: accents.green.ink,
      },
      deltaBadgeTextNegative: {
        color: accents.red.ink,
      },
      statLine: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.ink,
      },
      timeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(4),
      },
      card: {
        borderRadius: radius.xxl,
        backgroundColor: colors.surface,
        padding: spacing.exact(16),
        gap: spacing.exact(12),
      },
      topicRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      topicLabel: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      topicMeter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      topicTrack: {
        flex: 1,
        height: spacing.exact(4),
        borderRadius: radius.pill,
        backgroundColor: colors.surface2,
        overflow: "hidden",
      },
      topicFill: {
        height: "100%",
        borderRadius: radius.pill,
      },
      topicPercent: {
        width: spacing.exact(40),
        textAlign: "right",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      scopeBlock: {
        gap: spacing.exact(8),
      },
      scopeHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      scopeTitle: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      scopeCount: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      chipGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.exact(4),
      },
      chip: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
      },
      chipText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
      },
      bookmarkFlag: {
        position: "absolute",
        top: -spacing.exact(2),
        right: -spacing.exact(2),
        width: spacing.exact(16),
        height: spacing.exact(16),
        borderRadius: radius.lg,
        backgroundColor: accents.amber.fill,
        alignItems: "center",
        justifyContent: "center",
      },
      whatsNextTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.16,
        color: colors.ink,
      },
      whatsNextBody: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink3,
      },
      footerWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
      },
      footerFade: {
        position: "absolute",
        left: 0,
        right: 0,
        top: -spacing.exact(24),
        height: spacing.exact(24),
      },
      footer: {
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
        gap: spacing.exact(8),
        backgroundColor: colors.background,
      },
      primaryButton: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        minHeight: spacing.exact(52),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(18),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 4,
      },
      primaryButtonText: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      secondaryRow: {
        flexDirection: "row",
      },
      secondaryButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      secondaryButtonText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      pressed: {
        opacity: 0.9,
      },
      centeredState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(24),
        gap: spacing.exact(8),
      },
      centeredTitle: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("medium"),
        letterSpacing: -0.2,
        textAlign: "center",
        color: colors.textPrimary,
      },
      centeredBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(22),
        fontFamily: getFontFamily("regular"),
        textAlign: "center",
        color: colors.textSecondary,
      },
      centeredAction: {
        marginTop: spacing.exact(16),
        alignSelf: "stretch",
      },
    })
  );
}
