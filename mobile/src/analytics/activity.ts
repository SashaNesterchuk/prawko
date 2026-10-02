import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsProperties } from "./catalog";
import { createAnalyticsId } from "./runtime-context";

type AppVisibility = "active" | "inactive" | "background" | "unknown" | "extension";
type Emit = (event: AnalyticsEventName, properties: AnalyticsProperties) => void;
type TimedVisit = {
  id: string;
  startedAt: number;
  foregroundMs: number;
  inactiveMs: number;
  engagedMs: number;
};
type ScreenVisit = TimedVisit & { properties: AnalyticsProperties };

export const ENGAGEMENT_IDLE_MS = 60_000;
export const ACTIVITY_CHECKPOINT_MS = 60_000;

export function analyticsMonotonicNow() {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
  } catch { /* Some runtimes expose an unsupported performance clock. */ }
  return Date.now();
}

/** Observation only. These clocks never drive timers, stores, or navigation. */
export function createActivityTracker(input: {
  now?: () => number;
  wallNow?: () => number;
  createId?: (prefix: string) => string;
} = {}) {
  const now = input.now ?? analyticsMonotonicNow;
  const wallNow = input.wallNow ?? Date.now;
  const createId = input.createId ?? createAnalyticsId;
  let emitter: Emit = () => undefined;
  const emit: Emit = (event, properties) => {
    try { emitter(event, properties); } catch { /* Telemetry is best effort. */ }
  };
  let visibility: AppVisibility = "unknown";
  let observedAt = now();
  let totalForegroundMs = 0;
  let lastInteractionAt: number | null = null;
  let visit: TimedVisit | null = null;
  let screen: ScreenVisit | null = null;
  let routeScreen: AnalyticsProperties | null = null;
  let desiredScreen: AnalyticsProperties | null = null;
  let stateSignature: string | null = null;
  let checkpointIndex = 0;
  let hasOpened = false;
  let entry: AnalyticsProperties = { entry_reason: "unknown" };

  function settle() {
    const current = now();
    const delta = Math.max(0, current - observedAt);
    if (visibility === "active") {
      totalForegroundMs += delta;
      const engaged = lastInteractionAt === null ? 0
        : Math.max(0, Math.min(current, lastInteractionAt + ENGAGEMENT_IDLE_MS) - observedAt);
      for (const target of [visit, screen]) {
        if (!target) continue;
        target.foregroundMs += delta;
        target.engagedMs += engaged;
      }
    } else if (visibility === "inactive") {
      for (const target of [visit, screen]) {
        if (target) target.inactiveMs += delta;
      }
    }
    observedAt = current;
  }

  function counters(target: TimedVisit): AnalyticsProperties {
    return {
      foreground_ms: Math.round(target.foregroundMs),
      inactive_ms: Math.round(target.inactiveMs),
      interaction_engaged_ms: Math.round(target.engagedMs),
      wall_duration_ms: Math.max(0, wallNow() - target.startedAt),
      engagement_policy: "interaction_idle_60s_v1",
      duration_scope: "observed_foreground",
    };
  }

  function context(): AnalyticsProperties {
    return {
      ...desiredScreen,
      app_visit_id: visit?.id ?? null,
      screen_visit_id: screen?.id ?? null,
      app_visibility: visibility,
      ...entry,
    };
  }

  function beginScreen(reason: string) {
    if (!visit || !desiredScreen || screen) return;
    screen = {
      id: createId("screen"),
      startedAt: wallNow(),
      foregroundMs: 0,
      inactiveMs: 0,
      engagedMs: 0,
      properties: { ...desiredScreen },
    };
    emit(ANALYTICS_EVENTS.screenVisitStarted.key, {
      ...context(),
      start_reason: reason,
    });
    if (desiredScreen.view_state !== "route_entered") {
      emit(ANALYTICS_EVENTS.screenStateViewed.key, context());
    }
  }

  function endScreen(reason: string) {
    if (!screen) return;
    const previous = screen;
    emit(ANALYTICS_EVENTS.screenVisitEnded.key, {
      ...context(),
      ...previous.properties,
      screen_visit_id: previous.id,
      ...counters(previous),
      end_reason: reason,
    });
    screen = null;
  }

  return {
    setEmitter(next: Emit) { emitter = next; },
    capture(event: AnalyticsEventName, properties: AnalyticsProperties) {
      try { emit(event, properties); } catch { /* Telemetry is best effort. */ }
    },
    getContext: context,
    getForegroundMs() { settle(); return totalForegroundMs; },
    getVisibility: () => visibility,
    observeVisibility(next: AppVisibility) {
      settle();
      const previous = visibility;
      visibility = next;
      if (next === "active" && !visit) {
        visit = {
          id: createId("visit"), startedAt: wallNow(),
          foregroundMs: 0, inactiveMs: 0, engagedMs: 0,
        };
        checkpointIndex = 0;
        lastInteractionAt = null;
        emit(ANALYTICS_EVENTS.appVisitStarted.key, {
          ...context(),
          start_reason: hasOpened ? "foreground_resume" : "runtime_start",
          previous_visibility: previous,
        });
        hasOpened = true;
        beginScreen("foreground");
      } else if (next === "background" && visit) {
        const lastScreenVisitId = screen?.id ?? null;
        endScreen("background");
        emit(ANALYTICS_EVENTS.appVisitEnded.key, {
          ...context(), ...counters(visit), end_reason: "background",
          last_screen_visit_id: lastScreenVisitId,
          checkpoint_index: ++checkpointIndex,
        });
        visit = null;
        lastInteractionAt = null;
      }
    },
    checkpoint(reason = "interval") {
      settle();
      if (!visit || visibility !== "active") return;
      emit(ANALYTICS_EVENTS.appVisitCheckpoint.key, {
        ...context(), ...counters(visit),
        checkpoint_index: ++checkpointIndex, checkpoint_reason: reason,
      });
      if (screen) {
        emit(ANALYTICS_EVENTS.screenVisitCheckpoint.key, {
          ...context(), ...counters(screen),
          checkpoint_index: checkpointIndex, checkpoint_reason: reason,
        });
      }
    },
    setScreen(properties: AnalyticsProperties) {
      settle();
      const changed = !desiredScreen ||
        desiredScreen.route_pattern !== properties.route_pattern ||
        desiredScreen.route_entity_id !== properties.route_entity_id;
      if (changed) {
        endScreen("navigation");
        routeScreen = { ...properties };
        desiredScreen = { ...properties, view_state: "route_entered" };
        stateSignature = null;
        beginScreen("navigation");
      } else {
        routeScreen = { ...properties };
        desiredScreen = { ...desiredScreen, ...properties };
      }
    },
    setViewState(properties: AnalyticsProperties) {
      if (!desiredScreen) return;
      if (properties.screen_name && properties.screen_name !== desiredScreen.screen_name) return;
      const signature = JSON.stringify(properties);
      if (signature === stateSignature) return;
      settle();
      stateSignature = signature;
      desiredScreen = { ...routeScreen, ...properties };
      if (screen) screen.properties = { ...desiredScreen };
      if (visit && visibility === "active") {
        emit(ANALYTICS_EVENTS.screenStateViewed.key, context());
      }
    },
    recordInteraction() {
      settle();
      if (visibility === "active") lastInteractionAt = now();
    },
    setEntry(properties: AnalyticsProperties) {
      entry = { ...properties };
    },
  };
}

export const analyticsActivity = createActivityTracker();

export function createAnalyticsDurationClock() {
  let startedAt = analyticsMonotonicNow();
  let observedAt = startedAt;
  let visible = false;
  let visibleMs = 0;
  function settle() {
    const now = analyticsMonotonicNow();
    if (visible) visibleMs += Math.max(0, now - observedAt);
    observedAt = now;
  }
  return {
    reset() {
      startedAt = analyticsMonotonicNow();
      observedAt = startedAt;
      visibleMs = 0;
    },
    setVisible(next: boolean) { settle(); visible = next; },
    measure() {
      settle();
      return {
        visible_foreground_ms: Math.round(visibleMs),
        observed_wall_ms: Math.round(Math.max(0, observedAt - startedAt)),
      };
    },
  };
}
