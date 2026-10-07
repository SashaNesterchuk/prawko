export const ENTRY_END_REASONS = [
  "superseded", "superseded_by_unobserved_signal", "superseded_by_unattributed_signal",
  "visit_changed", "visit_background", "observer_unmount", "foreground_not_observed",
  "observation_clock_invalid", "association_horizon_elapsed",
] as const;
export type EntryEndReason = typeof ENTRY_END_REASONS[number];
export type EntryDestinationEndReason = EntryEndReason | "destination_horizon_elapsed" | "observation_limit";

export type ExternalEntryScope = {
  entry_observation_version: 1; entry_observation_id: string; entry_kind: "deep_link" | "notification";
  entry_signal_origin: "initial_url" | "live_url" | "live_os_response" | "cached_os_response";
  entry_signal_received_at: string; entry_observed_at: string;
  entry_observation_time_basis: "client_signal_processing_not_tap";
  entry_scope_status: "bound_visit" | "awaiting_foreground" | "cached_unattributed" | "processing_visit_changed"
    | "signal_horizon_elapsed" | "observation_clock_invalid";
  entry_bound_app_visit_id: string | null;
  entry_target_route_pattern: string | null; entry_target_screen_name: string | null;
  entry_target_entity_revision: string | null; entry_target_entity_required: boolean;
  entry_target_basis: "normalized_static_route" | "normalized_entity_id" | "entity_unverified"
    | "conflicting_entity_ids" | "root_redirect" | "unknown_route" | "malformed_url" | "notification_target_unspecified";
  entry_destination_horizon_seconds: 60; entry_association_horizon_seconds: 3600;
  notification_response_revision: string | null;
};

export type ExternalEntryEventPayloads = {
  external_entry_destination_observed: ExternalEntryScope & {
    entry_destination_route_pattern: string; entry_destination_screen_name: string;
    entry_destination_entity_revision: string | null;
    entry_destination_phase: "route" | "loading" | "usable" | "blocked" | "error" | "other";
    entry_destination_match: "target_unspecified" | "redirect_landing" | "target_unknown" | "different_route"
      | "static_route" | "entity_unverified" | "route_and_entity" | "different_entity";
    entry_destination_basis: "preexisting_route_snapshot" | "foreground_route_transition" | "foreground_view_state";
    entry_elapsed_ms: number | null;
  };
  external_entry_destination_ended: ExternalEntryScope & {
    entry_destination_end_reason: EntryDestinationEndReason; entry_elapsed_ms: number | null;
    entry_destination_target_observed: boolean | null; entry_destination_usable_observed: boolean;
  };
  external_entry_ended: ExternalEntryScope & { entry_end_reason: EntryEndReason; entry_elapsed_ms: number | null };
};

export type RewardedObservationScope = {
  ad_observation_version: 1; ad_format: "rewarded";
  // Scope factory failures stay capturable and fail runtime QA, not the reward.
  ad_request_id: string | null; ad_impression_id: string | null;
  ad_unit_basis: "test_unit" | "configured_unit" | "not_resolved";
  ad_native_load_observed: boolean; ad_opened_observed: boolean; placement: "exam_unlock";
};
export type RewardedObservationPayloads = {
  ad_native_request_started: RewardedObservationScope & { ad_request_basis: "sdk_load_invoked" };
  ad_impression_observed: RewardedObservationScope & {
    ad_impression_basis: "sdk_paid_callback"; ad_native_terminal_observed: boolean;
  };
  ad_observation_failed: RewardedObservationScope & {
    observation_stage: "paid_listener_registration" | "paid_payload";
    why: "unparseable_revenue" | "observation_failed";
  };
};
