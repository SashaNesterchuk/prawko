import {
  CZECH_EXAM_BASKETS,
  getCountryConfig,
  type CountryCode,
  type CountryExamConfig,
  type ExamBasketSlot,
  type ExamNavigationMode,
} from "@prawko/config";

import { getExamCountry } from "../../state/app-shell";

export type { ExamBasketSlot, ExamNavigationMode };

export type ExamProfile = CountryExamConfig;

export const WORD_EXAM_PROFILE: ExamProfile = getCountryConfig("PL").exam;
export const CZECH_EXAM_PROFILE: ExamProfile = getCountryConfig("CZ").exam;
export { CZECH_EXAM_BASKETS };

export function getExamProfileForCountry(
  country: CountryCode | null | undefined,
): ExamProfile {
  return getCountryConfig(country).exam;
}

export function getExamProfile(): ExamProfile {
  return getExamProfileForCountry(getExamCountry());
}

export function isFreeExamNavigation(
  profile: ExamProfile = getExamProfile()
) {
  return profile.navigation === "free";
}

export function readExamFlaggedOrders(
  metadata: Record<string, unknown> | null | undefined
): number[] {
  const value = metadata?.flaggedOrders;
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isInteger(entry) && entry > 0
      )
    ),
  ].sort((left, right) => left - right);
}

export function isFreeExamSessionMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  return metadata?.navigation === "free";
}
