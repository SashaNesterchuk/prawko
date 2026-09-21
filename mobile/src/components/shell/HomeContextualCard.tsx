import { Pressable, View } from "react-native";

import { Icon, type IconName } from "../icons";
import {
  CText,
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type HomeContextualCardProps = {
  cta: string;
  icon: IconName;
  kindTestID?: string;
  onPress?: () => void;
  subtitle: string;
  title: string;
};

export function HomeContextualCard({
  cta,
  icon,
  kindTestID,
  onPress,
  subtitle,
  title,
}: HomeContextualCardProps) {
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="home-contextual-card"
    >
      {kindTestID ? (
        <View
          collapsable={false}
          pointerEvents="none"
          style={styles.kindMarker}
          testID={kindTestID}
        />
      ) : null}
      <View style={styles.iconWrap}>
        <Icon color={accents.green.fill} name={icon} size={responsiveFont(24)} />
      </View>

      <View style={styles.copy}>
        <CText style={styles.title} numberOfLines={1}>
          {title}
        </CText>
        <CText style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </CText>
        <View style={styles.ctaRow}>
          <CText style={styles.cta} numberOfLines={1}>
            {cta}
          </CText>
          <Icon
            color={accents.blue.ink}
            name="chevron"
            size={responsiveFont(20)}
          />
        </View>
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, radius, responsiveFont, spacing, theme }) => ({
      card: {
        width: "100%" as const,
        position: "relative" as const,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.xxl,
        overflow: "hidden" as const,
        backgroundColor: colors.white,
      },
      pressed: {
        opacity: 0.9,
      },
      iconWrap: {
        alignItems: "center" as const,
        justifyContent: "center" as const,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: theme.accents.green.soft,
      },
      copy: {
        flex: 1,
        minWidth: 0,
        flexDirection: "column" as const,
      },
      title: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.ink,
      },
      subtitle: {
        ...withResponsiveFont(getTypographyStyle("bodyXS"), responsiveFont),
        color: colors.ink3,
      },
      ctaRow: {
        marginTop: spacing.exact(4),
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "flex-end" as const,
        gap: spacing.exact(2),
      },
      cta: {
        flexShrink: 1,
        ...withResponsiveFont(getTypographyStyle("bodyS"), responsiveFont),
        color: theme.accents.blue.ink,
      },
      kindMarker: {
        position: "absolute" as const,
        width: 1,
        height: 1,
        opacity: 0,
      },
    })
  );
}
