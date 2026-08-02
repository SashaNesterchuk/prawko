import { usePathname } from "expo-router";
import { FEATURE_FLAGS } from "@prawko/config";

import { useAnalytics } from "../../providers/AnalyticsProvider";
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

type ShowInterstitialInput = {
  hasPlusAccess: boolean;
  pathname?: string | null;
  practiceAnsweredCount?: number | null;
  track: (event: string, payload?: Record<string, string | number | boolean | null>) => void;
  trigger: AdInterstitialTrigger;
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
  input.track("ad_opportunity", {
    ads_enabled: adsEnabled,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
  input.track("ad_interstitial_requested", {
    ads_enabled: adsEnabled,
    trigger: input.trigger,
  });
}

function trackAdSkipped(
  input: ShowInterstitialInput,
  reason: AdSkipReason
) {
  input.track("ad_skipped", {
    reason,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
  input.track("ad_interstitial_skipped", {
    reason,
    trigger: input.trigger,
  });
}

function trackAdFailed(input: ShowInterstitialInput, message: string) {
  input.track("ad_failed", {
    reason: message,
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
  });
  input.track("ad_interstitial_failed", {
    message,
    trigger: input.trigger,
  });
}

function trackAdShown(
  input: ShowInterstitialInput,
  extra?: Record<string, string | number | boolean | null>
) {
  const payload = {
    trigger: input.trigger,
    type: getAdOpportunityType(input.trigger),
    ...extra,
  };
  input.track("ad_shown", payload);
  input.track("ad_interstitial_shown", payload);
}

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
    trackAdSkipped(input, "not_loaded");
    return false;
  }

  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  if (!shown) {
    trackAdFailed(input, "show_returned_false");
    return false;
  }

  trackAdShown(input);
  recordAdShown();
  clearAppBackgroundMark();
  input.track("ad_interstitial_dismissed", {
    trigger: input.trigger,
  });
  return true;
}

/**
 * Intentional unlock gate (e.g. restart exam): try to show an ad even if
 * opportunistic cooldown/cap would skip it. Plus users and disabled ads skip.
 * Fail-open: returns false when the ad cannot be shown.
 */
export async function showInterstitialForUnlockGate(
  input: Omit<ShowInterstitialInput, "trigger"> & {
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
    const ready = await ensureInterstitialReady({
      attempts: 3,
      timeoutMs: 12_000,
    });
    if (!ready) {
      trackAdSkipped(normalizedInput, "not_loaded");
      return false;
    }
  }

  // Interstitial briefly backgrounds the app — don't treat that as app_resume.
  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  // One more full retry if show itself failed (common on first attempt).
  if (!shown) {
    trackAdFailed(normalizedInput, "show_returned_false_retrying");

    const readyAgain = await ensureInterstitialReady({
      attempts: 2,
      timeoutMs: 8_000,
    });

    if (readyAgain) {
      const retried = await showPreloadedInterstitial();
      if (retried) {
        trackAdShown(normalizedInput, {
          retried: true,
        });
        recordAdShown();
        clearAppBackgroundMark();
        input.track("ad_interstitial_dismissed", {
          trigger,
          retried: true,
        });
        return true;
      }
    }

    trackAdFailed(normalizedInput, "show_returned_false");
    return false;
  }

  trackAdShown(normalizedInput);
  recordAdShown();
  clearAppBackgroundMark();
  input.track("ad_interstitial_dismissed", {
    trigger,
  });
  return true;
}

export function maybeShowInterstitial(
  trigger: AdInterstitialTrigger,
  input: Omit<ShowInterstitialInput, "trigger">
) {
  void showInterstitialIfAllowed({
    ...input,
    trigger,
  }).catch((error) => {
    console.warn("Failed to show interstitial ad.", error);
    input.track("ad_interstitial_failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      trigger,
    });
  });
}

export function useAdInterstitialActions() {
  const { track } = useAnalytics();
  const hasPlusAccess = useHasPlusAccess();
  const pathname = usePathname();

  return {
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
    showInterstitialForTrigger: (
      trigger: AdInterstitialTrigger,
      options?: Pick<ShowInterstitialInput, "practiceAnsweredCount">
    ) =>
      showInterstitialIfAllowed({
        hasPlusAccess,
        pathname,
        practiceAnsweredCount: options?.practiceAnsweredCount,
        track,
        trigger,
      }),
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
