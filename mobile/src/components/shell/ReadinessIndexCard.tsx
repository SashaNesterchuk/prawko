import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { useResponsiveFonts, useResponsiveStyles } from "../../portable-ui";
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
   * Signed 7-day readiness change in percentage points.
   * Hidden when null/undefined. Zero shows a flat (neutral) badge when a label
   * is provided.
   */
  weekChangePercent?: number | null;
  weekChangeLabel?: string;
  empty?: boolean;
  onPress?: () => void;
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
  onPress,
}: ReadinessIndexCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const clamped = Math.max(0, Math.min(progress, 100));
  const ringColor = empty
    ? theme.colors.track
    : resolveReadinessRingColor(clamped, theme.accents);
  const styles = useStyles({ ringColor });
  const showWeekChange =
    !empty && weekChangePercent != null && Boolean(weekChangeLabel);
  const isWeekFlat = weekChangePercent === 0;
  const isWeekUp = (weekChangePercent ?? 0) > 0;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <ProgressRing progress={empty ? 0 : clamped} color={ringColor}>
        {empty ? (
          <Icon
            color={theme.accents.green.fill}
            name="start"
            size={responsiveFont(40)}
          />
        ) : (
          <Text style={styles.ringValue}>{`${Math.round(clamped)}%`}</Text>
        )}
      </ProgressRing>

      {empty ? (
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>{title}</Text>
          {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
          {detailsLabel ? (
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>{detailsLabel}</Text>
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
                <Text style={styles.levelTitle}>{levelLabel}</Text>
              ) : null}
              <Text style={styles.levelSubtitle}>{title}</Text>
            </View>

            {showWeekChange ? (
              <View
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
                <Text
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
                </Text>
              </View>
            ) : null}
          </View>

          {coveredCountLabel ? (
            <View style={styles.coveredBlock}>
              <Text style={styles.coveredCount}>{coveredCountLabel}</Text>
              {coveredCaption ? (
                <Text style={styles.coveredCaption}>{coveredCaption}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function useStyles({ ringColor }: { ringColor: string }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.surface,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    pressed: {
      opacity: 0.7,
    },
    ringValue: {
      fontSize: responsiveFont(28),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.56,
      color: ringColor,
      textAlign: "center",
    },
    emptyCopy: {
      flex: 1,
      justifyContent: "center",
      gap: 0,
    },
    emptyTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    emptySubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
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
      fontWeight: "400",
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
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.ink,
    },
    levelSubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
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
      fontWeight: "500",
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
      fontWeight: "500",
      color: colors.ink,
    },
    coveredCaption: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkSecondary,
    },
  }));
}
