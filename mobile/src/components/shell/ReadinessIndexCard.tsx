import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { ProgressRing } from "./ProgressRing";

export type ReadinessLevel = "low" | "mid" | "high";

type ReadinessIndexCardProps = {
  progress: number;
  title: string;
  /** Empty-state description, or unused when populated. */
  subtitle?: string;
  levelLabel?: string;
  coveredCountLabel?: string;
  coveredCaption?: string;
  detailsLabel?: string;
  /**
   * Signed readiness change in percentage points over the adaptive period.
   * Hidden when null/undefined or zero.
   */
  weekChangePercent?: number | null;
  weekChangeLabel?: string;
  empty?: boolean;
  /** First launch only: nothing is known yet, not even a persisted snapshot. */
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function resolveReadinessLevel(progress: number): ReadinessLevel {
  if (progress >= 85) {
    return "high";
  }

  if (progress >= 40) {
    return "mid";
  }

  return "low";
}

export function resolveReadinessRingColor(
  progress: number,
  accents: ReturnType<typeof useTheme>["accents"]
) {
  const level = resolveReadinessLevel(progress);

  if (level === "high") {
    return accents.green.fill;
  }

  if (level === "mid") {
    return accents.amber.fill;
  }

  return accents.red.fill;
}

export function ReadinessIndexCard({
  progress,
  title,
  subtitle,
  levelLabel,
  coveredCountLabel,
  coveredCaption,
  detailsLabel,
  weekChangePercent,
  weekChangeLabel,
  empty = false,
  loading = false,
  onPress,
  testID,
}: ReadinessIndexCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const clamped = Math.max(0, Math.min(progress, 100));
  const isNeutral = loading || empty;
  const ringColor = isNeutral
    ? theme.colors.track
    : resolveReadinessRingColor(clamped, theme.accents);
  const styles = useStyles({ ringColor });
  const isPressable = Boolean(onPress) && !loading;
  const showWeekChange =
    !empty &&
    weekChangePercent != null &&
    weekChangePercent !== 0 &&
    Boolean(weekChangeLabel);
  const isWeekFlat = weekChangePercent === 0;
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
      <View style={styles.cardInner}>
        <ProgressRing progress={isNeutral ? 0 : clamped} color={ringColor}>
          {loading ? null : empty ? (
            <Icon
              color={theme.accents.green.fill}
              name="start"
              size={responsiveFont(40)}
            />
          ) : (
            <CText style={styles.ringValue} bold>
              <CText style={styles.ringValueNumber} bold>{Math.round(clamped)}</CText>
              <CText style={styles.ringValuePercent} bold>%</CText>
            </CText>
          )}
        </ProgressRing>

        {loading ? (
          <View style={styles.copy}>
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
            <View style={[styles.skeletonLine, styles.skeletonCaption]} />
          </View>
        ) : empty ? (
          <View style={styles.emptyCopy}>
            <CText style={styles.emptyTitle} semiBold>{title}</CText>
            {subtitle ? <CText style={styles.emptySubtitle}>{subtitle}</CText> : null}
            {detailsLabel ? (
              <View style={styles.detailsRow}>
                <CText style={styles.detailsLabel}>{detailsLabel}</CText>
                <Icon
                  color={theme.accents.blue.ink}
                  name="chevron"
                  size={responsiveFont(20)}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.copy}>
            <View style={styles.topBlock}>
              <View style={styles.levelBlock}>
                {levelLabel ? (
                  <CText style={styles.levelTitle} semiBold>{levelLabel}</CText>
                ) : null}
                <CText style={styles.levelSubtitle}>{title}</CText>
              </View>

              {showWeekChange ? (
                <View
                  testID={testID ? `${testID}-week-change` : undefined}
                  style={[
                    styles.weekBadge,
                    isWeekFlat
                      ? styles.weekBadgeFlat
                      : isWeekUp
                        ? styles.weekBadgeUp
                        : styles.weekBadgeDown,
                  ]}
                >
                  {!isWeekFlat ? (
                    <Icon
                      color={
                        isWeekUp
                          ? theme.accents.green.ink
                          : theme.accents.red.ink
                      }
                      name="arrow"
                      size={responsiveFont(12)}
                      style={isWeekUp ? styles.arrowUp : undefined}
                    />
                  ) : null}
                  <CText
                    style={[
                      styles.weekBadgeLabel,
                      isWeekFlat
                        ? styles.weekBadgeLabelFlat
                        : isWeekUp
                          ? styles.weekBadgeLabelUp
                          : styles.weekBadgeLabelDown,
                    ]}
                  >
                    {weekChangeLabel}
                  </CText>
                </View>
              ) : null}
            </View>

            {coveredCountLabel ? (
              <View style={styles.coveredBlock}>
                <CText style={styles.coveredCount} medium>{coveredCountLabel}</CText>
                {coveredCaption ? (
                  <CText style={styles.coveredCaption} regular>{coveredCaption}</CText>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function useStyles({ ringColor }: { ringColor: string }) {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      borderRadius: radius.xxl,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    cardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.7,
    },
    ringValue: {
      textAlign: "center",
      color: ringColor,
    },
    ringValueNumber: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      color: ringColor,
    },
    ringValuePercent: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      color: ringColor,
    },
    emptyCopy: {
      flex: 1,
      justifyContent: "center",
      gap: 0,
    },
    emptyTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.ink,
    },
    emptySubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
    },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    detailsLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      color: theme.accents.blue.ink,
    },
    copy: {
      flex: 1,
      alignSelf: "stretch",
      justifyContent: "center",
      gap: 0,
    },
    topBlock: {
      flex: 1,
      justifyContent: "flex-start",
      gap: spacing.exact(4),
    },
    levelBlock: {
      gap: 0,
    },
    levelTitle: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      color: colors.ink,
    },
    levelSubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkSecondary,
    },
    weekBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(2),
      paddingVertical: spacing.exact(2),
      paddingHorizontal: spacing.exact(4),
      borderRadius: radius.pill,
    },
    weekBadgeUp: {
      backgroundColor: theme.accents.green.soft,
    },
    weekBadgeDown: {
      backgroundColor: theme.accents.red.soft,
    },
    weekBadgeFlat: {
      backgroundColor: colors.track,
    },
    weekBadgeLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(12),
      fontFamily: getFontFamily("medium"),
    },
    weekBadgeLabelUp: {
      color: theme.accents.green.ink,
    },
    weekBadgeLabelDown: {
      color: theme.accents.red.ink,
    },
    weekBadgeLabelFlat: {
      color: colors.inkSecondary,
    },
    arrowUp: {
      transform: [{ rotate: "180deg" }],
    },
    coveredBlock: {
      gap: 0,
    },
    coveredCount: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink,
    },
    coveredCaption: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkSecondary,
    },
    skeletonLine: {
      backgroundColor: colors.track,
      borderRadius: radius.pill,
    },
    skeletonTitle: {
      width: "60%",
      height: responsiveFont(20),
      marginBottom: spacing.exact(8),
    },
    skeletonSubtitle: {
      width: "80%",
      height: responsiveFont(12),
      marginBottom: spacing.exact(12),
    },
    skeletonCaption: {
      width: "45%",
      height: responsiveFont(12),
    },
  }));
}
