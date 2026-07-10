export { default as CText } from "./components/CText";
export type { CTextProps } from "./components/CText";

export {
  configureFonts,
  defaultFontRegistry,
  getFontFamily,
  getFontRegistry,
  resetFonts,
} from "./typography/fontRegistry";
export type { FontRegistry, FontWeightKey } from "./typography/fontRegistry";

export {
  fontSizes,
  getFontSizeMetrics,
  getTextSizeStyle,
  getTextWeightStyle,
  globalStyles,
  textSize,
  textStyle,
  textWeight,
} from "./typography/styles";
export type { TextSizeKey } from "./typography/styles";

export { useResponsiveFonts } from "./hooks/useResponsiveFonts";
export type { ResponsiveFontHook } from "./hooks/useResponsiveFonts";

export { useResponsiveSpacing } from "./hooks/useResponsiveSpacing";
export type { ResponsiveSpacingApi } from "./hooks/useResponsiveSpacing";

export { useResponsiveStyles } from "./hooks/useResponsiveStyles";
export type { ResponsiveStylesContext } from "./hooks/useResponsiveStyles";

export {
  darkNavigationPalette,
  lightNavigationPalette,
} from "./theme/navigationPalettes";

export { hexToRgba } from "./utils/hexToRgba";
