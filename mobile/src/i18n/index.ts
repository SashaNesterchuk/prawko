import { DEFAULT_LOCALE } from "@prawko/config";
import i18n from "i18next";
import type { Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";
import { getSupportedDeviceLocale } from "./locale";
import { withVariantLanguageOptions } from "./variant-language-options";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: getSupportedDeviceLocale(),
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
  resources: withVariantLanguageOptions(resources) as Resource,
});

export default i18n;
