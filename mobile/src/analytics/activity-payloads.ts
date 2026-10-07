export const APP_VISIBILITIES = ["active", "inactive", "background", "unknown", "extension"] as const;
export type AppVisibility = typeof APP_VISIBILITIES[number];

export type AppVisitScope = {
  app_visit_id: string;
  app_visibility: AppVisibility;
};
export type ScreenVisitScope = AppVisitScope & {
  screen_visit_id: string;
  route_pattern: string;
  screen_name: string;
  view_state: string;
};
export type ActivityDurations = {
  foreground_ms: number;
  inactive_ms: number;
  interaction_engaged_ms: number;
  wall_duration_ms: number;
  engagement_policy: "interaction_idle_60s_v1";
  duration_scope: "observed_foreground";
};
type Checkpoint = ActivityDurations & {
  checkpoint_index: number;
  checkpoint_reason: "interval" | "observer_unmount";
};

export type ActivityEventPayloads = {
  app_visit_started: AppVisitScope & {
    start_reason: "runtime_start" | "foreground_resume";
    previous_visibility: AppVisibility;
  };
  app_visit_checkpoint: AppVisitScope & Checkpoint;
  app_visit_ended: AppVisitScope & ActivityDurations & {
    end_reason: "background";
    last_screen_visit_id: string | null;
    checkpoint_index: number;
  };
  screen_visit_started: ScreenVisitScope & { start_reason: "navigation" | "foreground" };
  screen_visit_checkpoint: ScreenVisitScope & Checkpoint;
  screen_visit_ended: ScreenVisitScope & ActivityDurations & { end_reason: "navigation" | "background" };
  screen_state_viewed: ScreenVisitScope;
};

export type LearningReadyContext = { question_id: string | null } & (
  { feature: "training"; training_session_id: string | null }
  | { feature: "exam"; exam_session_id: string | null }
  | { feature: "sign_test" | "sign_practice"; sign_test_session_id: string | null }
);
export type LearningReadyPayload = LearningReadyContext & {
  ready_foreground_ms: number;
  ready_wall_ms: number;
  ready_duration_scope: "current_focus_entry" | "foreground_observation";
  ready_reason: "focused_ready" | "foreground_return";
  media_readiness: "not_measured";
};

export const ACCESS_SOURCES = ["none", "purchase", "school", "other"] as const;
export type AccessSource = typeof ACCESS_SOURCES[number];
export type AccessStatePayload = {
  observation_reason: "initial_snapshot" | "state_change";
  previous_is_plus: boolean | null;
  previous_access_source: AccessSource | null;
  is_plus: boolean;
  access_source: AccessSource;
};
