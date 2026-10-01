import {
  ANALYTICS_EVENTS,
  type AnalyticsProperties,
} from "../../../analytics/catalog";
import type { AnalyticsTrack } from "../../../hooks/useAnalytics";
import {
  openPaywall,
  type PaywallSource,
  type PostPurchaseAction,
  type PremiumGateSurface,
} from "./paywall";

type TrackFn = AnalyticsTrack;

export function trackPremiumGateOpen(
  track: TrackFn,
  properties: AnalyticsProperties & { source: PaywallSource }
) {
  track(ANALYTICS_EVENTS.premiumGateViewed.key, properties);
  track(ANALYTICS_EVENTS.premiumGateAction.key, {
    ...properties,
    action: "open_paywall",
  });
}

export function openTrackedPaywall(
  track: TrackFn,
  input: {
    postPurchaseAction?: PostPurchaseAction;
    properties?: AnalyticsProperties;
    questionId?: string;
    replace?: boolean;
    roadmapStepId?: string;
    source: PaywallSource;
    surface?: PremiumGateSurface;
  }
) {
  trackPremiumGateOpen(track, {
    source: input.source,
    ...(input.surface ? { surface: input.surface } : {}),
    ...(input.roadmapStepId ? { roadmap_step_id: input.roadmapStepId } : {}),
    ...input.properties,
  });
  openPaywall({
    postPurchaseAction: input.postPurchaseAction,
    questionId: input.questionId,
    replace: input.replace,
    roadmapStepId: input.roadmapStepId,
    source: input.source,
    surface: input.surface,
  });
}
