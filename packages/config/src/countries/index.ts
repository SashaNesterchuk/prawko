import type { SupportedLocale } from "../index";
import { CZ_COUNTRY_CONFIG } from "./cz";
import { PL_COUNTRY_CONFIG } from "./pl";
import {
  DEFAULT_COUNTRY_CODE,
  isCountryCode,
  type CountryCode,
  type CountryConfig,
} from "./types";

export {
  CZECH_EXAM_BASKETS,
  CZ_COUNTRY_CONFIG,
} from "./cz";
export { PL_COUNTRY_CONFIG } from "./pl";
export {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  SUPPORTED_COUNTRY_CODES,
  isCountryCode,
  type CountryCode,
  type CountryConfig,
  type CountryExamConfig,
  type CountryMediaEnvKey,
  type ExamBasketSlot,
  type ExamNavigationMode,
} from "./types";

export const COUNTRY_CONFIGS: Record<CountryCode, CountryConfig> = {
  PL: PL_COUNTRY_CONFIG,
  CZ: CZ_COUNTRY_CONFIG,
};

const STOREFRONT_ALIASES: Record<string, CountryCode> = {
  PL: "PL",
  POL: "PL",
  POLAND: "PL",
  CZ: "CZ",
  CZE: "CZ",
  CZECH: "CZ",
  CZECHIA: "CZ",
  CZECHREPUBLIC: "CZ",
};

export function getCountryConfig(
  country: CountryCode | null | undefined,
): CountryConfig {
  if (country && country in COUNTRY_CONFIGS) {
    return COUNTRY_CONFIGS[country];
  }

  return COUNTRY_CONFIGS[DEFAULT_COUNTRY_CODE];
}

export function resolveCountryCode(
  value: string | null | undefined,
): CountryCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");

  if (!normalized) {
    return null;
  }

  const mapped = STOREFRONT_ALIASES[normalized];
  if (mapped) {
    return mapped;
  }

  return isCountryCode(normalized) ? normalized : null;
}

export function clampLocaleForCountry(
  country: CountryCode,
  locale: SupportedLocale | null | undefined,
): SupportedLocale {
  const config = getCountryConfig(country);

  if (locale && config.supportedLocales.includes(locale)) {
    return locale;
  }

  return config.defaultLocale;
}
