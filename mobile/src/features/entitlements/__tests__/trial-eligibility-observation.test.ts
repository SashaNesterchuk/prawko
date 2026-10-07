import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import { mobileEnv } from "../../../config/env";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";
import { fetchTrialIneligibleProductIds } from "../revenuecat";
import { createPaywallTrialEligibilityTracker } from "../trial-eligibility-observation";
import { analyticsOffer } from "./offer-fixture";
import { getPaywall2PlanAnalyticsSnapshot } from "../../paywall2/analytics";

jest.mock("../../../config/env", () => ({
  mobileEnv: { revenueCatAppleApiKey: "synthetic-ios-key", revenueCatEnableInDev: true, enableE2ETestMode: false },
}));
jest.mock("../../../lib/auth-storage", () => ({ secureSessionStorage: {} }));
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(), logIn: jest.fn(), checkTrialOrIntroductoryPriceEligibility: jest.fn(),
    INTRO_ELIGIBILITY_STATUS: {
      INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0, INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
      INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2, INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
    },
  },
}));
jest.mock("react-native-purchases-ui", () => ({ PAYWALL_RESULT: {} }));

function tracker() {
  const track = jest.fn();
  const observation = createPaywallTrialEligibilityTracker({
    viewId: "view-a", getContext: () => ({ properties: { source: "paywall" }, track, isVisible: true }),
  });
  return { track, observation };
}
function products(track: jest.Mock) {
  return track.mock.calls.filter(([name]) => name === "paywall_trial_eligibility_resolved")
    .map(([, payload]) => payload);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("actual eligibility helper observations with controlled SDK", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    mobileEnv.revenueCatAppleApiKey = "synthetic-ios-key";
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility).mockReset();
  });

  it("keeps the original UI filter but separates actual unknown/missing/no-intro outcomes", async () => {
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility).mockResolvedValue({
      eligible: { status: 2 }, ineligible: { status: 1 }, unknown: { status: 0 }, none: { status: 3 },
    } as never);
    const { track, observation } = tracker();
    const ids = ["eligible", "ineligible", "unknown", "none", "missing"];
    const request = observation.begin(ids);
    await expect(fetchTrialIneligibleProductIds("install-a", ids, request.observe))
      .resolves.toEqual(["ineligible", "unknown", "none", "missing"]);
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledTimes(1);
    expect(products(track).map((row) => [row.eligibility_product_id, row.eligibility_outcome, row.eligibility_basis])).toEqual([
      ["eligible", "eligible", "revenuecat_ios_status"], ["ineligible", "ineligible", "revenuecat_ios_status"],
      ["unknown", "unknown", "sdk_status_unknown"], ["none", "no_intro_offer", "revenuecat_ios_status"],
      ["missing", "unknown", "missing_product_response"],
    ]);
    expect(track.mock.calls.filter(([name]) => name.endsWith("started"))).toHaveLength(1);
    expect(track.mock.calls.filter(([name]) => name.endsWith("completed"))).toHaveLength(1);
    for (const [name, payload] of track.mock.calls) {
      expect(validateAnalyticsPayload(name, payload).analytics_payload_valid).toBe(true);
    }
  });

  it("does not call Android eligibility or mislabel a displayed trial as checked eligible", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    const { track, observation } = tracker();
    const offer = analyticsOffer();
    const ids = [offer.productIdentifier];
    const request = observation.begin(ids);
    const ineligible = await fetchTrialIneligibleProductIds("install-a", ids, request.observe);
    expect(ineligible).toEqual([]);
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    expect(products(track)[0]).toMatchObject({
      eligibility_outcome: "unknown", eligibility_basis: "unsupported_platform", eligibility_native_query_invoked: false,
    });
    expect(getPaywall2PlanAnalyticsSnapshot({
      offers: [offer], selectedPlanId: "quarter", trialIneligibleProductIds: ineligible,
      trialEligibilityProduct: observation.getProduct(offer.productIdentifier, ids.join(",")),
    })).toMatchObject({ trial_days: 3, trial_shown: true, trial_eligibility: "unknown", trial_eligibility_basis: "unsupported_platform" });
  });

  it("retains not-configured without changing the previous empty filter result", async () => {
    mobileEnv.revenueCatAppleApiKey = "";
    const { track, observation } = tracker();
    await expect(fetchTrialIneligibleProductIds("install-a", ["product-a"], observation.begin(["product-a"]).observe))
      .resolves.toEqual([]);
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    expect(products(track)[0]).toMatchObject({ eligibility_basis: "not_configured", eligibility_native_query_invoked: false });
  });

  it("observes empty-product invocation without a native query", async () => {
    const { track, observation } = tracker();
    await expect(fetchTrialIneligibleProductIds("install-a", [], observation.begin([]).observe)).resolves.toEqual([]);
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    expect(products(track)).toEqual([]);
    expect(track.mock.calls.at(-1)?.[1]).toMatchObject({
      eligibility_request_outcome: "no_products", eligibility_resolved_product_count: 0,
    });
  });

  it("retains the original rejection and emits normalized error, not raw error content", async () => {
    const error = Object.assign(new Error("private@example.com receipt"), { code: "10" });
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility).mockRejectedValue(error);
    const { track, observation } = tracker();
    await expect(fetchTrialIneligibleProductIds("install-a", ["product-a"], observation.begin(["product-a"]).observe))
      .rejects.toBe(error);
    expect(products(track)[0]).toMatchObject({ eligibility_outcome: "error", eligibility_error_category: "network" });
    expect(JSON.stringify(track.mock.calls)).not.toContain("private@example.com");
  });

  it("does not coerce malformed string status into eligible", async () => {
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility).mockResolvedValue({ "product-a": { status: "2" } } as never);
    const { track, observation } = tracker();
    await expect(fetchTrialIneligibleProductIds("install-a", ["product-a"], observation.begin(["product-a"]).observe))
      .resolves.toEqual(["product-a"]);
    expect(products(track)[0].eligibility_outcome).toBe("unknown");
  });

  it("keeps detached request outcomes but never replaces a later active product snapshot", async () => {
    const first = deferred<never>();
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility)
      .mockReturnValueOnce(first.promise).mockResolvedValueOnce({ "product-b": { status: 1 } } as never);
    const { track, observation } = tracker();
    const old = observation.begin(["product-a"]);
    const oldResult = fetchTrialIneligibleProductIds("install-a", ["product-a"], old.observe);
    await new Promise((done) => setTimeout(done, 0));
    old.stop();
    const current = observation.begin(["product-b"]);
    await fetchTrialIneligibleProductIds("install-a", ["product-b"], current.observe);
    first.resolve({ "product-a": { status: 2 } } as never);
    await oldResult;
    expect(observation.getProduct("product-b", "product-b")?.outcome).toBe("ineligible");
    expect(observation.getProduct("product-a", "product-a")).toBeNull();
    expect(products(track).find((row) => row.eligibility_product_id === "product-a")).toMatchObject({
      eligibility_observer_active: false, eligibility_view_visible: false, eligibility_outcome: "eligible",
    });
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledTimes(2);
  });

  it("does not let context/callback failure change the UI filter or SDK call count", async () => {
    jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility).mockResolvedValue({ "product-a": { status: 2 } } as never);
    const observation = createPaywallTrialEligibilityTracker({
      viewId: "view-a", getContext: () => { throw new Error("capture unavailable"); },
    });
    await expect(fetchTrialIneligibleProductIds("install-a", ["product-a"], observation.begin(["product-a"]).observe))
      .resolves.toEqual([]);
    await expect(fetchTrialIneligibleProductIds("install-a", ["product-a"], () => { throw new Error("observer"); }))
      .resolves.toEqual([]);
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledTimes(2);
  });

  it("retires an older request on begin even before explicit cleanup", () => {
    const { track, observation } = tracker();
    const old = observation.begin(["product-a"]);
    observation.begin(["product-b"]);
    old.observe({
      phase: "completed", platform: "ios", outcome: "resolved", nativeQueryInvoked: true,
      errorCategory: null, products: [{ productId: "product-a", outcome: "eligible", basis: "revenuecat_ios_status" }],
    });
    expect(products(track)[0]).toMatchObject({ eligibility_observer_active: false, eligibility_view_visible: false });
    expect(observation.getProduct("product-b", "product-b")?.basis).toBe("pending");
  });

  it("captures request context once and emits stages at most once", () => {
    const track = jest.fn();
    let country = "PL";
    const observation = createPaywallTrialEligibilityTracker({
      viewId: "view-a", getContext: () => ({ properties: { exam_country: country }, track, isVisible: true }),
    });
    const request = observation.begin(["product-a", "product-a"]);
    country = "CZ";
    const started = { phase: "started", platform: "ios" } as const;
    const completed = {
      phase: "completed", platform: "ios", outcome: "resolved", nativeQueryInvoked: true,
      errorCategory: null, products: [{ productId: "product-a", outcome: "eligible", basis: "revenuecat_ios_status" }],
    } as const;
    request.observe(started);
    request.observe(started);
    request.observe({ ...completed, products: [...completed.products] });
    request.observe({ ...completed, products: [...completed.products] });
    expect(track).toHaveBeenCalledTimes(3);
    for (const [, payload] of track.mock.calls) {
      expect(payload).toMatchObject({
        exam_country: "PL", eligibility_requested_product_count: 2, eligibility_distinct_product_count: 1,
      });
    }
  });
});
