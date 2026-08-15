import { View } from "react-native";

import { CText, getFontFamily, useResponsiveStyles, type PercentageString } from "../../portable-ui";
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
        <CText style={styles.title}>{title}</CText>
        <CText style={styles.meta}>{`${seen} / ${total}`}</CText>
      </View>

      <View style={styles.barGroup}>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: normalized,
          }}
          style={styles.track}
        >
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
      alignItems: "flex-start",
      gap: spacing.exact(4),
    },
    copy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 0,
    },
    title: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("medium"),
      color: colors.ink,
    },
    meta: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.ink3,
    },
    barGroup: {
      width: spacing.exact(98),
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
    },
    track: {
      flex: 1,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: fillColor,
    },
    percent: {
      width: spacing.exact(34),
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      textAlign: "right",
      color: colors.ink,
    },
  }));
}
