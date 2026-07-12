import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { useResponsiveFonts } from "./useResponsiveFonts";
import { useResponsiveSpacing } from "./useResponsiveSpacing";

export interface ResponsiveStylesContext {
  theme: ReturnType<typeof useTheme>;
  spacing: ReturnType<typeof useResponsiveSpacing>;
  responsiveFont: (size: number) => number;
  colors: ReturnType<typeof useTheme>["colors"];
  accents: ReturnType<typeof useTheme>["accents"];
  radius: ReturnType<typeof useTheme>["radius"];
  elevation: ReturnType<typeof useTheme>["elevation"];
}

export function useResponsiveStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (ctx: ResponsiveStylesContext) => T
): T {
  const spacing = useResponsiveSpacing();
  const { responsiveFont } = useResponsiveFonts();
  const theme = useTheme();
  const { accents, colors, elevation, radius } = theme;

  return useMemo(
    () =>
      StyleSheet.create(
        factory({
          theme,
          spacing,
          responsiveFont,
          colors,
          accents,
          radius,
          elevation,
        })
      ),
    [factory, theme, spacing, responsiveFont, colors, accents, radius, elevation]
  );
}
