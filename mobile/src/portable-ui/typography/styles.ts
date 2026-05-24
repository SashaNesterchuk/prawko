import { StyleSheet, type TextStyle } from "react-native";

import {
  createFontFamilyStyle,
  type FontWeightKey,
} from "./fontRegistry";

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
  size32: { fontSize: 32, lineHeight: 40 },
  size28: { fontSize: 28, lineHeight: 40 },
  size24: { fontSize: 24, lineHeight: 28 },
  size20: { fontSize: 20, lineHeight: 28 },
  size18: { fontSize: 18, lineHeight: 24 },
  size16: { fontSize: 16, lineHeight: 24 },
  size14: { fontSize: 14, lineHeight: 20 },
  size12: { fontSize: 12, lineHeight: 16 },
  size10: { fontSize: 10, lineHeight: 14 },
});

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
  bold: getTextWeightStyle("bold"),
  light: getTextWeightStyle("light"),
  italic: getTextWeightStyle("italic"),
  boldItalic: getTextWeightStyle("boldItalic"),
  sansBoldItalic: getTextWeightStyle("sansBoldItalic"),
  robotoSerifMediumItalic28: getTextWeightStyle("robotoSerifMediumItalic28"),
} as const;

export const textStyle = StyleSheet.create({
  s32: getTextSizeStyle("s36"),
  h1: getTextSizeStyle("s32"),
  h2: getTextSizeStyle("s24"),
  h3: getTextSizeStyle("s20"),
  h3Half: getTextSizeStyle("s18"),
  h4: getTextSizeStyle("s16"),
  h5: getTextSizeStyle("s14"),
  bExt: getTextSizeStyle("s20"),
  b1: getTextSizeStyle("s16"),
  b2: getTextSizeStyle("s14"),
  b3: getTextSizeStyle("s12"),
  c1: getTextSizeStyle("s12"),
  c2: getTextSizeStyle("s12"),
  c3: getTextSizeStyle("s10"),
  input: getTextSizeStyle("s14"),
});

export const globalStyles = StyleSheet.create({
  shadow: {
    shadowColor: "#2B2626",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
});
