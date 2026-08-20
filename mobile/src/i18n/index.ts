import { DEFAULT_LOCALE, type SupportedLocale } from "@prawko/config";
import i18n from "i18next";
import type { Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";
import { getSupportedDeviceLocale } from "./locale";
import {
  mergeResources,
  withVariantLanguageOptions,
} from "./variant-language-options";
import { appVariant } from "../app-config/runtime";

const detectedLanguage = getSupportedDeviceLocale();
const initialLanguage = appVariant.supportedLocales.includes(detectedLanguage)
  ? detectedLanguage
  : (appVariant.defaultLocale as SupportedLocale) ?? DEFAULT_LOCALE;

const variantResources = mergeResources(
  withVariantLanguageOptions(resources),
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
