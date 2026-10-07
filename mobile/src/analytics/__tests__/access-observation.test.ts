import { featureAccessProperties, observeFeatureAccess, type AccessObservationSnapshot } from "../access-observation";
import { validateAnalyticsPayload } from "../payload-contract";

jest.mock("@prawko/config", () => ({
  ...jest.requireActual("@prawko/config"), FEATURE_FLAGS: { devPlusAccess: false },
}));
jest.mock("../../config/env", () => ({ mobileEnv: { enableE2ETestMode: false } }));
jest.mock("../../state/app-shell", () => ({
  useAppShellStore: { getState: () => ({}) }, getCurrentUserFromState: () => null,
}));
const mockGetState = jest.fn();
jest.mock("../../state/entitlements", () => ({
  useEntitlementStore: { getState: () => mockGetState() }, readHasPlusAccess: () => true,
}));

const now = Date.parse("2026-10-07T10:00:00Z");
const snapshot: AccessObservationSnapshot = {
  plus: true, purchaseGranted: true, remoteGranted: false, schoolPresent: false, override: false,
  revenueCatStatus: "ready", remoteStatus: "ready", customerInfoDate: now - 60_000,
};

describe("feature access observations", () => {
  it("records a blocked local Plus feature, not a verified payment or automatic product defect", () => {
    expect(featureAccessProperties("offline_access_blocked", {}, snapshot, now)).toMatchObject({
      access_observed_feature: "offline_mode", access_comparison: "blocked_despite_plus",
      access_expected: "allowed", access_observed: "blocked", access_expected_source: "purchase",
      access_customer_info_age_ms: 60_000, access_customer_info_time_basis: "revenuecat_request_date",
      access_remote_verification_age_ms: null, access_snapshot_basis: "current_local_entitlement_store",
    });
  });

  it("does not call an expected Premium requirement a mismatch", () => {
    expect(featureAccessProperties("ai_chat_access_blocked", {}, { ...snapshot, plus: false }, now))
      .toMatchObject({ access_comparison: "consistent", access_expected: "blocked" });
    expect(featureAccessProperties("ai_chat_access_blocked", {}, {
      ...snapshot, plus: false, remoteStatus: "loading",
    }, now)).toMatchObject({ access_comparison: "not_comparable", access_expected: "not_evaluated" });
  });

  it("does not infer free quota or roadmap prerequisites from missing context", () => {
    expect(featureAccessProperties("premium_gate_viewed", { source: "training_limit" }, {
      ...snapshot, plus: false,
    }, now)).toMatchObject({ access_comparison: "not_comparable" });
    expect(featureAccessProperties("premium_gate_viewed", { source: "training_limit" }, snapshot, now))
      .toMatchObject({ access_comparison: "blocked_despite_plus", access_observed_feature: "training" });
    expect(featureAccessProperties("premium_gate_viewed", { source: "roadmap", surface: "home_step" }, snapshot, now))
      .toMatchObject({ access_comparison: "not_comparable" });
    expect(featureAccessProperties("premium_gate_viewed", { source: "roadmap", surface: "topics" }, snapshot, now))
      .toMatchObject({ access_comparison: "blocked_despite_plus" });
  });

  it("keeps PL inline marks, upsells, paywall views and offline dependencies out of mismatches", () => {
    expect(featureAccessProperties("premium_gate_viewed", {
      source: "explanation", presentation: "inline_mark",
    }, snapshot, now)).toMatchObject({ access_observed: "premium_mark", access_comparison: "not_comparable" });
    expect(featureAccessProperties("premium_gate_viewed", { source: "profile" }, snapshot, now))
      .toMatchObject({ access_observed: "upsell", access_comparison: "not_comparable" });
    expect(featureAccessProperties("learning_access_blocked", { feature: "exam" }, snapshot, now))
      .toMatchObject({ access_observed: "non_entitlement_block", access_comparison: "not_comparable" });
    expect(featureAccessProperties("paywall_viewed", { is_plus: true }, snapshot, now)).toEqual({});
  });

  it("distinguishes observed Premium explanation access from the PL free-topic exception", () => {
    const free = { ...snapshot, plus: false, purchaseGranted: false };
    expect(featureAccessProperties("answer_explanation_viewed", { access_method: "premium" }, free, now))
      .toMatchObject({ access_comparison: "premium_content_without_plus" });
    expect(featureAccessProperties("answer_explanation_viewed", { access_method: "free_topic" }, free, now))
      .toMatchObject({ access_comparison: "not_comparable" });
  });

  it("keeps missing/future CustomerInfo times and school/runtime sources explicit", () => {
    expect(featureAccessProperties("offline_access_blocked", {}, { ...snapshot, customerInfoDate: null }, now))
      .toMatchObject({ access_customer_info_age_ms: null, access_customer_info_clock_order: "not_recorded" });
    expect(featureAccessProperties("offline_access_blocked", {}, { ...snapshot, customerInfoDate: now + 1 }, now))
      .toMatchObject({ access_customer_info_age_ms: null, access_customer_info_clock_order: "future" });
    expect(featureAccessProperties("offline_access_blocked", {}, {
      ...snapshot, purchaseGranted: false, remoteGranted: true, schoolPresent: true,
    }, now)).toMatchObject({ access_expected_source: "school" });
    expect(featureAccessProperties("offline_access_blocked", {}, { ...snapshot, override: true }, now))
      .toMatchObject({ access_expected_source: "runtime_override" });
  });

  it("ignores stale payload Plus and fails closed only for optional diagnostics", () => {
    expect(featureAccessProperties("ai_chat_access_blocked", { is_plus: false }, snapshot, now))
      .toMatchObject({ access_expected_is_plus: true, access_comparison: "blocked_despite_plus" });
    mockGetState.mockImplementation(() => { throw new Error("store diagnostic unavailable"); });
    expect(observeFeatureAccess("offline_access_blocked", {})).toEqual({});
    expect(observeFeatureAccess("paywall_viewed", {})).toEqual({});
  });

  it("validates the shared access snapshot contract, including nullable timestamps", () => {
    const properties = featureAccessProperties("offline_access_blocked", {}, snapshot, now);
    expect(validateAnalyticsPayload("offline_access_blocked", properties).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("offline_access_blocked", {
      ...properties, access_comparison: "raw-secret", access_customer_info_age_ms: -1,
    })).toMatchObject({
      analytics_payload_valid: false,
      analytics_payload_invalid_keys: "access_comparison,access_customer_info_age_ms",
    });
  });
});
