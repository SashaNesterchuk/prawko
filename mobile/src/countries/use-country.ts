import {
  getCountryConfig,
  type CountryCode,
  type CountryConfig,
} from "@prawko/config";

import { useAppShellStore } from "../state/app-shell";

export function useExamCountry(): CountryCode | null {
  return useAppShellStore((state) => state.examCountry);
}

export function useCountryConfig(): CountryConfig {
  const examCountry = useExamCountry();
  return getCountryConfig(examCountry);
}

export function useHasResolvedExamCountry(): boolean {
  return useAppShellStore((state) => state.examCountry !== null);
}
