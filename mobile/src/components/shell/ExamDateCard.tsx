import { Pressable, View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type ExamDateCardVariant = "unset" | "set" | "past";

type ExamDateCardProps = {
  variant: ExamDateCardVariant;
  eyebrow: string;
  title: string;
  trailingLabel?: string;
  onPress?: () => void;
  testID?: string;
};

export function ExamDateCard({
  variant,
  eyebrow,
  title,
  trailingLabel,
  onPress,
  testID,
}: ExamDateCardProps) {
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const isUnset = variant === "unset";
  const isPast = variant === "past";
  const chevronColor = isPast ? accents.amber.fill : accents.blue.ink;
  const chevronSize = isPast ? 24 : 20;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isPast ? styles.cardPast : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <View style={styles.iconWrap}>
        <Icon color={colors.ink3} name="calendar" size={responsiveFont(24)} />
      </View>

      <View style={isUnset ? styles.copyInline : styles.copyStack}>
        <CText style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </CText>
        <CText
          style={isUnset ? styles.unsetTitle : styles.title}
          numberOfLines={1}
        >
          {title}
        </CText>
      </View>

      {isUnset ? null : (
        <View style={isPast ? styles.pastTrailing : styles.setTrailing}>
          {trailingLabel ? (
            <CText style={styles.trailingLabel} numberOfLines={1}>
              {trailingLabel}
            </CText>
          ) : null}
          <Icon
            color={chevronColor}
            name="chevron"
            size={responsiveFont(chevronSize)}
          />
        </View>
      )}
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
      card: {
        width: "100%" as const,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.xxl,
        overflow: "hidden" as const,
        backgroundColor: colors.surface,
      },
      cardPast: {
        borderWidth: 2,
        borderColor: theme.accents.amber.fill,
        ...elevation.card,
      },
      pressed: {
        opacity: 0.85,
      },
      iconWrap: {
        alignItems: "center" as const,
        justifyContent: "center" as const,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.paper,
      },
      copyInline: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: spacing.md,
      },
      copyStack: {
        flex: 1,
        minWidth: 0,
        flexDirection: "column" as const,
      },
      eyebrow: {
        flexShrink: 1,
        ...withResponsiveFont(getTypographyStyle("bodyXS"), responsiveFont),
        color: colors.ink3,
      },
      unsetTitle: {
        flexShrink: 0,
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.ink3,
      },
      title: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.ink,
      },
      setTrailing: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: spacing.sm,
      },
      pastTrailing: {
        alignItems: "center" as const,
        justifyContent: "center" as const,
        padding: spacing.sm,
        borderRadius: radius.md,
      },
      trailingLabel: {
        ...withResponsiveFont(getTypographyStyle("bodyS"), responsiveFont),
        color: theme.accents.blue.ink,
      },
    })
  );
}
