import { StyleSheet, type TextStyle } from "react-native";

import {
  typographyPresets,
  type TypographyStyleKey,
} from "../../theme/tokens/typography";
import {
  createFontFamilyStyle,
  type FontWeightKey,
} from "./fontRegistry";

export type { TypographyStyleKey };

export type TextSizeKey =
  | "s72"
  | "s52"
  | "s44"
  | "s36"
  | "s32"
  | "s28"
  | "s24"
  | "s20"
  | "s18"
  | "s16"
  | "s14"
  | "s12"
  | "s10";

const SIZE_TO_FONT_SIZE_KEY = {
  s72: "size72",
  s52: "size52",
  s44: "size44",
  s36: "size36",
  s32: "size32",
  s28: "size28",
  s24: "size24",
  s20: "size20",
  s18: "size18",
  s16: "size16",
  s14: "size14",
  s12: "size12",
  s10: "size10",
} as const satisfies Record<TextSizeKey, string>;

export const fontSizes = StyleSheet.create({
  size72: { fontSize: 72, lineHeight: 80 },
  size52: { fontSize: 52 },
  size44: { fontSize: 44, lineHeight: 52 },
  size36: { fontSize: 36, lineHeight: 48 },
  size32: { fontSize: 32, lineHeight: 32 },
  size28: { fontSize: 28, lineHeight: 40 },
  size24: { fontSize: 24, lineHeight: 32 },
  size20: { fontSize: 20, lineHeight: 28 },
  size18: { fontSize: 18, lineHeight: 28 },
  size16: { fontSize: 16, lineHeight: 24 },
  size14: { fontSize: 14, lineHeight: 20 },
  size12: { fontSize: 12, lineHeight: 16 },
  size10: { fontSize: 10, lineHeight: 14 },
});

const TYPOGRAPHY_FONT_KEY: Record<
  (typeof typographyPresets)[TypographyStyleKey]["fontFamilyKey"],
  FontWeightKey
> = {
  bold: "bold",
  semiBold: "semiBold",
  medium: "medium",
  regular: "regular",
  mono: "mono",
};

export function getTypographyStyle(key: TypographyStyleKey): TextStyle {
  const preset = typographyPresets[key];
  const fontWeightKey = TYPOGRAPHY_FONT_KEY[preset.fontFamilyKey];

  return {
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    fontWeight: preset.fontWeight,
    ...createFontFamilyStyle(fontWeightKey),
  };
}

/** Apply Figma→device font scaling to a typography preset / text style. */
export function withResponsiveFont(
  style: TextStyle,
  responsiveFont: (size: number) => number
): TextStyle {
  return {
    ...style,
    fontSize:
      typeof style.fontSize === "number"
        ? responsiveFont(style.fontSize)
        : style.fontSize,
    lineHeight:
      typeof style.lineHeight === "number"
        ? responsiveFont(style.lineHeight)
        : style.lineHeight,
  };
}

export function getFontSizeMetrics(sizeKey: TextSizeKey) {
  const metricsKey =
    SIZE_TO_FONT_SIZE_KEY[sizeKey] as keyof typeof fontSizes;
  const style = fontSizes[metricsKey] ?? fontSizes.size16;

  const lineHeight =
    "lineHeight" in style && typeof style.lineHeight === "number"
      ? style.lineHeight
      : style.fontSize;

  return {
    fontSize: style.fontSize,
    lineHeight,
  };
}

export function getTextSizeStyle(
  sizeKey: TextSizeKey,
  weight: FontWeightKey = "regular"
): TextStyle {
  const metricsKey = SIZE_TO_FONT_SIZE_KEY[sizeKey] as keyof typeof fontSizes;

  return {
    ...fontSizes[metricsKey],
    ...createFontFamilyStyle(weight),
  };
}

export function getTextWeightStyle(weight: FontWeightKey): TextStyle {
  return createFontFamilyStyle(weight);
}

export const textSize = StyleSheet.create(
  Object.fromEntries(
    (Object.keys(SIZE_TO_FONT_SIZE_KEY) as TextSizeKey[]).map((sizeKey) => [
      sizeKey,
      getTextSizeStyle(sizeKey),
    ])
  ) as Record<TextSizeKey, TextStyle>
);

export const textWeight = {
  regular: getTextWeightStyle("regular"),
  medium: getTextWeightStyle("medium"),
  semiBold: getTextWeightStyle("semiBold"),
  bold: getTextWeightStyle("bold"),
  mono: getTextWeightStyle("mono"),
} as const;

export const textStyle = StyleSheet.create({
  s32: getTextSizeStyle("s36"),
  h1: getTypographyStyle("displayL"),
  h2: getTypographyStyle("headingL"),
  h3: getTypographyStyle("headingM"),
  h3Half: getTypographyStyle("bodyL"),
  h4: getTypographyStyle("headingS"),
  h5: getTypographyStyle("bodyS"),
  bExt: getTypographyStyle("bodyL"),
  b1: getTypographyStyle("bodyM"),
  b2: getTypographyStyle("bodyS"),
  b3: getTypographyStyle("bodyXS"),
  c1: getTypographyStyle("labelS"),
  c2: getTypographyStyle("labelXS"),
  c3: getTypographyStyle("labelXS"),
  input: getTypographyStyle("bodyS"),
});

export const globalStyles = StyleSheet.create({
  shadow: {
    shadowColor: "#142D21",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
});
