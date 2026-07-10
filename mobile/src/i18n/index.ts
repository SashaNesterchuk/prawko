import { DEFAULT_LOCALE } from "@prawko/config";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";
import { getSupportedDeviceLocale } from "./locale";

const initialLanguage = getSupportedDeviceLocale() ?? DEFAULT_LOCALE;

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: initialLanguage,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
  resources,
});

export default i18n;
