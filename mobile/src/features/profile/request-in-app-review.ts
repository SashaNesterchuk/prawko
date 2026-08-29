import * as StoreReview from "expo-store-review";
import { REVIEW_PROMPT_POLICY } from "@prawko/config";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { mobileEnv } from "../../config/env";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import {
  getLastAdShownAt,
  isExamSessionActive,
} from "../ads/ad-session-policy";
import { isInterstitialShowing } from "../ads/interstitial-controller";
import { useReviewPromptStore } from "../../state/review-prompt";

import {
  getAdQuietWaitMs,
  shouldRequestInAppReview,
  type InAppReviewPromptDecision,
  type InAppReviewPromptSource,
} from "./review-prompt-policy";

export type MaybeRequestInAppReviewInput = {
  isTimedSession?: boolean;
  mode?: string | null;
  positiveOutcome: boolean;
  source: InAppReviewPromptSource;
  track: AnalyticsTrack;
};

export type RequestInAppReviewDeps = {
  getLastAdShownAt: () => number | null;
  isE2ETestMode: boolean;
  isExamSessionActive: () => boolean;
  isInterstitialShowing: () => boolean;
  isReviewAvailable: () => Promise<boolean>;
  markPrompted: () => void;
  now: () => number;
  promptedAt: string | null;
  requestReview: () => Promise<void>;
  storeHydrated: boolean;
  wait: (ms: number) => Promise<void>;
};

function defaultDeps(): RequestInAppReviewDeps {
  const store = useReviewPromptStore.getState();

  return {
    getLastAdShownAt,
    isE2ETestMode: mobileEnv.enableE2ETestMode,
    isExamSessionActive,
    isInterstitialShowing,
    isReviewAvailable: () => StoreReview.isAvailableAsync(),
    markPrompted: () => store.markPrompted(),
    now: Date.now,
    promptedAt: store.promptedAt,
    requestReview: () => StoreReview.requestReview(),
    storeHydrated: store.hasHydrated,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

const SILENT_SKIP_REASONS = new Set([
  "e2e",
  "not_hydrated",
  "not_positive",
]);

function reviewPromptPayload(input: {
  mode?: string | null;
  reason?: string;
  source: InAppReviewPromptSource;
}) {
  return {
    mode: input.mode ?? null,
    source: input.source,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

export async function maybeRequestInAppReview(
  input: MaybeRequestInAppReviewInput,
  overrides?: Partial<RequestInAppReviewDeps>
): Promise<InAppReviewPromptDecision> {
  const resolveDeps = () => ({ ...defaultDeps(), ...overrides });
  const deps = resolveDeps();
  const waitMs = getAdQuietWaitMs({
    lastAdShownAt: deps.getLastAdShownAt(),
    now: deps.now(),
  });

  if (waitMs > 0 && waitMs <= REVIEW_PROMPT_POLICY.adQuietPeriodMs) {
    await deps.wait(waitMs);
  }

  const latest = resolveDeps();
  const decision = shouldRequestInAppReview({
    alreadyPrompted: Boolean(latest.promptedAt),
    isE2ETestMode: latest.isE2ETestMode,
    isExamSessionActive: latest.isExamSessionActive(),
    isInterstitialShowing: latest.isInterstitialShowing(),
    isTimedSession: input.isTimedSession ?? false,
    lastAdShownAt: latest.getLastAdShownAt(),
    mode: input.mode,
    now: latest.now(),
    positiveOutcome: input.positiveOutcome,
    source: input.source,
    storeHydrated: latest.storeHydrated,
  });

  if (!decision.allowed) {
    if (!SILENT_SKIP_REASONS.has(decision.reason)) {
      input.track(
        ANALYTICS_EVENTS.appReviewSkipped.key,
        reviewPromptPayload({
          mode: input.mode,
          reason: decision.reason,
          source: input.source,
        })
      );
    }

    return decision;
  }

  const available = await latest.isReviewAvailable();
  if (!available) {
    input.track(
      ANALYTICS_EVENTS.appReviewSkipped.key,
      reviewPromptPayload({
        mode: input.mode,
        reason: "unavailable",
        source: input.source,
      })
    );
    return { allowed: false, reason: "unavailable" };
  }

  latest.markPrompted();
  input.track(
    ANALYTICS_EVENTS.appReviewRequested.key,
    reviewPromptPayload({
      mode: input.mode,
      source: input.source,
    })
  );

  try {
    await latest.requestReview();
  } catch {
    input.track(
      ANALYTICS_EVENTS.appReviewFailed.key,
      reviewPromptPayload({
        mode: input.mode,
        reason: "request_failed",
        source: input.source,
      })
    );
  }

  return { allowed: true };
}
