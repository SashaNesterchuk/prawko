import {
  CONTENT_LOCALES,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type ContentLocale,
  type SupportedLocale,
} from "@prawko/config";
import { getLocales } from "expo-localization";

const localeAliases: Record<string, SupportedLocale> = {
  en: "en",
  cs: "cs",
  el: "el",
  pl: "pl",
  ua: "ua",
  uk: "ua",
  de: "de",
  es: "es",
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

export function normalizeContentLocale(
  value: string | null | undefined,
): ContentLocale | null {
  const locale = normalizeSupportedLocale(value);

  if (!locale) {
    return null;
  }

  if (CONTENT_LOCALES.includes(locale as ContentLocale)) {
    return locale as ContentLocale;
  }

  return null;
}

export function getSupportedDeviceLocale(): SupportedLocale {
  for (const locale of getLocales()) {
    const resolved =
      normalizeSupportedLocale(locale?.languageTag) ??
      normalizeSupportedLocale(locale?.languageCode);

    if (resolved) {
      return resolved;
    }
  }

  return DEFAULT_LOCALE;
}
