import { ANALYTICS_EVENTS, sanitizeAnalyticsProperties, sanitizeSdkAnalyticsValue } from "../catalog";
import { ANALYTICS_PAYLOAD_CONTRACTS, validateAnalyticsPayload } from "../payload-contract";
import { getAnalyticsDiagnosticsProperties, recordAnalyticsFailure } from "../capture-diagnostics";

describe("critical analytics acceptance contracts", () => {
  it("declares only canonical event names", () => {
    const names = new Set(Object.values(ANALYTICS_EVENTS).map((event) => event.key));
    expect(Object.keys(ANALYTICS_PAYLOAD_CONTRACTS).every((key) => names.has(key as never))).toBe(true);
  });

  it("detects missing IDs, wrong primitive types and invalid enums without copying values", () => {
    const result = validateAnalyticsPayload("question_media_failed", {
      media_load_id: "load-1", media_failure_stage: "raw-secret-error",
    });
    expect(result.analytics_payload_valid).toBe(false);
    expect(result.analytics_payload_invalid_keys).toBe("error_code,media_failure_stage");
    expect(JSON.stringify(result)).not.toContain("raw-secret-error");
    expect(validateAnalyticsPayload("paywall_offer_ready", {
      paywall_view_id: "v", offer_load_id: "l", product_id: "p", currency: "PLN", price: -1,
    }).analytics_payload_valid).toBe(false);
  });

  it("accepts null only where explicitly allowed and does not reinterpret undeclared legacy payloads", () => {
    expect(validateAnalyticsPayload("analytics_identity_observed", {
      app_user_id: "usr_i", supabase_user_id: null, previous_supabase_user_id: null,
      identity_scope: "install", identity_link_version: 1, identity_observation_reason: "initial",
    }).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("paywall_viewed", { paywall_view_id: null }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("profile_action_selected", {}).analytics_payload_contract_status).toBe("not_defined");
  });

  it("drops obvious sensitive strings even under an otherwise allowed key", () => {
    expect(sanitizeAnalyticsProperties({
      detail: "email learner@example.com", label: "https://host/signed?token=secret",
      source: "Bearer secret", long_value: "x".repeat(1025), safe_id: "usr_install-1",
    })).toEqual({ safe_id: "usr_install-1" });
    expect(sanitizeSdkAnalyticsValue({ safe: { detail: "learner@example.com", source: "home" } })).toEqual({
      safe: { detail: undefined, source: "home" },
    });
  });

  it("counts local capture failures without claiming SDK delivery", () => {
    const before = getAnalyticsDiagnosticsProperties();
    recordAnalyticsFailure("capture");
    recordAnalyticsFailure("payload");
    const after = getAnalyticsDiagnosticsProperties();
    expect(after.analytics_capture_error_count).toBe(before.analytics_capture_error_count + 1);
    expect(after.analytics_invalid_payload_count).toBe(before.analytics_invalid_payload_count + 1);
    expect(after.analytics_delivery_status).toBe("not_verified");
  });

  it("requires the new scope schema on new events while preserving unversioned interstitial revenue", () => {
    expect(validateAnalyticsPayload("external_entry_ended", {
      entry_end_reason: "visit_background", entry_elapsed_ms: 1000,
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("ad_native_request_started", {
      ad_request_id: "r", ad_impression_id: "i", ad_request_basis: "sdk_load_invoked",
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("ad_impression_revenue", {
      ad_format: "interstitial", revenue: 0.1, currency: "USD",
    }).analytics_payload_contract_status).toBe("not_defined");
  });
});
