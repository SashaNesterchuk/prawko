import type { TextStyle } from "react-native";

export type TypographyStyleKey =
  | "displayXL"
  | "displayL"
  | "displayM"
  | "displayS"
  | "headingL"
  | "headingM"
  | "headingS"
  | "bodyL"
  | "bodyM"
  | "bodyS"
  | "bodyXS"
  | "labelL"
  | "labelM"
  | "labelS"
  | "labelXS"
  | "monoL"
  | "monoM"
  | "monoS"
  | "monoXS";

type TypographyPreset = Pick<
  TextStyle,
  "fontSize" | "lineHeight" | "letterSpacing"
> & {
  fontFamilyKey: "bold" | "semiBold" | "medium" | "regular" | "mono";
};

export const typographyPresets = {
  displayXL: {
    fontSize: 40,
    lineHeight: 40,
    fontFamilyKey: "bold",
  },
  displayL: {
    fontSize: 32,
    lineHeight: 32,
    fontFamilyKey: "bold",
  },
  displayM: {
    fontSize: 24,
    lineHeight: 32,
    fontFamilyKey: "bold",
  },
  displayS: {
    fontSize: 20,
    lineHeight: 28,
    fontFamilyKey: "bold",
  },
  headingL: {
    fontSize: 24,
    lineHeight: 32,
    fontFamilyKey: "semiBold",
  },
  headingM: {
    fontSize: 20,
    lineHeight: 28,
    fontFamilyKey: "semiBold",
  },
  headingS: {
    fontSize: 16,
    lineHeight: 24,
    fontFamilyKey: "semiBold",
  },
  bodyL: {
    fontSize: 18,
    lineHeight: 28,
    fontFamilyKey: "regular",
  },
  bodyM: {
    fontSize: 16,
    lineHeight: 24,
    fontFamilyKey: "regular",
  },
  bodyS: {
    fontSize: 14,
    lineHeight: 20,
    fontFamilyKey: "regular",
  },
  bodyXS: {
    fontSize: 12,
    lineHeight: 16,
    fontFamilyKey: "regular",
  },
  labelL: {
    fontSize: 16,
    lineHeight: 24,
    fontFamilyKey: "regular",
  },
  labelM: {
    fontSize: 14,
    lineHeight: 20,
    fontFamilyKey: "regular",
  },
  labelS: {
    fontSize: 12,
    lineHeight: 16,
    fontFamilyKey: "regular",
  },
  labelXS: {
    fontSize: 11,
    lineHeight: 12,
    fontFamilyKey: "medium",
  },
  monoL: {
    fontSize: 16,
    lineHeight: 24,
    fontFamilyKey: "mono",
  },
  monoM: {
    fontSize: 14,
    lineHeight: 20,
    fontFamilyKey: "mono",
  },
  monoS: {
    fontSize: 12,
    lineHeight: 12,
    fontFamilyKey: "mono",
  },
  monoXS: {
    fontSize: 11,
    lineHeight: 12,
    fontFamilyKey: "mono",
  },
} as const satisfies Record<TypographyStyleKey, TypographyPreset>;

export type TypographyTokens = typeof typographyPresets;
