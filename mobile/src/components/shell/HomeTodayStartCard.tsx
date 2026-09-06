import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type HomeTodayStartCardProps = {
  completed?: boolean;
  examCountdownLabel?: string | null;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export function HomeTodayStartCard({
  completed = false,
  examCountdownLabel,
  title,
  subtitle,
  onPress,
}: HomeTodayStartCardProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const isPressable = Boolean(onPress) && !completed;

  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      disabled={!isPressable}
      onPress={isPressable ? onPress : undefined}
      testID="home-today-start"
      style={({ pressed }) => [
        styles.card,
        pressed && isPressable ? styles.pressed : null,
      ]}
    >
      <View style={styles.copy}>
        {examCountdownLabel ? (
          <CText style={styles.eyebrow}>{examCountdownLabel}</CText>
        ) : null}
        <CText style={styles.title} semiBold>
          {title}
        </CText>
        <CText style={styles.subtitle}>{subtitle}</CText>
      </View>
      {isPressable ? (
        <Icon
          color={theme.accents.blue.ink}
          name="chevron"
          size={responsiveFont(20)}
        />
      ) : null}
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing }) => ({
    card: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    pressed: {
      opacity: 0.7,
    },
    copy: {
      flex: 1,
      gap: 0,
    },
    eyebrow: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkSecondary,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(22),
      color: colors.ink,
    },
    subtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkSecondary,
    },
  }));
}
