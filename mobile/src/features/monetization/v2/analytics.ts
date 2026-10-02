import {
  ANALYTICS_EVENTS,
  type AnalyticsProperties,
} from "../../../analytics/catalog";
import type { AnalyticsTrack } from "../../../hooks/useAnalytics";
import { createAnalyticsId } from "../../../analytics/runtime-context";
import {
  openPaywall,
  type PaywallSource,
  type PostPurchaseAction,
  type PremiumGateSurface,
  type PaywallRouteContext,
} from "./paywall";

type TrackFn = AnalyticsTrack;

export function trackPremiumGateOpen(
  track: TrackFn,
  properties: AnalyticsProperties & { source: PaywallSource }
) {
  const gateId = typeof properties.premium_gate_id === "string"
    ? properties.premium_gate_id
    : createAnalyticsId("gate");
  const context = { ...properties, premium_gate_id: gateId };
  track(ANALYTICS_EVENTS.premiumGateViewed.key, context);
  track(ANALYTICS_EVENTS.premiumGateAction.key, {
    ...context,
    action: "open_paywall",
  });
  return gateId;
}

export function openTrackedPaywall(
  track: TrackFn,
  input: {
    postPurchaseAction?: PostPurchaseAction;
    properties?: AnalyticsProperties;
    replace?: boolean;
    roadmapStepId?: string;
    source: PaywallSource;
    surface?: PremiumGateSurface;
  } & PaywallRouteContext
) {
  // Forward only known scalar context, never arbitrary properties into routes.
  const context = {
    ...input,
    questionId: input.questionId ?? stringProperty(input.properties, "question_id"),
    topicId: input.topicId ?? stringProperty(input.properties, "topic_id"),
    trainingSessionId: input.trainingSessionId ?? stringProperty(input.properties, "training_session_id"),
    examSessionId: input.examSessionId ?? stringProperty(input.properties, "exam_session_id"),
  };
  const gateId = trackPremiumGateOpen(track, {
    ...input.properties,
    source: input.source,
    ...(input.surface ? { surface: input.surface } : {}),
    ...(input.roadmapStepId ? { roadmap_step_id: input.roadmapStepId } : {}),
    ...(context.questionId ? { question_id: context.questionId } : {}),
    ...(context.topicId ? { topic_id: context.topicId } : {}),
    ...(context.trainingSessionId ? { training_session_id: context.trainingSessionId } : {}),
    ...(context.examSessionId ? { exam_session_id: context.examSessionId } : {}),
    ...(context.sourceScreen ? { source_screen: context.sourceScreen } : {}),
    ...(context.premiumGateId ? { premium_gate_id: context.premiumGateId } : {}),
  });
  openPaywall({
    postPurchaseAction: input.postPurchaseAction,
    questionId: context.questionId,
    topicId: context.topicId,
    trainingSessionId: context.trainingSessionId,
    examSessionId: context.examSessionId,
    sourceScreen: context.sourceScreen,
    premiumGateId: gateId,
    accessBlockId: context.accessBlockId,
    replace: input.replace,
    roadmapStepId: input.roadmapStepId,
    source: input.source,
    surface: input.surface,
  });
}

function stringProperty(properties: AnalyticsProperties | undefined, key: string) {
  const value = properties?.[key];
  return typeof value === "string" && value ? value : undefined;
}
