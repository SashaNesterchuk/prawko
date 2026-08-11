import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { resolveMistakeRate } from "./mistakes-rate";

type MistakesOverviewCardProps = {
  title: string;
  wrongLabel: string;
  trainAllLabel: string;
  wrong: number;
  total: number;
  onTrainAll?: () => void;
  testID?: string;
};

export function MistakesOverviewCard({
  title,
  wrongLabel,
  trainAllLabel,
  wrong,
  total,
  onTrainAll,
  testID = "mistakes-overview-card",
}: MistakesOverviewCardProps) {
  const theme = useTheme();
  const mistakeRate = resolveMistakeRate(wrong, total);
  const styles = useStyles({
    fillWidth: `${mistakeRate}%` as PercentageString,
  });
  const trainLabel = trainAllLabel.replace(/\s*>\s*$/, "");

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <CText style={styles.title}>{title}</CText>
          <CText style={styles.rateValue}>{`${mistakeRate}%`}</CText>
        </View>

        <View style={styles.track}>
          {mistakeRate > 0 ? <View style={styles.fill} /> : null}
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsCopy}>
          <CText style={styles.statsLabel}>{wrongLabel}</CText>
          <View style={styles.statsValueRow}>
            <Icon color={theme.accents.red.fill} name="close" size={16} />
            <CText style={styles.statsValue}>{`${wrong} / ${total}`}</CText>
          </View>
        </View>

        {onTrainAll ? (
          <Pressable
            accessibilityRole="button"
            onPress={onTrainAll}
            style={({ pressed }) => [
              styles.trainButton,
              pressed ? styles.pressed : null,
            ]}
            testID="mistakes-train-all"
          >
            <CText style={styles.trainButtonLabel}>{trainLabel}</CText>
            <Icon color={theme.colors.ink2} name="chevron" size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function useStyles({ fillWidth }: { fillWidth: PercentageString }) {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
      card: {
        borderRadius: radius.xxl,
        backgroundColor: colors.white,
        overflow: "hidden",
        ...elevation.raised,
      },
      topSection: {
        gap: spacing.exact(4),
        paddingTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: spacing.md,
      },
      title: {
        flex: 1,
        fontSize: responsiveFont(24),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        letterSpacing: -0.48,
        color: colors.ink,
      },
      rateValue: {
        fontSize: responsiveFont(24),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("semiBold"),
        letterSpacing: -0.24,
        color: theme.accents.red.fill,
      },
      track: {
        height: spacing.exact(8),
        borderRadius: radius.pill,
        backgroundColor: colors.track,
        overflow: "hidden",
        marginTop: spacing.exact(4),
      },
      fill: {
        width: fillWidth,
        height: "100%",
        borderRadius: radius.pill,
        backgroundColor: theme.accents.red.fill,
      },
      footerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      },
      statsCopy: {
        flex: 1,
        gap: spacing.exact(4),
      },
      statsLabel: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.ink3,
      },
      statsValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(4),
      },
      statsValue: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
      trainButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(4),
        paddingVertical: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.paper,
      },
      trainButtonLabel: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      pressed: {
        opacity: 0.9,
      },
    })
  );
}
