import { DEFAULT_LOCALE, type SupportedLocale } from "@prawko/config";
import i18n from "i18next";
import type { Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";
import { getSupportedDeviceLocale } from "./locale";
import { appVariant } from "../app-config/runtime";

const detectedLanguage = getSupportedDeviceLocale();
const initialLanguage = appVariant.supportedLocales.includes(detectedLanguage)
  ? detectedLanguage
  : (appVariant.defaultLocale as SupportedLocale) ?? DEFAULT_LOCALE;

function mergeResources(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base };

  for (const [key, override] of Object.entries(overrides)) {
    const current = result[key];
    result[key] =
      current &&
      override &&
      typeof current === "object" &&
      typeof override === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(override)
        ? mergeResources(
            current as Record<string, unknown>,
            override as Record<string, unknown>
          )
        : override;
  }

  return result;
}

const resourcesWithVariantLocales = mergeResources(resources, {
  en: {
    translation: {
      languages: {
        cs: { label: "Čeština", description: "Czech interface and driving theory content." },
        el: { label: "Ελληνικά", description: "Greek interface and driving theory content." },
      },
    },
  },
});
const variantResources = mergeResources(
  resourcesWithVariantLocales,
  appVariant.translations
);

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: initialLanguage,
  fallbackLng: {
    cs: ["en"],
    de: ["en"],
    el: ["en"],
    es: ["en"],
    default: [DEFAULT_LOCALE],
  },
  interpolation: {
    escapeValue: false,
  },
  resources: variantResources as Resource,
});

export default i18n;
