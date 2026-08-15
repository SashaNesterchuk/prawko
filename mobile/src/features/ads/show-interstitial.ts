import { usePathname } from "expo-router";
import { useCallback } from "react";
import { FEATURE_FLAGS } from "@prawko/config";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import type { AnalyticsTrack } from "../../providers/AnalyticsProvider";
import { useHasPlusAccess } from "../../state/entitlements";
import { isAdMobEnabled } from "./admob-config";
import {
  clearAppBackgroundMark,
  isExamSessionActive,
  recordAdShown,
  shouldShowInterstitialForTrigger,
  suppressAppResumeAds,
  type AdInterstitialTrigger,
  type AdSkipReason,
} from "./ad-session-policy";
import {
  isInterstitialLoaded,
  showPreloadedInterstitial,
  ensureInterstitialReady,
} from "./interstitial-controller";

/** Cap intentional warm-up so exam result never waits more than a few seconds. */
export const INTERSTITIAL_ENSURE_OPTIONS = {
  attempts: 2,
  timeoutMs: 5_000,
} as const;

type ShowInterstitialInput = {
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

function trackAdOpportunity(input: ShowInterstitialInput, adsEnabled: boolean) {
  input.track(ANALYTICS_EVENTS.adRequested.key, {
    ads_enabled: adsEnabled,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
}

function trackAdSkipped(
  input: ShowInterstitialInput,
  reason: AdSkipReason
) {
  input.track(ANALYTICS_EVENTS.adSkipped.key, {
    reason,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
}

function trackAdFailed(input: ShowInterstitialInput, reason: string) {
  input.track(ANALYTICS_EVENTS.adFailed.key, {
    reason,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
}

function trackAdShown(
  input: ShowInterstitialInput,
  extra?: AnalyticsProperties
) {
  const payload = {
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
    ...extra,
  };
  input.track(ANALYTICS_EVENTS.adShown.key, payload);
}

function trackAdDismissed(
  input: ShowInterstitialInput,
  extra?: AnalyticsProperties
) {
  input.track(ANALYTICS_EVENTS.adDismissed.key, {
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
    ...extra,
  });
}

async function presentInterstitial(input: ShowInterstitialInput): Promise<boolean> {
  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  if (!shown) {
    // Load → show failed: one short retry, then skip. Never leave UI hung.
    trackAdFailed(input, "show_returned_false_retrying");

    const readyAgain = await ensureInterstitialReady({
      attempts: 1,
      timeoutMs: 3_000,
    });

    if (readyAgain) {
      const retried = await showPreloadedInterstitial();
      if (retried) {
        trackAdShown(input, { retried: true });
        recordAdShown();
        clearAppBackgroundMark();
        trackAdDismissed(input, { retried: true });
        return true;
      }
    }

    trackAdFailed(input, "show_returned_false");
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
    if (policy.reason && policy.reason !== "trigger_not_ready") {
      trackAdSkipped(input, policy.reason);
    }

    return false;
  }

  if (!FEATURE_FLAGS.enableAds) {
    trackAdSkipped(input, "disabled");
    return false;
  }

  trackAdOpportunity(input, adsEnabled);

  if (!isInterstitialLoaded()) {
    if (!input.waitForLoad) {
      trackAdSkipped(input, "not_loaded");
      return false;
    }

    const ready = await ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS);
    if (!ready) {
      trackAdSkipped(input, "not_loaded");
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
    trackAdSkipped(normalizedInput, "plus_user");
    return false;
  }

  if (!adsEnabled || !FEATURE_FLAGS.enableAds) {
    trackAdSkipped(normalizedInput, "disabled");
    return false;
  }

  if (routeBlocked) {
    trackAdSkipped(normalizedInput, "blocked_route");
    return false;
  }

  if (isExamSessionActive()) {
    trackAdSkipped(normalizedInput, "exam_active");
    return false;
  }

  trackAdOpportunity(normalizedInput, adsEnabled);

  if (!isInterstitialLoaded()) {
    const ready = await ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS);
    if (!ready) {
      trackAdSkipped(normalizedInput, "not_loaded");
      return false;
    }
  }

  // Interstitial briefly backgrounds the app — don't treat that as app_resume.
  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  // One more short retry if show itself failed (common on first attempt).
  if (!shown) {
    trackAdFailed(normalizedInput, "show_returned_false_retrying");

    const readyAgain = await ensureInterstitialReady({
      attempts: 1,
      timeoutMs: 3_000,
    });

    if (readyAgain) {
      const retried = await showPreloadedInterstitial();
      if (retried) {
        trackAdShown(normalizedInput, {
          retried: true,
        });
        recordAdShown();
        clearAppBackgroundMark();
        trackAdDismissed(normalizedInput, { retried: true });
        return true;
      }
    }

    trackAdFailed(normalizedInput, "show_returned_false");
    return false;
  }

  trackAdShown(normalizedInput);
  recordAdShown();
  clearAppBackgroundMark();
  trackAdDismissed(normalizedInput);
  return true;
}

export function maybeShowInterstitial(
  trigger: AdInterstitialTrigger,
  input: Omit<ShowInterstitialInput, "trigger" | "waitForLoad">
) {
  void showInterstitialIfAllowed({
    ...input,
    trigger,
    waitForLoad: false,
  }).catch((error) => {
    console.warn("Failed to show interstitial ad.", error);
    trackAdFailed(
      {
        ...input,
        trigger,
        waitForLoad: false,
      },
      error instanceof Error ? error.name || "unknown_error" : "unknown_error"
    );
  });
}

/**
 * Shared ad actions. Prefer this over calling the interstitial controller
 * from screens — same ensure → show path as exam result.
 */
export function useAdInterstitialActions() {
  const { track } = useAnalytics();
  const hasPlusAccess = useHasPlusAccess();
  const pathname = usePathname();

  const preloadInterstitial = useCallback(() => {
    if (hasPlusAccess || !isAdMobEnabled()) {
      return Promise.resolve(false);
    }

    return ensureInterstitialReady(INTERSTITIAL_ENSURE_OPTIONS).catch(() => false);
  }, [hasPlusAccess]);

  const showInterstitialForTrigger = useCallback(
    (
      trigger: AdInterstitialTrigger,
      options?: Pick<ShowInterstitialInput, "practiceAnsweredCount"> & {
        waitForLoad?: boolean;
      }
    ) =>
      showInterstitialIfAllowed({
        hasPlusAccess,
        pathname,
        practiceAnsweredCount: options?.practiceAnsweredCount,
        track,
        trigger,
        waitForLoad: options?.waitForLoad ?? true,
      }),
    [hasPlusAccess, pathname, track]
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
        hasPlusAccess,
        pathname,
        practiceAnsweredCount: options?.practiceAnsweredCount,
        track,
      }),
    showInterstitialForTrigger,
    showInterstitialForUnlockGate: () =>
      showInterstitialForUnlockGate({
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
