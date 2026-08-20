import Constants from "expo-constants";

import { variantRuntime } from "@app-variant";

import type { AppVariantFeatures, AppVariantId } from "./types";

type ExpoVariantExtra = {
  id?: AppVariantId;
  name?: string;
  questionSetKey?: string;
  mediaBaseUrl?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  features?: Partial<AppVariantFeatures>;
};

const extra = (Constants.expoConfig?.extra?.variant ?? {}) as ExpoVariantExtra;

if (extra.id && extra.id !== variantRuntime.id) {
  throw new Error(
    `Variant config mismatch: Expo selected "${extra.id}", Metro bundled "${variantRuntime.id}".`
  );
}

export const appVariant = {
  id: variantRuntime.id,
  name: extra.name ?? "Prawko",
  questionSetKey: extra.questionSetKey ?? "pl-v2-current",
  mediaBaseUrl: extra.mediaBaseUrl ?? "",
  defaultLocale: extra.defaultLocale ?? "ua",
  supportedLocales: extra.supportedLocales ?? ["pl", "ua", "en", "de", "es"],
  features: {
    roadSigns: extra.features?.roadSigns ?? true,
  },
  theme: variantRuntime.theme,
  translations: variantRuntime.translations,
} as const;
