import { getLocales } from "expo-localization";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@prawko/config";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const deviceLanguage = getLocales()[0]?.languageCode ?? DEFAULT_LOCALE;
const initialLanguage = SUPPORTED_LOCALES.some(
  (locale) => locale === deviceLanguage
)
  ? deviceLanguage
  : DEFAULT_LOCALE;

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
