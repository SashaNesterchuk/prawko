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
  "fontSize" | "lineHeight" | "letterSpacing" | "fontWeight"
> & {
  fontFamilyKey: "bold" | "medium" | "regular" | "mono";
};

export const typographyPresets = {
  displayXL: {
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -0.8,
    fontWeight: "700",
    fontFamilyKey: "bold",
  },
  displayL: {
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.64,
    fontWeight: "700",
    fontFamilyKey: "bold",
  },
  displayM: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
    fontWeight: "700",
    fontFamilyKey: "bold",
  },
  displayS: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontWeight: "700",
    fontFamilyKey: "bold",
  },
  headingL: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.24,
    fontWeight: "600",
    fontFamilyKey: "medium",
  },
  headingM: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontWeight: "600",
    fontFamilyKey: "medium",
  },
  headingS: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.16,
    fontWeight: "600",
    fontFamilyKey: "medium",
  },
  bodyL: {
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  bodyM: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  bodyS: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  bodyXS: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  labelL: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  labelM: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  labelS: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontWeight: "400",
    fontFamilyKey: "regular",
  },
  labelXS: {
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0,
    fontWeight: "500",
    fontFamilyKey: "medium",
  },
  monoL: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.16,
    fontWeight: "400",
    fontFamilyKey: "mono",
  },
  monoM: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.14,
    fontWeight: "400",
    fontFamilyKey: "mono",
  },
  monoS: {
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: -0.12,
    fontWeight: "400",
    fontFamilyKey: "mono",
  },
  monoXS: {
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: -0.11,
    fontWeight: "400",
    fontFamilyKey: "mono",
  },
} as const satisfies Record<TypographyStyleKey, TypographyPreset>;

export type TypographyTokens = typeof typographyPresets;
