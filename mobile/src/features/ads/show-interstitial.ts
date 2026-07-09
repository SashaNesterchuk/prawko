import { FEATURE_FLAGS } from "@prawko/config";

import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useHasPlusAccess } from "../../state/entitlements";
import { isAdMobEnabled } from "./admob-config";
import {
  isExamSessionActive,
  recordAdShown,
  shouldShowInterstitialForTrigger,
  type AdInterstitialTrigger,
  type AdSkipReason,
} from "./ad-session-policy";

type ShowInterstitialInput = {
  hasPlusAccess: boolean;
  track: (event: string, payload?: Record<string, string | number | boolean | null>) => void;
  trigger: AdInterstitialTrigger;
};

let interstitialLoaded = false;

export function setInterstitialLoaded(loaded: boolean) {
  interstitialLoaded = loaded;
}

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

  if (!interstitialLoaded) {
    input.track("ad_interstitial_skipped", {
      reason: "not_loaded",
      trigger: input.trigger,
    });
    return false;
  }

  if (!FEATURE_FLAGS.enableAds) {
    input.track("ad_interstitial_skipped", {
      reason: "disabled",
      trigger: input.trigger,
    });
    return false;
  }

  // Real AdMob SDK integration can hook in here when enableAds is true.
  input.track("ad_interstitial_shown", {
    trigger: input.trigger,
  });
  recordAdShown();
  input.track("ad_interstitial_dismissed", {
    trigger: input.trigger,
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
