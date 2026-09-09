import { FEATURE_FLAGS } from "@prawko/config";
import { usePathname } from "expo-router";
import { useCallback } from "react";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PROPERTIES,
  getAnalyticsErrorCode,
  type AnalyticsProperties,
} from "../../analytics/catalog";
import type { AnalyticsTrack } from "../../providers/AnalyticsProvider";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useHasPlusAccess } from "../../state/entitlements";
import type { CaptureErrorInput } from "../errors/error-logging";
import { buildAdDecisionProperties, type AdDecisionStep } from "./ad-analytics";
import {
  clearAppBackgroundMark,
  isExamSessionActive,
  recordAdShown,
  shouldShowInterstitialForTrigger,
  suppressAppResumeAds,
  type AdInterstitialTrigger,
  type AdSkipReason,
} from "./ad-session-policy";
import { isAdMobEnabled } from "./admob-config";
import {
  ensureInterstitialReady,
  getLastInterstitialWhy,
  isInterstitialLoaded,
  showPreloadedInterstitial,
} from "./interstitial-controller";

/** Cap intentional warm-up so exam result never waits more than a few seconds. */
export const INTERSTITIAL_ENSURE_OPTIONS = {
  attempts: 2,
  timeoutMs: 5_000,
} as const;

type ShowInterstitialInput = {
  captureError?: (input: CaptureErrorInput) => void;
  hasPlusAccess: boolean;
  pathname?: string | null;
  practiceAnsweredCount?: number | null;
  track: AnalyticsTrack;
  trigger: AdInterstitialTrigger;
  /**
   * When true (session end / exam / unlock): wait and retry for a creative.
   * When false (mid-session streak / app resume): only show if already loaded
   * so AdMob load never freezes the current screen.
   */
  waitForLoad?: boolean;
};

function getAdOpportunityType(trigger: AdInterstitialTrigger) {
  switch (trigger) {
    case "after_exam_complete":
      return "exam_result";
    case "after_practice_session_complete":
      return "practice_session_end";
    case "exam_restart":
      return "exam_restart_gate";
    case "after_question_answer":
      return "practice_streak";
    case "app_resume":
      return "app_resume";
    default:
      return trigger;
  }
}

function buildAdEventProperties(
  input: ShowInterstitialInput,
  decision: {
    shouldShow: boolean;
    step: AdDecisionStep;
    why: string;
  }
): AnalyticsProperties {
  return {
    ...buildAdDecisionProperties({
      after: input.trigger,
      loaded: isInterstitialLoaded(),
      pathname: input.pathname,
      shouldShow: decision.shouldShow,
      step: decision.step,
      waitForLoad: Boolean(input.waitForLoad),
      why: decision.why,
    }),
    reason: decision.why,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  };
}

function captureAdMiss(
  input: ShowInterstitialInput,
  eventName: "ad_not_shown" | "ad_failed",
  properties: AnalyticsProperties,
  error?: unknown
) {
  input.captureError?.({
    area: "ads",
    error,
    eventName,
    message: String(
      properties[ANALYTICS_PROPERTIES.detail] ??
        properties[ANALYTICS_PROPERTIES.why] ??
        eventName
    ),
    metadata: {
      [ANALYTICS_PROPERTIES.after]:
        properties[ANALYTICS_PROPERTIES.after] ?? input.trigger,
      [ANALYTICS_PROPERTIES.shouldShow]:
        properties[ANALYTICS_PROPERTIES.shouldShow] ?? "yes",
      [ANALYTICS_PROPERTIES.step]: properties[ANALYTICS_PROPERTIES.step] ?? null,
      [ANALYTICS_PROPERTIES.why]: properties[ANALYTICS_PROPERTIES.why] ?? null,
      [ANALYTICS_PROPERTIES.detail]:
        properties[ANALYTICS_PROPERTIES.detail] ?? null,
      trigger: input.trigger,
    },
    severity: eventName === "ad_failed" ? "error" : "warning",
  });
}

function trackAdOpportunity(input: ShowInterstitialInput, adsEnabled: boolean) {
  input.track(ANALYTICS_EVENTS.adRequested.key, {
    ads_enabled: adsEnabled,
    ...buildAdEventProperties(input, {
      shouldShow: true,
      step: input.waitForLoad ? "ensure_load" : "wait_for_load",
      why: "allowed",
    }),
  });
}

function trackAdSkipped(
  input: ShowInterstitialInput,
  reason: string,
  step: AdDecisionStep,
  shouldShow: boolean
) {
  const properties = buildAdEventProperties(input, {
    shouldShow,
    step,
    why: reason,
  });
  input.track(ANALYTICS_EVENTS.adSkipped.key, properties);

  if (shouldShow) {
    captureAdMiss(input, "ad_not_shown", properties);
  }
}

function trackAdFailed(
  input: ShowInterstitialInput,
  reason: string,
  step: AdDecisionStep,
  error?: unknown
) {
  const properties = buildAdEventProperties(input, {
    shouldShow: true,
    step,
    why: reason,
  });
  input.track(ANALYTICS_EVENTS.adFailed.key, properties);
  captureAdMiss(input, "ad_failed", properties, error);
}

function trackAdShown(
  input: ShowInterstitialInput,
  extra?: AnalyticsProperties
) {
  input.track(ANALYTICS_EVENTS.adShown.key, {
    ...buildAdEventProperties(input, {
      shouldShow: true,
      step: "native_show",
      why: "shown",
    }),
    ...extra,
  });
}

function trackAdDismissed(
  input: ShowInterstitialInput,
  extra?: AnalyticsProperties
) {
  input.track(ANALYTICS_EVENTS.adDismissed.key, {
    ...buildAdEventProperties(input, {
      shouldShow: true,
      step: "native_show",
      why: getLastInterstitialWhy(),
    }),
    ...extra,
  });
}

async function presentInterstitial(input: ShowInterstitialInput): Promise<boolean> {
  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  if (!shown) {
    // Do not retry immediately — a flashed native overlay plus a second show
    // stacks ghost windows that freeze the exam result screen.
    trackAdFailed(input, getLastInterstitialWhy() || "show_returned_false", "native_show");
    return false;
  }

  trackAdShown(input);
  recordAdShown();
  clearAppBackgroundMark();
  trackAdDismissed(input);
  return true;
}

/**
 * Shared show path for every interstitial trigger.
 * Intentional moments pass `waitForLoad: true` (exam-style ensure → show).
 * Opportunistic moments pass `waitForLoad: false` and never stall UX.
 */
export async function showInterstitialIfAllowed(
  input: ShowInterstitialInput
): Promise<boolean> {
  const adsEnabled = isAdMobEnabled();
  const routeBlocked =
    typeof input.pathname === "string" ? isAdRouteBlocked(input.pathname) : false;
  const policy = shouldShowInterstitialForTrigger(input.trigger, {
    adsEnabled,
    hasPlusAccess: input.hasPlusAccess,
    practiceAnsweredCount: input.practiceAnsweredCount,
    routeBlocked,
  });

  if (!policy.allowed) {
    trackAdSkipped(
      input,
      policy.reason ?? "trigger_not_ready",
      "policy",
      false
    );
    return false;
  }

  if (!FEATURE_FLAGS.enableAds) {
    trackAdSkipped(input, "disabled", "policy", false);
    return false;
  }

  trackAdOpportunity(input, adsEnabled);

  if (!isInterstitialLoaded()) {
    if (!input.waitForLoad) {
      trackAdSkipped(
        input,
        getLastInterstitialWhy() === "idle"
          ? "not_loaded"
          : `not_loaded:${getLastInterstitialWhy()}`,
        "wait_for_load",
        true
      );
      return false;
    }

    const ready = await ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS);
    if (!ready) {
      trackAdSkipped(
        input,
        getLastInterstitialWhy() === "idle"
          ? "not_loaded"
          : `not_loaded:${getLastInterstitialWhy()}`,
        "ensure_load",
        true
      );
      return false;
    }
  }

  return presentInterstitial(input);
}

/**
 * Intentional unlock gate (e.g. restart exam): try to show an ad even if
 * opportunistic cooldown/cap would skip it. Plus users and disabled ads skip.
 * Fail-open: returns false when the ad cannot be shown.
 */
export async function showInterstitialForUnlockGate(
  input: Omit<ShowInterstitialInput, "trigger" | "waitForLoad"> & {
    trigger?: AdInterstitialTrigger;
  }
): Promise<boolean> {
  const trigger = input.trigger ?? "exam_restart";
  const adsEnabled = isAdMobEnabled();
  const routeBlocked =
    typeof input.pathname === "string" ? isAdRouteBlocked(input.pathname) : false;
  const normalizedInput: ShowInterstitialInput = {
    ...input,
    trigger,
    waitForLoad: true,
  };

  if (input.hasPlusAccess) {
    trackAdSkipped(normalizedInput, "plus_user", "policy", false);
    return false;
  }

  if (!adsEnabled || !FEATURE_FLAGS.enableAds) {
    trackAdSkipped(normalizedInput, "disabled", "policy", false);
    return false;
  }

  if (routeBlocked) {
    trackAdSkipped(normalizedInput, "blocked_route", "policy", false);
    return false;
  }

  if (isExamSessionActive()) {
    trackAdSkipped(normalizedInput, "exam_active", "policy", false);
    return false;
  }

  trackAdOpportunity(normalizedInput, adsEnabled);

  if (!isInterstitialLoaded()) {
    const ready = await ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS);
    if (!ready) {
      trackAdSkipped(
        normalizedInput,
        getLastInterstitialWhy() === "idle"
          ? "not_loaded"
          : `not_loaded:${getLastInterstitialWhy()}`,
        "ensure_load",
        true
      );
      return false;
    }
  }

  // Interstitial briefly backgrounds the app — don't treat that as app_resume.
  return presentInterstitial(normalizedInput);
}

export function maybeShowInterstitial(
  trigger: AdInterstitialTrigger,
  input: Omit<ShowInterstitialInput, "trigger" | "waitForLoad">
) {
  const normalizedInput: ShowInterstitialInput = {
    ...input,
    trigger,
    waitForLoad: false,
  };

  void showInterstitialIfAllowed(normalizedInput).catch((error) => {
    console.warn("Failed to show interstitial ad.", error);
    trackAdFailed(
      normalizedInput,
      getAnalyticsErrorCode(error),
      "native_show",
      error
    );
  });
}

/**
 * Shared ad actions. Prefer this over calling the interstitial controller
 * from screens — same ensure → show path as exam result.
 */
export function useAdInterstitialActions() {
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const hasPlusAccess = useHasPlusAccess();
  const pathname = usePathname();

  const preloadInterstitial = useCallback(() => {
    if (hasPlusAccess || !isAdMobEnabled()) {
      return Promise.resolve(false);
    }

    return ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS)
      .then((ready) => {
        if (!ready) {
          const why = getLastInterstitialWhy() || "not_loaded";
          const properties = buildAdDecisionProperties({
            after: "preload",
            loaded: false,
            pathname,
            shouldShow: false,
            step: "preload",
            waitForLoad: true,
            why,
          });
          captureError({
            area: "ads",
            eventName: "ad_preload_failed",
            message: String(properties.detail ?? why),
            metadata: properties,
            severity: "warning",
          });
        }

        return ready;
      })
      .catch((error) => {
        captureError({
          area: "ads",
          error,
          eventName: "ad_preload_failed",
          message: "Interstitial preload threw.",
          metadata: buildAdDecisionProperties({
            after: "preload",
            loaded: false,
            pathname,
            shouldShow: false,
            step: "preload",
            waitForLoad: true,
            why: getAnalyticsErrorCode(error),
          }),
          severity: "warning",
        });
        return false;
      });
  }, [captureError, hasPlusAccess, pathname]);

  const showInterstitialForTrigger = useCallback(
    (
      trigger: AdInterstitialTrigger,
      options?: Pick<ShowInterstitialInput, "practiceAnsweredCount"> & {
        waitForLoad?: boolean;
      }
    ) =>
      showInterstitialIfAllowed({
        captureError,
        hasPlusAccess,
        pathname,
        practiceAnsweredCount: options?.practiceAnsweredCount,
        track,
        trigger,
        waitForLoad: options?.waitForLoad ?? true,
      }),
    [captureError, hasPlusAccess, pathname, track]
  );

  return {
    /**
     * Warm the next interstitial without showing it (exam restart gate,
     * approaching a practice streak, etc.).
     */
    preloadInterstitial,
    maybeShowInterstitial: (
      trigger: AdInterstitialTrigger,
      options?: Pick<ShowInterstitialInput, "practiceAnsweredCount">
    ) =>
      maybeShowInterstitial(trigger, {
        captureError,
        hasPlusAccess,
        pathname,
        practiceAnsweredCount: options?.practiceAnsweredCount,
        track,
      }),
    showInterstitialForTrigger,
    showInterstitialForUnlockGate: () =>
      showInterstitialForUnlockGate({
        captureError,
        hasPlusAccess,
        pathname,
        track,
      }),
  };
}

export function isAdRouteBlocked(pathname: string) {
  return (
    pathname.includes("/paywall") ||
    pathname.includes("/modals/access-center") ||
    pathname.includes("/modals/ai-chat") ||
    pathname.includes("/(onboarding)")
  );
}

export type { AdInterstitialTrigger, AdSkipReason };
