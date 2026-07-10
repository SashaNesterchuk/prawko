import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import {
  hexToRgba,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
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
  const spacing = useResponsiveSpacing();
  const accent = theme.accents[category.accent];
  const answered = progress.correct + progress.wrong;
  const percent =
    progress.total > 0
      ? Math.round((answered / progress.total) * 100)
      : 0;
  const styles = useStyles();
  const previewWidth = spacing.exact(72);
  const previewHeight = spacing.exact(92);
  const iconSize = spacing.exact(14);

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
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(percent, 100)}%`,
                backgroundColor: accent.fill,
              },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon
              color={theme.accents.green.ink}
              name="check"
              size={iconSize}
            />
            <Text style={styles.statValue}>{progress.correct}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon
              color={theme.accents.red.ink}
              name="close"
              size={iconSize}
            />
            <Text style={styles.statValue}>{progress.wrong}</Text>
          </View>
          <Text style={styles.fraction}>{`${answered} / ${progress.total}`}</Text>
        </View>
      </View>

      {previewSign ? (
        <View style={styles.previewWrap} pointerEvents="none">
          <SignImage
            height={previewHeight}
            inset={0}
            sign={previewSign}
            width={previewWidth}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => {
    const previewSlotWidth = spacing.exact(88);
    const cardPaddingRight = previewSlotWidth + spacing.sm;

    return {
      card: {
        position: "relative",
        minHeight: spacing.exact(112),
        paddingVertical: spacing.lg,
        paddingLeft: spacing.lg,
        paddingRight: cardPaddingRight,
        borderRadius: radius.xl,
        backgroundColor: hexToRgba(colors.white, 0.7),
        overflow: "visible",
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: spacing.exact(6),
        shadowOffset: { width: 0, height: spacing.exact(2) },
        elevation: 1,
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
        height: "100%",
        borderRadius: radius.pill,
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
        right: spacing.exact(-4),
        top: spacing.sm,
        bottom: spacing.sm,
        width: previewSlotWidth,
        alignItems: "center",
        justifyContent: "center",
      },
    };
  });
}
