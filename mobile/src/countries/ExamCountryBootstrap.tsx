import { PropsWithChildren, useEffect, useRef } from "react";

import {
  DEFAULT_COUNTRY_CODE,
  resolveCountryCode,
  type CountryCode,
} from "@prawko/config";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_EXAM_COUNTRY_SOURCES,
  ANALYTICS_PROPERTIES,
  type AnalyticsExamCountrySource,
} from "../analytics/catalog";
import { mobileEnv } from "../config/env";
import { useAnalytics } from "../providers/AnalyticsProvider";
import { useAppShellStore, useHasHydrated } from "../state/app-shell";
import { detectExamCountry } from "./detect-country";

export function ExamCountryBootstrap({ children }: PropsWithChildren) {
  const hasHydrated = useHasHydrated();
  const { track } = useAnalytics();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted,
  );
  const resolveExamCountry = useAppShellStore(
    (state) => state.resolveExamCountry,
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || examCountry || inFlightRef.current) {
      return;
    }

    function assignCountry(
      country: CountryCode,
      source: AnalyticsExamCountrySource,
    ) {
      if (useAppShellStore.getState().examCountry) {
        return;
      }

      resolveExamCountry(country);
      track(ANALYTICS_EVENTS.examCountryResolved.key, {
        [ANALYTICS_PROPERTIES.examCountry]: country,
        [ANALYTICS_PROPERTIES.source]: source,
      });
    }

    if (mobileEnv.enableE2ETestMode) {
      assignCountry(
        resolveCountryCode(process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY) ??
          DEFAULT_COUNTRY_CODE,
        ANALYTICS_EXAM_COUNTRY_SOURCES.e2e,
      );
      return;
    }

    inFlightRef.current = true;

    if (onboardingCompleted) {
      assignCountry(
        DEFAULT_COUNTRY_CODE,
        ANALYTICS_EXAM_COUNTRY_SOURCES.legacyOnboarded,
      );
      inFlightRef.current = false;
      return;
    }

    void detectExamCountry()
      .then((detection) => {
        assignCountry(detection.country, detection.source);
      })
      .catch(() => {
        assignCountry(
          DEFAULT_COUNTRY_CODE,
          ANALYTICS_EXAM_COUNTRY_SOURCES.default,
        );
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [examCountry, hasHydrated, onboardingCompleted, resolveExamCountry, track]);

  return children;
}

