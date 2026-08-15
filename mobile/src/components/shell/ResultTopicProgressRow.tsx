import { View } from "react-native";

import { getProgressBarAccent } from "../../features/exam/exam-result-stats";
import {
  CText,
  getFontFamily,
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import type { AppThemeAccent } from "../../theme";

type ResultTopicProgressRowProps = {
  percent: number;
  title: string;
};

export function ResultTopicProgressRow({
  percent,
  title,
}: ResultTopicProgressRowProps) {
  const { accents } = useTheme();
  const normalized = Math.max(0, Math.min(Math.round(percent), 100));
  const fillColor = accents[getProgressBarAccent(normalized) as AppThemeAccent].fill;
  const styles = useStyles({
    fillColor,
    fillWidth: `${normalized}%` as PercentageString,
  });

  return (
    <View style={styles.row} testID="result-topic-progress-row">
      <CText style={styles.title}>{title}</CText>
      <View style={styles.meter}>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: normalized,
          }}
          style={styles.track}
        >
          {normalized > 0 ? <View style={styles.fill} /> : null}
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
  return useResponsiveStyles(
    ({ colors, radius, responsiveFont, spacing }) => ({
      row: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.exact(4),
      },
      title: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      meter: {
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
        textAlign: "right",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
    })
  );
}
