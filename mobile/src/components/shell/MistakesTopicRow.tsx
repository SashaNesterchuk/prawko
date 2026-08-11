import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import {
  resolveMistakeRate,
  resolveMistakeRateStatus,
} from "./mistakes-rate";

type MistakesTopicRowProps = {
  title: string;
  wrong: number;
  total: number;
  onPress?: () => void;
  testID?: string;
};

export function MistakesTopicRow({
  title,
  wrong,
  total,
  onPress,
  testID,
}: MistakesTopicRowProps) {
  const theme = useTheme();
  const mistakeRate = resolveMistakeRate(wrong, total);
  const status = resolveMistakeRateStatus(mistakeRate);
  const rateColor =
    status === "bad"
      ? theme.accents.red.ink
      : status === "normal"
        ? theme.accents.amber.ink
        : theme.accents.green.ink;
  const styles = useStyles({ rateColor });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.copy}>
        <CText style={styles.title} numberOfLines={1}>
          {title}
        </CText>
        <View style={styles.statsRow}>
          <Icon
            color={theme.accents.red.fill}
            name="close"
            size={16}
            style={styles.closeIcon}
          />
          <CText style={styles.fraction}>{`${wrong} / ${total}`}</CText>
        </View>
      </View>

      <CText style={styles.rateValue}>{`${mistakeRate}%`}</CText>

      <View style={styles.chevronWrap} pointerEvents="none">
        <Icon color={theme.colors.ink3} name="chevron" size={24} />
      </View>
    </Pressable>
  );
}

function useStyles({ rateColor }: { rateColor: string }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.92,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
    },
    closeIcon: {
      opacity: 0.6,
    },
    fraction: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.ink2,
    },
    rateValue: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: rateColor,
    },
    chevronWrap: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.paper,
    },
  }));
}
