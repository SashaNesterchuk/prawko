import { ANALYTICS_EVENTS } from "../../../../analytics/catalog";
import type { AnalyticsTrack } from "../../../../hooks/useAnalytics";
import { openTrackedPaywall, trackPremiumGateOpen } from "../analytics";
import { buildPaywallHref } from "../paywall";
import { router } from "expo-router";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

describe("premium gate analytics", () => {
  it("records the gate and the open-paywall choice together", () => {
    const events: Array<{ event: string; properties?: Record<string, unknown> }> =
      [];

    trackPremiumGateOpen(
      ((event, properties) => {
        events.push({ event, properties });
      }) as AnalyticsTrack,
      {
        premium_gate_id: "gate-1",
        roadmap_step_id: "PL:0:1",
        source: "roadmap",
        surface: "home_step",
      }
    );

    expect(events).toEqual([
      {
        event: ANALYTICS_EVENTS.premiumGateViewed.key,
        properties: {
          premium_gate_id: "gate-1",
          roadmap_step_id: "PL:0:1",
          source: "roadmap",
          surface: "home_step",
        },
      },
      {
        event: ANALYTICS_EVENTS.premiumGateAction.key,
        properties: {
          premium_gate_id: "gate-1",
          action: "open_paywall",
          roadmap_step_id: "PL:0:1",
          source: "roadmap",
          surface: "home_step",
        },
      },
    ]);
  });

  it("forwards the roadmap step and surface onto the paywall route", () => {
    expect(
      buildPaywallHref({
        roadmapStepId: "PL:0:3",
        source: "roadmap",
        surface: "home_step",
      }).params
    ).toMatchObject({
      roadmapStepId: "PL:0:3",
      source: "roadmap",
      surface: "home_step",
    });
  });

  it("keeps feature and attempt context on the gate-to-paywall chain", () => {
    const events: Array<{ event: string; properties?: Record<string, unknown> }> = [];
    const push = jest.spyOn(router, "push");
    openTrackedPaywall(
      ((event, properties) => events.push({ event, properties })) as AnalyticsTrack,
      {
        source: "explanation",
        properties: {
          topic_id: "intersections_priority",
          question_id: "13123",
          training_session_id: "training-1",
          email: "must-not-enter-route@example.com",
        },
      }
    );
    const gateId = events[0].properties?.premium_gate_id;
    expect(events[1].properties?.premium_gate_id).toBe(gateId);
    expect(push).toHaveBeenLastCalledWith({
      pathname: "/paywall",
      params: {
        feature: "premium_access",
        source: "explanation",
        premiumGateId: gateId,
        topicId: "intersections_priority",
        questionId: "13123",
        trainingSessionId: "training-1",
      },
    });
    push.mockRestore();
  });
});
