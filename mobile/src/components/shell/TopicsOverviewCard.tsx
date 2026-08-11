import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { CText, getFontFamily, useResponsiveStyles, type PercentageString } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { resolveTopicReadinessStatus } from "./TopicReadinessCard";

type TopicsOverviewCardProps = {
  readiness: number;
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  title?: string;
  answeredLabel?: string;
};

export function TopicsOverviewCard({
  readiness,
  answered,
  total,
  correct,
  wrong,
  title,
  answeredLabel,
}: TopicsOverviewCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const resolvedTitle =
    title ?? t("learn.overviewReadiness", { defaultValue: "Готовність" });
  const resolvedAnsweredLabel =
    answeredLabel ??
    t("learn.overviewTotalAnswers", { defaultValue: "Всього відповідей" });
  const clamped = Math.max(0, Math.min(readiness, 100));
  const status = resolveTopicReadinessStatus(answered, clamped);
  const statusColor =
    status === "not_started"
      ? { fill: theme.colors.track, ink: theme.colors.inkMuted }
      : status === "good"
        ? theme.accents.green
        : status === "normal"
          ? theme.accents.amber
          : theme.accents.red;
  const styles = useStyles({
    readinessFillColor: statusColor.fill,
    readinessTextColor: statusColor.ink,
    readinessWidth: `${clamped}%` as PercentageString,
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <CText style={styles.title}>{resolvedTitle}</CText>
        <CText style={styles.readinessValue}>{clamped}%</CText>
      </View>

      <View style={styles.track}>
        {answered > 0 ? <View style={styles.fill} /> : null}
      </View>

      <CText style={styles.answersLabel}>{resolvedAnsweredLabel}</CText>
      <CText style={styles.answersValue}>
        {`${answered} / ${total}`}
      </CText>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, styles.statIconGood]}>
            <CText style={styles.statIconLabel}>✓</CText>
          </View>
          <CText style={styles.statValue}>{correct}</CText>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, styles.statIconBad]}>
            <CText style={styles.statIconLabel}>✕</CText>
          </View>
          <CText style={styles.statValue}>{wrong}</CText>
        </View>
      </View>
    </View>
  );
}

function useStyles({
  readinessFillColor,
  readinessTextColor,
  readinessWidth,
}: {
  readinessFillColor: string;
  readinessTextColor: string;
  readinessWidth: PercentageString;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      gap: spacing.xs,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("bold"),
      letterSpacing: -0.48,
      color: colors.ink,
    },
    readinessValue: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.24,
      color: readinessTextColor,
    },
    track: {
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
      marginTop: spacing.xs,
    },
    fill: {
      width: readinessWidth,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: readinessFillColor,
    },
    answersLabel: {
      marginTop: spacing.sm,
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    answersValue: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    statIcon: {
      width: spacing.exact(18),
      height: spacing.exact(18),
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    statIconGood: {
      backgroundColor: theme.accents.green.soft,
    },
    statIconBad: {
      backgroundColor: theme.accents.red.soft,
    },
    statIconLabel: {
      fontSize: responsiveFont(10),
      lineHeight: responsiveFont(12),
      fontFamily: getFontFamily("bold"),
      color: colors.ink,
    },
    statValue: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink,
    },
  }));
}
