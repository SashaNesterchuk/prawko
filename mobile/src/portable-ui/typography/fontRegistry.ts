import type { TextStyle } from "react-native";

export type FontWeightKey =
  | "regular"
  | "medium"
  | "semiBold"
  | "bold"
  | "mono";

export type FontRegistry = Partial<Record<FontWeightKey, string>>;

export const defaultFontRegistry: FontRegistry = {};

let activeRegistry: FontRegistry = { ...defaultFontRegistry };

export function configureFonts(registry: FontRegistry) {
  activeRegistry = { ...activeRegistry, ...registry };
}

export function resetFonts(registry: FontRegistry = defaultFontRegistry) {
  activeRegistry = { ...registry };
}

export function getFontRegistry(): Readonly<FontRegistry> {
  return activeRegistry;
}

export function getFontFamily(weight: FontWeightKey): string | undefined {
  const family = activeRegistry[weight];
  return family && family.length > 0 ? family : undefined;
}

export function createFontFamilyStyle(
  weight: FontWeightKey
): Pick<TextStyle, "fontFamily"> {
  const fontFamily = getFontFamily(weight);
  return fontFamily ? { fontFamily } : {};
}
