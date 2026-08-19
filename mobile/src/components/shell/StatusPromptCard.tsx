import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
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
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.copy}>
        <CText style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </CText>
        <CText style={styles.title} numberOfLines={1}>
          {title}
        </CText>
      </View>

      <View style={styles.trailing}>
        <Icon
          color={theme.accents.amber.ink}
          name="chevron"
          size={responsiveFont(24)}
        />
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
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
      ...elevation.card,
    },
    pressed: {
      opacity: 0.85,
    },
    copy: {
      flex: 1,
      flexDirection: "column",
    },
    eyebrow: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontFamily: getFontFamily("regular"),
      color: colors.inkMuted,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
    },
    trailing: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.accents.amber.soft,
    },
  }));
}
