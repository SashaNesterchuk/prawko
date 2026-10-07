import { AppState } from "react-native";

import { useEntitlementStore, type RevenueCatPackageSummary } from "../../../state/entitlements";
import { selectPaywall2AnalyticsPlan } from "../../paywall2/analytics";
import { createPaywallOfferTracker } from "../paywall-offer-analytics";

jest.mock("../../../identity/app-user-id", () => {
  let counter = 0;
  return { createAppUserId: () => `usr_offer-${++counter}` };
});

function offer(period = "P3M", packageType = "THREE_MONTH"): RevenueCatPackageSummary {
  return {
    identifier: `pkg-${period}`, offeringIdentifier: "default", productIdentifier: `premium-${period}`,
    packageType, subscriptionPeriod: period, price: 49.99, priceString: "49.99 PLN",
    currencyCode: "PLN", title: "", description: "",
    pricePerMonthString: null, pricePerWeekString: null, pricePerYearString: null,
  };
}

describe("paywall availability with synchronous store updates", () => {
  const track = jest.fn();
  let visible = true;
  let configured = true;
  let tracker: ReturnType<typeof createPaywallOfferTracker>;

  beforeEach(() => {
    useEntitlementStore.getState().clearRevenueCatState();
    AppState.currentState = "active";
    visible = true;
    configured = true;
    tracker = createPaywallOfferTracker({
      viewId: "view-1",
      getContext: () => ({
        track, properties: { paywall_offer: "plans" }, sdkConfigured: configured, isVisible: visible,
        // Same selector as the screen; the selected plan does not need a React rerender.
        selectPackage: (offers) => selectPaywall2AnalyticsPlan(offers, "quarter")?.package ?? null,
      }),
    });
  });
  afterEach(() => tracker.stop());

  function begin(id = "request-1") {
    useEntitlementStore.getState().beginRevenueCatOfferingsLoad({
      id, source: "paywall_open", status: "loading", startedAt: Date.now(),
      completedAt: null, diagnostic: {}, errorCode: null,
    });
  }

  it("reports ready after delayed hydration without waiting for the screen rerender", () => {
    tracker.start(Date.now());
    begin();
    useEntitlementStore.getState().finishRevenueCatOfferingsLoad({ id: "request-1", offerings: [offer()] });
    tracker.observe();
    expect(track.mock.calls.map(([event]) => event)).toEqual([
      "paywall_offer_load_started", "paywall_offer_ready",
    ]);
    expect(track.mock.calls[1][1]).toMatchObject({
      offers_count: 1, product_id: "premium-P3M", subscription_period: "P3M",
    });
    expect(track.mock.calls[0][1].offer_load_id).toBe(track.mock.calls[1][1].offer_load_id);
  });

  it("reports cached readiness and a separate refresh cycle exactly once", () => {
    useEntitlementStore.setState({ revenueCatOfferings: [offer()] });
    tracker.start(Date.now());
    begin("refresh");
    useEntitlementStore.getState().finishRevenueCatOfferingsLoad({ id: "refresh", offerings: [offer()] });
    tracker.observe();
    expect(track.mock.calls.map(([event]) => event)).toEqual([
      "paywall_offer_load_started", "paywall_offer_ready",
      "paywall_offer_load_started", "paywall_offer_ready",
    ]);
    expect(track.mock.calls[0][1].offer_load_id).not.toBe(track.mock.calls[2][1].offer_load_id);
  });

  it("accepts the displayed fallback plan, but never annual or lifetime offers", () => {
    tracker.start(Date.now());
    begin();
    useEntitlementStore.getState().finishRevenueCatOfferingsLoad({
      id: "request-1", offerings: [offer("P1M", "MONTHLY")],
    });
    expect(track.mock.calls[1][0]).toBe("paywall_offer_ready");
    begin("unsupported");
    useEntitlementStore.getState().finishRevenueCatOfferingsLoad({
      id: "unsupported", offerings: [offer("P1Y", "ANNUAL"), offer("", "LIFETIME")],
    });
    expect(track.mock.calls[3]).toEqual(["paywall_offer_failed", expect.objectContaining({
      failure_reason: "empty_offerings", offers_count: 2,
    })]);
  });

  it("censors hidden outcomes until the view is observed again", () => {
    tracker.start(Date.now());
    begin();
    visible = false;
    useEntitlementStore.getState().finishRevenueCatOfferingsLoad({ id: "request-1", offerings: [offer()] });
    expect(track).toHaveBeenCalledTimes(1);
    visible = true;
    tracker.observe();
    expect(track.mock.calls[1][0]).toBe("paywall_offer_ready");
  });

  it("distinguishes missing SDK configuration", () => {
    configured = false;
    expect(() => tracker.start(Date.now())).not.toThrow();
    expect(track.mock.calls[1][1].failure_reason).toBe("not_configured");
  });

  it("does not throw into the entitlement store when telemetry fails", () => {
    tracker.start(Date.now());
    begin();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    track.mockImplementationOnce(() => { throw new Error("capture unavailable"); });
    expect(() => useEntitlementStore.getState().finishRevenueCatOfferingsLoad({
      id: "request-1", offerings: [offer()],
    })).not.toThrow();
    expect(useEntitlementStore.getState().revenueCatOfferingsLoad?.status).toBe("ready");
  });
});
