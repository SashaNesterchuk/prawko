import {
  getCountryConfig,
  type CountryCode,
  type CountryConfig,
} from "@prawko/config";

import { getExamCountry } from "../state/app-shell";

export function getActiveCountryConfig(): CountryConfig {
  return getCountryConfig(getExamCountry());
}

export function getQuestionSetKey(): string {
  const override = process.env.EXPO_PUBLIC_QUESTION_SET_KEY?.trim();
  if (override) {
    return override;
  }

  return getActiveCountryConfig().questionSetKey;
}

export function getMediaBaseUrl(): string {
  const config = getActiveCountryConfig();
  const envValue =
    config.mediaEnvKey === "EXPO_PUBLIC_CZECH_MEDIA_BASE_URL"
      ? process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL
      : process.env.EXPO_PUBLIC_MEDIA_BASE_URL;

  return envValue?.trim() ?? "";
}

export function getActiveCountryCode(): CountryCode {
  return getExamCountry();
}
