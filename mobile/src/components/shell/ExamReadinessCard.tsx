import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ExamReadinessCardProps = {
  title: string;
  progress: number;
  coveredLabel?: string;
  weekChangePercent?: number | null;
  weekChangeLabel?: string;
  detailsLabel?: string;
  empty?: boolean;
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function ExamReadinessCard({
  title,
  progress,
  coveredLabel,
  weekChangePercent,
  weekChangeLabel,
  detailsLabel,
  empty = false,
  loading = false,
  onPress,
  testID,
}: ExamReadinessCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const clamped = Math.max(0, Math.min(progress, 100));
  const shownProgress = loading || empty ? 0 : clamped;
  const fillWidth = `${shownProgress}%` as PercentageString;
  const styles = useStyles({ fillWidth });
  const isPressable = Boolean(onPress) && !loading;
  const showWeekChange =
    !empty &&
    !loading &&
    weekChangePercent != null &&
    weekChangePercent !== 0 &&
    Boolean(weekChangeLabel);
  const isWeekUp = (weekChangePercent ?? 0) > 0;

  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      disabled={!isPressable}
      onPress={isPressable ? onPress : undefined}
      testID={loading && testID ? `${testID}-loading` : testID}
      style={({ pressed }) => [
        styles.card,
        pressed && isPressable ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <View style={styles.skeleton}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonBar]} />
          <View style={[styles.skeletonLine, styles.skeletonCaption]} />
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <CText numberOfLines={2} style={styles.title} semiBold>
              {title}
            </CText>
            <CText style={styles.percent} bold>
              {Math.round(shownProgress)}%
            </CText>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(shownProgress) }}
            style={styles.track}
          >
            {shownProgress > 0 ? <View style={styles.fill} /> : null}
          </View>
          <View style={styles.footer}>
            {empty ? (
              detailsLabel ? (
                <CText style={styles.details}>{detailsLabel}</CText>
              ) : (
                <View />
              )
            ) : (
              <CText style={styles.covered}>{coveredLabel}</CText>
            )}
            {showWeekChange ? (
              <View
                style={styles.change}
                testID={testID ? `${testID}-week-change` : undefined}
              >
                <Icon
                  color={
                    isWeekUp ? theme.accents.green.ink : theme.accents.red.ink
                  }
                  name="arrow"
                  size={responsiveFont(12)}
                  style={isWeekUp ? styles.arrowUp : undefined}
                />
                <CText style={isWeekUp ? styles.changeUp : styles.changeDown}>
                  {weekChangeLabel}
                </CText>
              </View>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

function useStyles({ fillWidth }: { fillWidth: PercentageString }) {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.xxxl,
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(16),
      gap: spacing.exact(10),
      ...elevation.card,
    },
    pressed: {
      opacity: 0.7,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.exact(12),
    },
    title: {
      flex: 1,
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(24),
      color: colors.ink,
    },
    percent: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(24),
      color: colors.ink,
    },
    track: {
      height: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.exact(8),
    },
    covered: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: colors.inkSecondary,
    },
    details: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: theme.accents.blue.ink,
    },
    change: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(2),
    },
    changeUp: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: theme.accents.green.ink,
    },
    changeDown: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: theme.accents.red.ink,
    },
    arrowUp: {
      transform: [{ rotate: "180deg" }],
    },
    skeleton: {
      gap: spacing.exact(10),
    },
    skeletonLine: {
      backgroundColor: colors.track,
      borderRadius: radius.pill,
    },
    skeletonTitle: {
      width: "70%",
      height: responsiveFont(20),
    },
    skeletonBar: {
      width: "100%",
      height: spacing.exact(8),
    },
    skeletonCaption: {
      width: "40%",
      height: responsiveFont(14),
    },
  }));
}
