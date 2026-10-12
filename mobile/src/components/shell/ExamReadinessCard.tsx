import { Pressable, View, useWindowDimensions } from "react-native";
import { Icon } from "../icons";
import { CText, useResponsiveStyles, type PercentageString } from "../../portable-ui";
import { formatPreparationPercent } from "../../features/home/preparation-progress";

type ExamReadinessCardProps = {
  title: string;
  progress: number;
  correctPercent: number;
  wrongPercent: number;
  correctLabel: string;
  mistakesLabel: string;
  loading: boolean;
  onPress: () => void;
  onMistakesPress?: () => void;
  testID: string;
};

export function ExamReadinessCard({ title, progress, correctPercent, wrongPercent,
  correctLabel, mistakesLabel, loading, onPress, onMistakesPress, testID }: ExamReadinessCardProps) {
  const styles = useStyles();
  return (
    <Pressable testID={loading ? `${testID}-loading` : testID} accessible={false}
      onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      {loading ? (
        <View style={styles.skeleton}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonBar]} />
          <View style={[styles.skeletonLine, styles.skeletonCaption]} />
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <CText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.title} semiBold>{title}</CText>
            <CText testID={`${testID}-percent`} style={styles.percent} bold>{formatPreparationPercent(progress)}</CText>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }} style={styles.track}>
            <View style={[styles.fill, { width: `${correctPercent}%` as PercentageString }]} />
            <View style={[styles.wrongFill, { width: `${wrongPercent}%` as PercentageString }]} />
          </View>
          <View style={styles.footer}>
            <CText testID={`${testID}-correct`} numberOfLines={1} style={styles.covered}>{correctLabel}</CText>
            <Pressable testID={`${testID}-mistakes`} accessibilityRole={onMistakesPress ? "button" : undefined}
              onPress={(event) => { event.stopPropagation(); (onMistakesPress ?? onPress)(); }} hitSlop={8}
              style={({ pressed }) => [styles.mistakesAction, pressed && onMistakesPress ? styles.pressed : null]}>
              <CText numberOfLines={1} style={styles.mistakes}>{mistakesLabel}</CText>
              {onMistakesPress ? <Icon testID={`${testID}-mistakes-chevron`} name="chevron" size={16} color={styles.mistakes.color as string} /> : null}
            </Pressable>
          </View>
        </>
      )}
    </Pressable>
  );
}

function useStyles() {
  const { width } = useWindowDimensions();
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: Math.max(0, width - spacing.exact(32)),
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
      minWidth: 0,
      flexShrink: 1,
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
      flexDirection: "row",
    },
    fill: {
      height: "100%",
      backgroundColor: theme.accents.green.fill,
    },
    wrongFill: {
      height: "100%",
      backgroundColor: theme.accents.red.fill,
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
    mistakesAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
    },
    mistakes: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: theme.accents.red.ink,
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
