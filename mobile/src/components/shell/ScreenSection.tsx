import type { ReactNode } from "react";
import { View } from "react-native";

import {
  CText,
  getTypographyStyle,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";

type ScreenSectionProps = {
  title: string;
  children: ReactNode;
  testID?: string;
};

export function ScreenSection({ title, children, testID }: ScreenSectionProps) {
  const styles = useStyles();

  return (
    <View style={styles.section} testID={testID}>
      <CText style={styles.sectionTitle}>{title}</CText>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...withResponsiveFont(getTypographyStyle("bodyS"), responsiveFont),
      color: colors.ink2,
    },
    stack: {
      gap: spacing.sm,
    },
  }));
}
