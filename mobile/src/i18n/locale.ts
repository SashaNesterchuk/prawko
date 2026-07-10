import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@prawko/config";
import { getLocales } from "expo-localization";

const localeAliases: Record<string, SupportedLocale> = {
  en: "en",
  pl: "pl",
  ua: "ua",
  uk: "ua",
};

export function normalizeSupportedLocale(
  value: string | null | undefined,
): SupportedLocale | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  const localeCandidate =
    localeAliases[normalizedValue] ??
    localeAliases[normalizedValue.split("-")[0] ?? ""] ??
    null;

  if (!localeCandidate) {
    return null;
  }

  return SUPPORTED_LOCALES.includes(localeCandidate) ? localeCandidate : null;
}

export function getSupportedDeviceLocale(): SupportedLocale {
  const primaryLocale = getLocales()[0];

  return (
    normalizeSupportedLocale(primaryLocale?.languageTag) ??
    normalizeSupportedLocale(primaryLocale?.languageCode) ??
    DEFAULT_LOCALE
  );
}
