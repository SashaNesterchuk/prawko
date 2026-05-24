import { useMemo } from "react";
import { useTheme } from "@react-navigation/native";
import type { StyleSheet } from "react-native";

import { useResponsiveFonts } from "./useResponsiveFonts";
import { useResponsiveSpacing } from "./useResponsiveSpacing";

export interface ResponsiveStylesContext {
  spacing: ReturnType<typeof useResponsiveSpacing>;
  responsiveFont: (size: number) => number;
  colors: ReturnType<typeof useTheme>["colors"];
}

export function useResponsiveStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (ctx: ResponsiveStylesContext) => T
): T {
  const spacing = useResponsiveSpacing();
  const { responsiveFont } = useResponsiveFonts();
  const { colors } = useTheme();

  return useMemo(
    () => factory({ spacing, responsiveFont, colors }),
    [spacing, responsiveFont, colors, factory]
  );
}
