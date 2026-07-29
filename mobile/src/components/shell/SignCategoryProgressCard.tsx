import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { DualColorProgressBar } from "./DualColorProgressBar";
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
  /** Flat row inside a parent card (Statistics Signs tab). */
  embedded?: boolean;
};

export function SignCategoryProgressCard({
  title,
  previewSign,
  progress,
  onPress,
  embedded = false,
}: SignCategoryProgressCardProps) {
  const theme = useTheme();
  const answered = progress.correct + progress.wrong;
  const styles = useStyles({ embedded });
  const showPreview = !embedded && previewSign != null;

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

        <DualColorProgressBar
          correct={progress.correct}
          wrong={progress.wrong}
          total={progress.total}
          height={4}
        />

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

      {showPreview && previewSign ? (
        <View style={styles.previewWrap} pointerEvents="none">
          <SignImage inset={0} sign={previewSign} size={56} />
        </View>
      ) : null}
    </Pressable>
  );
}

function useStyles({ embedded }: { embedded: boolean }) {
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
