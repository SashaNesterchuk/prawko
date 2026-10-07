import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { ExternalEntryScope, RewardedObservationScope } from "../observation-payloads";

const entry: ExternalEntryScope = {
  entry_observation_version: 1, entry_observation_id: "entry-one", entry_kind: "deep_link",
  entry_signal_origin: "live_url", entry_signal_received_at: "2026-10-07T10:00:00Z",
  entry_observed_at: "2026-10-07T10:00:00Z", entry_observation_time_basis: "client_signal_processing_not_tap",
  entry_scope_status: "bound_visit", entry_bound_app_visit_id: "visit-one",
  entry_target_route_pattern: "/learn", entry_target_screen_name: "learn",
  entry_target_entity_revision: null, entry_target_entity_required: false,
  entry_target_basis: "normalized_static_route", entry_destination_horizon_seconds: 60,
  entry_association_horizon_seconds: 3600, notification_response_revision: null,
};
const ad: RewardedObservationScope = {
  ad_observation_version: 1, ad_format: "rewarded", ad_request_id: "ad-request-one",
  ad_impression_id: "ad-impression-one", ad_unit_basis: "test_unit", ad_native_load_observed: true,
  ad_opened_observed: false, placement: "exam_unlock",
};

void function checkObservationPayloads(track: AnalyticsTrack) {
  track("external_entry_ended", { ...entry, entry_end_reason: "visit_background", entry_elapsed_ms: 1 });
  track("ad_native_request_started", { ...ad, ad_request_basis: "sdk_load_invoked" });
  track("ad_impression_observed", { ...ad, ad_impression_basis: "sdk_paid_callback", ad_native_terminal_observed: false });
  track("ad_observation_failed", { ...ad, observation_stage: "paid_payload", why: "unparseable_revenue" });
  // Missing operational IDs remain observable; they do not become valid impressions at runtime.
  track("ad_impression_observed", { ...ad, ad_request_id: null, ad_impression_id: null,
    ad_impression_basis: "sdk_paid_callback", ad_native_terminal_observed: false });

  // @ts-expect-error A destination observation cannot lose its signal and visit context.
  track("external_entry_ended", { entry_end_reason: "visit_background", entry_elapsed_ms: 1 });
  // @ts-expect-error Unobserved delivery cannot be a destination terminal reason.
  track("external_entry_ended", { ...entry, entry_end_reason: "notification_not_delivered", entry_elapsed_ms: 1 });
  // @ts-expect-error Destination association uses the declared observation horizon, not a product timeout.
  track("external_entry_ended", { ...entry, entry_association_horizon_seconds: 60, entry_end_reason: "visit_background", entry_elapsed_ms: 1 });
  // @ts-expect-error A static route match is not a native dispatch success.
  track("external_entry_destination_observed", { ...entry, entry_destination_route_pattern: "/learn", entry_destination_screen_name: "learn", entry_destination_entity_revision: null, entry_destination_phase: "usable", entry_destination_match: "dispatch_success", entry_destination_basis: "foreground_route_transition", entry_elapsed_ms: 1 });
  // @ts-expect-error OPENED is not PAID-impression evidence.
  track("ad_impression_observed", { ...ad, ad_impression_basis: "sdk_opened", ad_native_terminal_observed: false });
  // @ts-expect-error New rewarded observations cannot be recast as an interstitial format.
  track("ad_native_request_started", { ...ad, ad_format: "interstitial", ad_request_basis: "sdk_load_invoked" });
  // @ts-expect-error Observation failure never exports arbitrary native error text.
  track("ad_observation_failed", { ...ad, observation_stage: "paid_payload", why: "private-error" });
};
