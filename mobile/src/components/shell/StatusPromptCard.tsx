import { Pressable, Text, View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type StatusPromptCardProps = {
  eyebrow: string;
  title: string;
  onPress?: () => void;
};

export function StatusPromptCard({
  eyebrow,
  title,
  onPress,
}: StatusPromptCardProps) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconBox}>
        <CalendarIcon />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.trailing}>
        <View style={styles.chevron} />
      </View>
    </Pressable>
  );
}

function CalendarIcon() {
  const styles = useStyles();

  return (
    <View style={styles.icon}>
      <View style={styles.calBody} />
      <View style={styles.calHeader} />
      <View style={styles.calLegLeft} />
      <View style={styles.calLegRight} />
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: theme.accents.amber.fill,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    pressed: {
      opacity: 0.85,
    },
    iconBox: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
    },
    copy: {
      flex: 1,
      flexDirection: "column",
    },
    eyebrow: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkMuted,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    trailing: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
    },
    chevron: {
      width: spacing.exact(8),
      height: spacing.exact(8),
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderColor: theme.accents.amber.ink,
      transform: [{ rotate: "45deg" }],
    },
    icon: {
      width: spacing.exact(24),
      height: spacing.exact(24),
      alignItems: "center",
      justifyContent: "center",
    },
    calBody: {
      width: spacing.exact(18),
      height: spacing.exact(15),
      borderWidth: 2,
      borderColor: theme.accents.amber.ink,
      borderRadius: spacing.exact(3),
    },
    calHeader: {
      position: "absolute",
      top: spacing.exact(4),
      width: spacing.exact(18),
      height: spacing.exact(4),
      backgroundColor: theme.accents.amber.ink,
    },
    calLeg: {
      position: "absolute",
      top: spacing.exact(1),
      width: spacing.exact(2),
      height: spacing.exact(4),
      borderRadius: spacing.exact(1),
      backgroundColor: theme.accents.amber.ink,
    },
    calLegLeft: {
      position: "absolute",
      top: spacing.exact(1),
      left: spacing.exact(6),
      width: spacing.exact(2),
      height: spacing.exact(4),
      borderRadius: spacing.exact(1),
      backgroundColor: theme.accents.amber.ink,
    },
    calLegRight: {
      position: "absolute",
      top: spacing.exact(1),
      right: spacing.exact(6),
      width: spacing.exact(2),
      height: spacing.exact(4),
      borderRadius: spacing.exact(1),
      backgroundColor: theme.accents.amber.ink,
    },
  }));
}
