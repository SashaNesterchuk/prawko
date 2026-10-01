import { ANALYTICS_EVENTS } from "../../../../analytics/catalog";
import type { AnalyticsTrack } from "../../../../hooks/useAnalytics";
import { trackPremiumGateOpen } from "../analytics";
import { buildPaywallHref } from "../paywall";

describe("premium gate analytics", () => {
  it("records the gate and the open-paywall choice together", () => {
    const events: Array<{ event: string; properties?: Record<string, unknown> }> =
      [];

    trackPremiumGateOpen(
      ((event, properties) => {
        events.push({ event, properties });
      }) as AnalyticsTrack,
      {
        roadmap_step_id: "PL:0:1",
        source: "roadmap",
        surface: "home_step",
      }
    );

    expect(events).toEqual([
      {
        event: ANALYTICS_EVENTS.premiumGateViewed.key,
        properties: {
          roadmap_step_id: "PL:0:1",
          source: "roadmap",
          surface: "home_step",
        },
      },
      {
        event: ANALYTICS_EVENTS.premiumGateAction.key,
        properties: {
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
});