import { View } from "react-native";

import { CText, useResponsiveStyles, type PercentageString } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { resolveTopicReadinessStatus } from "./TopicReadinessCard";

type StatisticsTopicProgressRowProps = {
  title: string;
  seen: number;
  total: number;
  progress: number;
};

export function StatisticsTopicProgressRow({
  title,
  seen,
  total,
  progress,
}: StatisticsTopicProgressRowProps) {
  const theme = useTheme();
  const normalized = Math.max(0, Math.min(progress, 100));
  const status = resolveTopicReadinessStatus(seen, normalized);
  const barColor =
    status === "good"
      ? theme.accents.green.fill
      : status === "normal"
        ? theme.accents.amber.fill
        : status === "bad"
          ? theme.accents.red.fill
          : theme.colors.track;
  const styles = useStyles({
    fillColor: barColor,
    fillWidth: `${normalized}%` as PercentageString,
  });

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <CText style={styles.title} numberOfLines={2}>
          {title}
        </CText>
        <CText style={styles.meta}>{`${seen} / ${total}`}</CText>
      </View>

      <View style={styles.barGroup}>
        <View style={styles.track}>
          {seen > 0 ? <View style={styles.fill} /> : null}
        </View>
        <CText style={styles.percent}>{`${normalized}%`}</CText>
      </View>
    </View>
  );
}

function useStyles({
  fillColor,
  fillWidth,
}: {
  fillColor: string;
  fillWidth: PercentageString;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    copy: {
      flex: 1,
      minWidth: spacing.exact(96),
      gap: spacing.xs,
    },
    title: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "500",
      color: colors.ink,
    },
    meta: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    barGroup: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    track: {
      flex: 1,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: fillColor,
    },
    percent: {
      width: spacing.exact(40),
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      textAlign: "right",
      color: colors.ink,
    },
  }));
}
