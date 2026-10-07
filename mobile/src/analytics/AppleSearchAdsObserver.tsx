import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { usePostHog } from "posthog-react-native";

import { useAnalytics } from "../hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "./catalog";
import { isPostHogCaptureEnabled } from "./posthog-build-gate";
import { stepAppleSearchAdsAttribution } from "./apple-search-ads-runner";
import type { AppleSearchAdsProperties } from "./apple-search-ads";

/**
 * Resolves Apple Search Ads install attribution once per iOS install.
 * Dev, e2e, and TestFlight stay out of PostHog, so they never request a token.
 */
export function AppleSearchAdsObserver() {
  const posthog = usePostHog();
  const { track } = useAnalytics();
  const trackRef = useRef(track);
  const posthogRef = useRef(posthog);
  trackRef.current = track;
  posthogRef.current = posthog;

  useEffect(() => {
    if (!posthog || Platform.OS !== "ios" || !isPostHogCaptureEnabled()) return;

    let cancelled = false;
    let inFlight = false;
    let rerun = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = (delayMs: number | null) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (cancelled || delayMs == null) return;
      timer = setTimeout(() => {
        void run();
      }, delayMs);
    };

    const run = async () => {
      if (cancelled) return;
      if (inFlight) {
        rerun = true;
        return;
      }

      inFlight = true;
      try {
        do {
          rerun = false;
          const result = await stepAppleSearchAdsAttribution({
            capture: (properties) => {
              trackRef.current(
                ANALYTICS_EVENTS.appleSearchAdsAttributionResolved.key,
                properties,
              );
            },
            now: () => Date.now(),
            register: (properties) => registerAppleSearchAdsProperties(posthogRef.current, properties),
          });
          if (!cancelled) arm(result.retryInMs);
        } while (rerun && !cancelled);
      } catch {
        if (!cancelled) arm(60_000);
      } finally {
        inFlight = false;
      }
    };

    void run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [posthog]);

  return null;
}

async function registerAppleSearchAdsProperties(
  posthog: ReturnType<typeof usePostHog>,
  properties: AppleSearchAdsProperties,
) {
  if (!posthog) return;
  try {
    await posthog.register(properties);
  } catch {
    // Super properties are retried on the next foreground.
  }
  try {
    posthog.setPersonProperties(undefined, properties, false);
  } catch {
    // Person properties are retried on the next foreground.
  }
}
