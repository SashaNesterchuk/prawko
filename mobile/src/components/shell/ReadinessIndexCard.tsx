import { Pressable, Text, View } from "react-native";

import { Icon } from "../icons";
import { useResponsiveFonts, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { ProgressRing } from "./ProgressRing";

type ReadinessIndexCardProps = {
  progress: number;
  title: string;
  subtitle: string;
  ringLabel: string;
  detailsLabel?: string;
  ringColor?: string;
  onPress?: () => void;
  onPressDetails?: () => void;
};

export function ReadinessIndexCard({
  progress,
  title,
  subtitle,
  ringLabel,
  detailsLabel,
  ringColor,
  onPress,
  onPressDetails,
}: ReadinessIndexCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(progress, 100));
  const handlePress = onPress ?? onPressDetails;

  return (
    <Pressable
      accessibilityRole={handlePress ? "button" : undefined}
      disabled={!handlePress}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && handlePress ? styles.pressed : null,
      ]}
    >
      <ProgressRing progress={clamped} color={ringColor}>
        <Text style={styles.ringValue}>{`${Math.round(clamped)}%`}</Text>
        <Text style={styles.ringLabel}>{ringLabel}</Text>
      </ProgressRing>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

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
    </Pressable>
  );
}

function useStyles() {
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
    ringValue: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.64,
      color: colors.ink,
    },
    ringLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(12),
      fontWeight: "500",
      textAlign: "center",
      color: colors.inkSecondary,
    },
    copy: {
      flex: 1,
      flexDirection: "column",
      gap: spacing.sm,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    subtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkSecondary,
    },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    detailsLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: theme.accents.blue.ink,
    },
  }));
}
