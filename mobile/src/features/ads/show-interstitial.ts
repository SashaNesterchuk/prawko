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
  track: (event: string, payload?: Record<string, string | number | boolean | null>) => void;
  trigger: AdInterstitialTrigger;
};

export async function showInterstitialIfAllowed(
  input: ShowInterstitialInput
): Promise<boolean> {
  const adsEnabled = isAdMobEnabled();
  const policy = shouldShowInterstitialForTrigger(input.trigger, {
    adsEnabled,
    hasPlusAccess: input.hasPlusAccess,
  });

  input.track("ad_interstitial_requested", {
    ads_enabled: adsEnabled,
    trigger: input.trigger,
  });

  if (!policy.allowed) {
    if (policy.reason && policy.reason !== "trigger_not_ready") {
      input.track("ad_interstitial_skipped", {
        reason: policy.reason,
        trigger: input.trigger,
      });
    }

    return false;
  }

  if (!FEATURE_FLAGS.enableAds) {
    input.track("ad_interstitial_skipped", {
      reason: "disabled",
      trigger: input.trigger,
    });
    return false;
  }

  if (!isInterstitialLoaded()) {
    input.track("ad_interstitial_skipped", {
      reason: "not_loaded",
      trigger: input.trigger,
    });
    return false;
  }

  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  if (!shown) {
    input.track("ad_interstitial_failed", {
      message: "show_returned_false",
      trigger: input.trigger,
    });
    return false;
  }

  input.track("ad_interstitial_shown", {
    trigger: input.trigger,
  });
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

  input.track("ad_interstitial_requested", {
    ads_enabled: adsEnabled,
    trigger,
  });

  if (input.hasPlusAccess) {
    input.track("ad_interstitial_skipped", {
      reason: "plus_user",
      trigger,
    });
    return false;
  }

  if (!adsEnabled || !FEATURE_FLAGS.enableAds) {
    input.track("ad_interstitial_skipped", {
      reason: "disabled",
      trigger,
    });
    return false;
  }

  if (isExamSessionActive()) {
    input.track("ad_interstitial_skipped", {
      reason: "exam_active",
      trigger,
    });
    return false;
  }

  if (!isInterstitialLoaded()) {
    const ready = await ensureInterstitialReady({
      attempts: 3,
      timeoutMs: 12_000,
    });
    if (!ready) {
      input.track("ad_interstitial_skipped", {
        reason: "not_loaded",
        trigger,
      });
      return false;
    }
  }

  // Interstitial briefly backgrounds the app — don't treat that as app_resume.
  suppressAppResumeAds();
  clearAppBackgroundMark();

  const shown = await showPreloadedInterstitial();

  // One more full retry if show itself failed (common on first attempt).
  if (!shown) {
    input.track("ad_interstitial_failed", {
      message: "show_returned_false_retrying",
      trigger,
    });

    const readyAgain = await ensureInterstitialReady({
      attempts: 2,
      timeoutMs: 8_000,
    });

    if (readyAgain) {
      const retried = await showPreloadedInterstitial();
      if (retried) {
        input.track("ad_interstitial_shown", {
          trigger,
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

    input.track("ad_interstitial_failed", {
      message: "show_returned_false",
      trigger,
    });
    return false;
  }

  input.track("ad_interstitial_shown", {
    trigger,
  });
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

  return {
    maybeShowInterstitial: (trigger: AdInterstitialTrigger) =>
      maybeShowInterstitial(trigger, {
        hasPlusAccess,
        track,
      }),
    showInterstitialForUnlockGate: () =>
      showInterstitialForUnlockGate({
        hasPlusAccess,
        track,
      }),
  };
}

export function isAdRouteBlocked(pathname: string) {
  return (
    pathname.includes("/paywall") ||
    pathname.includes("/modals/ai-chat") ||
    pathname.includes("/(onboarding)")
  );
}

export type { AdInterstitialTrigger, AdSkipReason };
