import { mobileEnv } from "../config/env";

import { readIsTestFlightInstall } from "./is-testflight-install";

/**
 * PostHog shares one production project. Local Metro, EAS development/preview,
 * TestFlight, and e2e would otherwise inflate DAU and funnels. Capture is on
 * only for an App Store / Play production binary that baked
 * EXPO_PUBLIC_POSTHOG_ENABLED=true.
 */
export function isPostHogEnabledForBuild(input: {
  captureEnabled: boolean;
  hasApiKey: boolean;
  isDevBuild: boolean;
  isE2ETestMode: boolean;
  isTestFlightInstall: boolean;
}) {
  if (input.isE2ETestMode || input.isDevBuild || input.isTestFlightInstall) {
    return false;
  }

  return input.captureEnabled && input.hasApiKey;
}

export function isPostHogCaptureEnabled() {
  return isPostHogEnabledForBuild({
    captureEnabled: mobileEnv.posthogCaptureEnabled,
    hasApiKey: Boolean(mobileEnv.posthogKey),
    isDevBuild: __DEV__,
    isE2ETestMode: mobileEnv.enableE2ETestMode,
    isTestFlightInstall: readIsTestFlightInstall(),
  });
}
