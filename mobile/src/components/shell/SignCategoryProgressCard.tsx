import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import {
  useResponsiveStyles,
  type PercentageString,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { SignCategoryIcon } from "../../features/road-signs/SignCategoryIcon";
import type { RoadSignCategory } from "../../features/road-signs/types";

export type SignCategoryProgress = {
  correct: number;
  wrong: number;
  seen: number;
  total: number;
};

type SignCategoryProgressCardProps = {
  category: RoadSignCategory;
  title: string;
  progress: SignCategoryProgress;
  onPress?: () => void;
  /** Flat row inside a parent card (Statistics Signs tab). */
  embedded?: boolean;
};

export function SignCategoryProgressCard({
  category,
  title,
  progress,
  onPress,
  embedded = false,
}: SignCategoryProgressCardProps) {
  const theme = useTheme();
  const answered = progress.correct + progress.wrong;
  const fillPercent =
    progress.total > 0
      ? Math.min(100, (answered / progress.total) * 100)
      : 0;
  const styles = useStyles({
    embedded,
    fillWidth: `${fillPercent}%` as PercentageString,
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
          {answered > 0 ? <View style={styles.fill} /> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon
              color={theme.accents.green.fill}
              name="check"
              size={16}
            />
            <Text style={styles.statValue}>{progress.correct}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon
              color={theme.accents.red.fill}
              name="close"
              size={16}
            />
            <Text style={styles.statValue}>{progress.wrong}</Text>
          </View>
          <Text style={styles.fraction}>{`${answered} / ${progress.total}`}</Text>
        </View>
      </View>

      {!embedded ? (
        <View style={styles.previewWrap} pointerEvents="none">
          <SignCategoryIcon categoryId={category.id} size={56} />
        </View>
      ) : null}
    </Pressable>
  );
}

function useStyles({
  embedded,
  fillWidth,
}: {
  embedded: boolean;
  fillWidth: PercentageString;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(20),
      padding: embedded ? 0 : spacing.lg,
      borderRadius: embedded ? 0 : radius.lg,
      backgroundColor: embedded ? colors.transparent : colors.surface,
    },
    pressed: {
      opacity: 0.92,
    },
    content: {
      flex: 1,
      gap: spacing.exact(4),
    },
    title: {
      fontSize: responsiveFont(embedded ? 14 : 16),
      lineHeight: responsiveFont(embedded ? 20 : 24),
      fontWeight: embedded ? "500" : "600",
      letterSpacing: embedded ? 0 : -0.16,
      color: colors.ink,
    },
    track: {
      height: spacing.exact(4),
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
      overflow: "hidden",
    },
    fill: {
      width: fillWidth,
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.ink3,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.exact(4),
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      minWidth: spacing.exact(44),
    },
    statValue: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.ink2,
    },
    fraction: {
      flex: 1,
      textAlign: "right",
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.ink2,
    },
    previewWrap: {
      width: spacing.exact(56),
      height: spacing.exact(56),
      alignItems: "center",
      justifyContent: "center",
    },
  }));
}
