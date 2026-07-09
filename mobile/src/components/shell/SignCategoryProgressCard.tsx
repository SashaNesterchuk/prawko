import { Pressable, Text, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign, RoadSignCategory } from "../../features/road-signs/types";

export type SignCategoryProgress = {
  correct: number;
  wrong: number;
  seen: number;
  total: number;
};

type SignCategoryProgressCardProps = {
  category: RoadSignCategory;
  title: string;
  previewSign?: RoadSign;
  progress: SignCategoryProgress;
  onPress?: () => void;
};

export function SignCategoryProgressCard({
  category,
  title,
  previewSign,
  progress,
  onPress,
}: SignCategoryProgressCardProps) {
  const theme = useTheme();
  const accent = theme.accents[category.accent];
  const answered = progress.correct + progress.wrong;
  const percent =
    progress.total > 0
      ? Math.round((answered / progress.total) * 100)
      : 0;
  const styles = useStyles({
    fillColor: accent.fill,
    fillWidth: `${Math.min(percent, 100)}%`,
  });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.track}>
          <View style={styles.fill} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statGood]}>✓</Text>
            <Text style={styles.statValue}>{progress.correct}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statIcon, styles.statBad]}>✕</Text>
            <Text style={styles.statValue}>{progress.wrong}</Text>
          </View>
          <Text style={styles.fraction}>{`${answered} / ${progress.total}`}</Text>
        </View>
      </View>

      {previewSign ? (
        <View style={styles.previewWrap} pointerEvents="none">
          <SignImage sign={previewSign} size={76} />
        </View>
      ) : null}
    </Pressable>
  );
}

function useStyles({
  fillColor,
  fillWidth,
}: {
  fillColor: string;
  fillWidth: string;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      position: "relative",
      minHeight: spacing.exact(108),
      paddingVertical: spacing.lg,
      paddingLeft: spacing.lg,
      paddingRight: spacing.exact(92),
      borderRadius: radius.xl,
      backgroundColor: colors.paper,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.92,
    },
    content: {
      gap: spacing.sm,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(22),
      fontWeight: "700",
      letterSpacing: -0.16,
      color: colors.ink,
      paddingRight: spacing.sm,
    },
    track: {
      height: spacing.exact(6),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: spacing.exact(6),
      borderRadius: radius.pill,
      backgroundColor: fillColor,
    },
    statsRow: {
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
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(16),
      fontWeight: "700",
    },
    statGood: {
      color: theme.accents.green.ink,
    },
    statBad: {
      color: theme.accents.red.ink,
    },
    statValue: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(16),
      fontWeight: "500",
      color: colors.inkSecondary,
    },
    fraction: {
      marginLeft: "auto",
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(16),
      fontWeight: "500",
      color: colors.inkSecondary,
    },
    previewWrap: {
      position: "absolute",
      right: spacing.md,
      top: 0,
      bottom: 0,
      width: spacing.exact(80),
      alignItems: "center",
      justifyContent: "center",
    },
  }));
}
