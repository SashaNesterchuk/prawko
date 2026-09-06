import {
  DEFAULT_COUNTRY_CODE,
  resolveCountryCode,
  type CountryCode,
} from "@prawko/config";
import { getLocales } from "expo-localization";
import Purchases from "react-native-purchases";

import {
  ANALYTICS_EXAM_COUNTRY_SOURCES,
  type AnalyticsExamCountrySource,
} from "../analytics/catalog";
import { mobileEnv } from "../config/env";

export type ExamCountryDetectSource = Extract<
  AnalyticsExamCountrySource,
  "storefront" | "device_region" | "default" | "e2e"
>;

export type ExamCountryDetection = {
  country: CountryCode;
  source: ExamCountryDetectSource;
};

export async function detectExamCountry(): Promise<ExamCountryDetection> {
  const e2eCountry = resolveCountryCode(process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY);
  if (mobileEnv.enableE2ETestMode && e2eCountry) {
    return { country: e2eCountry, source: ANALYTICS_EXAM_COUNTRY_SOURCES.e2e };
  }

  const storefrontCountry = await readStorefrontCountry();
  if (storefrontCountry) {
    return {
      country: storefrontCountry,
      source: ANALYTICS_EXAM_COUNTRY_SOURCES.storefront,
    };
  }

  const deviceCountry = readDeviceRegionCountry();
  if (deviceCountry) {
    return {
      country: deviceCountry,
      source: ANALYTICS_EXAM_COUNTRY_SOURCES.deviceRegion,
    };
  }

  return {
    country: DEFAULT_COUNTRY_CODE,
    source: ANALYTICS_EXAM_COUNTRY_SOURCES.default,
  };
}

async function readStorefrontCountry(): Promise<CountryCode | null> {
  const getStorefront = (
    Purchases as { getStorefront?: () => Promise<string | null> }
  ).getStorefront;

  if (typeof getStorefront !== "function") {
    return null;
  }

  try {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const storefront = await Promise.race([
      getStorefront.call(Purchases),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 2000);
      }),
    ]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return resolveCountryCode(storefront);
  } catch {
    return null;
  }
}

function readDeviceRegionCountry(): CountryCode | null {
  for (const locale of getLocales()) {
    const country = resolveCountryCode(locale?.regionCode);
    if (country) {
      return country;
    }
  }

  return null;
}
