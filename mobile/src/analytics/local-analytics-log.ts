import type { AnalyticsProperties } from "./catalog";
import { mobileEnv } from "../config/env";

import { isPostHogCaptureEnabled } from "./posthog-build-gate";

const LOCAL_ANALYTICS_URL = "http://127.0.0.1:8799/events";

/**
 * Local Metro / e2e sessions do not send PostHog. This file is the ground
 * truth for comparing a known Maestro path with the event stream.
 * A production capture build never writes here.
 */
export function isLocalAnalyticsLogEnabled(input: {
  isDevBuild: boolean;
  isE2ETestMode: boolean;
  posthogCaptureEnabled: boolean;
}) {
  if (input.posthogCaptureEnabled) {
    return false;
  }

  return input.isDevBuild || input.isE2ETestMode;
}

export function recordLocalAnalytics(entry: {
  kind: "capture" | "screen" | "identify";
  event: string;
  properties?: AnalyticsProperties;
}) {
  if (
    !isLocalAnalyticsLogEnabled({
      isDevBuild: __DEV__,
      isE2ETestMode: mobileEnv.enableE2ETestMode,
      posthogCaptureEnabled: isPostHogCaptureEnabled(),
    })
  ) {
    return;
  }

  void fetch(LOCAL_ANALYTICS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...entry, at: new Date().toISOString() }),
  }).catch(() => undefined);
}
