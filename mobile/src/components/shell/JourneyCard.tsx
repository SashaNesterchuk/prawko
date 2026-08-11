import { Pressable, View } from "react-native";

import { CText, getFontFamily, useResponsiveStyles, type PercentageString } from "../../portable-ui";

type JourneyCardProps = {
  eyebrow: string;
  title: string;
  sectionLabel: string;
  progress: number;
  nextLabel: string;
  nextValue: string;
  buttonLabel: string;
  onPress?: () => void;
};

export function JourneyCard({
  eyebrow,
  title,
  sectionLabel,
  progress,
  nextLabel,
  nextValue,
  buttonLabel,
  onPress,
}: JourneyCardProps) {
  const clamped = Math.max(0, Math.min(progress, 100));
  const styles = useStyles({ progressWidth: `${clamped}%` as PercentageString });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.headerGradient} />
        <View style={styles.eyebrowRow}>
          <BookIcon />
          <CText style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </CText>
        </View>

        <CText style={styles.title} numberOfLines={2}>
          {title}
        </CText>

        <View style={styles.metaRow}>
          <CText style={styles.metaText}>{sectionLabel}</CText>
          <CText style={styles.metaText}>{`${Math.round(clamped)}%`}</CText>
        </View>

        <View style={styles.track}>
          <View style={styles.fill} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.nextCopy}>
          <CText style={styles.nextLabel} numberOfLines={1}>
            {nextLabel}
          </CText>
          <CText style={styles.nextValue} numberOfLines={1}>
            {nextValue}
          </CText>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.pressed : null,
          ]}
        >
          <CText style={styles.buttonLabel}>{buttonLabel}</CText>
          <View style={styles.chevron} />
        </Pressable>
      </View>
    </View>
  );
}

function BookIcon() {
  const styles = useStyles();

  return (
    <View style={styles.bookIcon}>
      <View style={styles.bookPage} />
      <View style={styles.bookPage} />
    </View>
  );
}

function useStyles({
  progressWidth,
}: {
  progressWidth?: PercentageString;
} = {}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      flexDirection: "column",
      borderRadius: radius.xl,
      backgroundColor: colors.white,
      overflow: "hidden",
      shadowColor: colors.shadowWarm,
      shadowOpacity: 0.07,
      shadowRadius: spacing.exact(5),
      shadowOffset: { width: 0, height: spacing.exact(4) },
      elevation: 3,
    },
    header: {
      width: "100%",
      flexDirection: "column",
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: theme.accents.green.fill,
      overflow: "hidden",
    },
    headerGradient: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.accents.green.ink,
      opacity: 0.38,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    eyebrow: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.16,
      color: colors.white,
    },
    title: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("bold"),
      letterSpacing: -0.48,
      color: colors.white,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    metaText: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.white,
      opacity: 0.9,
    },
    track: {
      width: "100%",
      height: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.glassSoft,
      overflow: "hidden",
    },
    fill: {
      width: progressWidth ?? "100%",
      height: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.white,
    },
    footer: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.lg,
    },
    nextCopy: {
      flex: 1,
      flexDirection: "column",
      gap: spacing.xs,
    },
    nextLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkMuted,
    },
    nextValue: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.ink,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.accents.blue.soft,
    },
    pressed: {
      opacity: 0.85,
    },
    buttonLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      color: theme.accents.blue.ink,
    },
    chevron: {
      width: spacing.exact(7),
      height: spacing.exact(7),
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderColor: theme.accents.blue.ink,
      transform: [{ rotate: "45deg" }],
    },
    bookIcon: {
      width: spacing.exact(24),
      height: spacing.exact(24),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(2),
    },
    bookPage: {
      width: spacing.exact(8),
      height: spacing.exact(16),
      borderWidth: 1.5,
      borderColor: colors.white,
      borderRadius: 1.5,
    },
  }));
}
