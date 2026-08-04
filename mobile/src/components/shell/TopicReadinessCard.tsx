import { Pressable, Text, View } from "react-native";

import { useResponsiveStyles, type PercentageString } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type TopicReadinessStatus = "not_started" | "bad" | "normal" | "good";

type TopicReadinessCardProps = {
  title: string;
  seen: number;
  total: number;
  readiness?: number;
  mistakes?: number;
  correct?: number;
  wrong?: number;
  status?: TopicReadinessStatus;
  onPress?: () => void;
  testID?: string;
};

export function resolveTopicReadinessStatus(
  seen: number,
  readiness: number
): TopicReadinessStatus {
  if (seen <= 0) {
    return "not_started";
  }

  if (readiness >= 85) {
    return "good";
  }

  if (readiness >= 40) {
    return "normal";
  }

  return "bad";
}

export function TopicReadinessCard({
  title,
  seen,
  total,
  readiness,
  mistakes,
  correct,
  wrong,
  status,
  onPress,
  testID,
}: TopicReadinessCardProps) {
  const theme = useTheme();
  const normalizedReadiness = Math.max(0, Math.min(readiness ?? 0, 100));
  const resolvedStatus =
    status ?? resolveTopicReadinessStatus(seen, normalizedReadiness);
  const isStarted = resolvedStatus !== "not_started";
  const statusColors = getStatusColors(theme);
  const statusColor = isStarted ? statusColors[resolvedStatus] : null;
  const styles = useStyles({
    readinessFillColor: statusColor?.fill ?? theme.colors.track,
    readinessTextColor: statusColor?.ink ?? theme.colors.inkMuted,
    readinessWidth: `${normalizedReadiness}%` as PercentageString,
  });

  const resolvedWrong = wrong ?? mistakes ?? 0;
  const resolvedCorrect = correct ?? Math.max(0, seen - resolvedWrong);

  const body = (
    <View style={styles.inner}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.readinessValue}>{normalizedReadiness}%</Text>
      </View>

      <View style={styles.track}>
        {isStarted ? <View style={styles.fill} /> : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.statsGroup}>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statGood]}>✓</Text>
            <Text style={styles.footerLabel}>{resolvedCorrect}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statBad]}>✕</Text>
            <Text style={styles.footerLabel}>{resolvedWrong}</Text>
          </View>
        </View>
        <Text style={styles.footerLabel}>{`${seen} / ${total}`}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.card} testID={testID}>
      {body}
    </View>
  );
}

function getStatusColors(theme: ReturnType<typeof useTheme>) {
  return {
    bad: { fill: theme.accents.red.fill, ink: theme.accents.red.ink },
    normal: { fill: theme.accents.amber.fill, ink: theme.accents.amber.ink },
    good: { fill: theme.accents.green.fill, ink: theme.accents.green.ink },
  } satisfies Record<
    Exclude<TopicReadinessStatus, "not_started">,
    { fill: string; ink: string }
  >;
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
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.white,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.9,
    },
    inner: {
      flex: 1,
      flexDirection: "column",
      gap: spacing.xs,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.exact(10),
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    readinessValue: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "400",
      color: readinessTextColor,
    },
    track: {
      height: spacing.exact(4),
      width: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: readinessWidth,
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: readinessFillColor,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      gap: spacing.sm,
    },
    statsGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
    },
    statIcon: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "700",
    },
    statGood: {
      color: theme.accents.green.ink,
    },
    statBad: {
      color: theme.accents.red.ink,
    },
    footerLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkMuted,
    },
  }));
}
