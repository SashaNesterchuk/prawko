import { createCheckoutOriginSnapshot, createPaywallOriginSnapshot } from "../offer-origin";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";
import { analyticsOffer } from "./offer-fixture";

describe("bounded analytics origins", () => {
  it.each([["PL", "plans", "paywall2"], ["CZ", "lifetime", "legacy"], ["SK", "lifetime", "legacy"]])(
    "observes %s config without changing its billing offer", (country, offer, variant) => {
      const origin = createPaywallOriginSnapshot({
        country, offer, variant, config_version: 1, default_plan: offer === "plans" ? "quarter" : null,
        category: "B", locale: "en", monetization_version: 2, presentation: "modal", source: "paywall", surface: "home",
      });
      expect(origin).toMatchObject({ paywall_origin_country: country, paywall_origin_offer: offer, paywall_origin_locale: "en" });
      expect(validateAnalyticsPayload("paywall_viewed", { paywall_view_id: "view-a", ...origin }).analytics_payload_valid).toBe(true);
    },
  );

  it("keeps selected input metadata separate from later native package changes", () => {
    const offer = analyticsOffer();
    const values = { plan: "quarter", trial_eligibility: "unknown", trial_shown: true };
    const origin = createCheckoutOriginSnapshot(values, offer);
    values.plan = "month";
    offer.price = 99;
    expect(origin).toMatchObject({
      checkout_origin_plan: "quarter", checkout_origin_price: 49.99,
      checkout_origin_subscription_period: "P3M", checkout_origin_trial_eligibility: "unknown", checkout_origin_trial_shown: true,
    });
    expect(validateAnalyticsPayload("purchase_started", {
      purchase_attempt_id: "attempt-a", checkout_view_id: "view-a", product_id: "product-a",
      ui: "package", step: "purchase_package", ...origin,
    }).analytics_payload_valid).toBe(true);
  });

  it("drops contact/url values under retained fields and leaves a QA limitation", () => {
    const origin = createPaywallOriginSnapshot({ variant: "legacy", source: "private@example.com" });
    expect(origin.paywall_origin_source).toBeUndefined();
    expect(JSON.stringify(origin)).not.toContain("private@example.com");
    expect(validateAnalyticsPayload("paywall_viewed", { paywall_view_id: "view-a", ...origin }).analytics_payload_valid).toBe(false);
  });
});
