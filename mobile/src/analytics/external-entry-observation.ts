import { ANALYTICS_EVENTS, type AnalyticsEventPayloads, type AnalyticsProperties } from "./catalog";
import type { AnalyticsTrack } from "../hooks/useAnalytics";
import type {
  EntryDestinationEndReason, EntryEndReason, ExternalEntryEventPayloads, ExternalEntryScope,
} from "./observation-payloads";
import { contentFingerprint } from "./content-revisions";
import { createAnalyticsId } from "./runtime-context";
import { resolveScreenRoute } from "./screenRoutes";

export const ENTRY_DESTINATION_HORIZON_MS = 60_000;
export const ENTRY_ASSOCIATION_HORIZON_MS = 3_600_000;

type Emit = AnalyticsTrack;
type Signal = { wall: string; mono: number; visit: string | null; active: boolean };
type Entry = {
  properties: AnalyticsProperties;
  receivedMono: number;
  visit: string | null;
  seen: Set<string>;
  destinationEnded: boolean;
  targetObserved: boolean | null;
  usableObserved: boolean;
};
type DestinationBasis = "preexisting_route_snapshot" | "foreground_route_transition" | "foreground_view_state";

function safeId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value)
    && !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

const ENTITY_KEYS = ["sessionId", "session", "signId", "categoryId", "topicId"];
const USABLE_STATES = new Set(["question", "question_with_error", "feedback", "result", "review", "ready", "search_results", "search_no_results"]);
const BLOCKED_STATES = new Set(["offline_blocked", "offline_gate", "category_mismatch", "blocked"]);
const ERROR_STATES = new Set(["error", "question_error", "missing_question", "missing_review_question", "missing_result", "empty"]);

function destinationPhase(value: unknown) {
  if (typeof value !== "string") return "route";
  if (USABLE_STATES.has(value)) return "usable";
  if (BLOCKED_STATES.has(value)) return "blocked";
  if (ERROR_STATES.has(value)) return "error";
  if (value === "loading" || value === "checking") return "loading";
  return value === "route_entered" ? "route" : "other";
}

export function externalEntryRouteKey(route: string) {
  return route.replace(/^\/\((?:tabs|onboarding)\)(?=\/|$)/, "").replace(/^\/index$/, "/") || "/";
}

/** Only normalized routes and bounded ID fingerprints leave this parser. */
export function externalLinkTarget(url: unknown): AnalyticsProperties {
  const unknown = {
    entry_target_route_pattern: null, entry_target_screen_name: null,
    entry_target_entity_revision: null, entry_target_entity_required: false,
  };
  try {
    if (typeof url !== "string" || url.length > 8192) return { ...unknown, entry_target_basis: "malformed_url" };
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") pathname = `/${parsed.hostname}${pathname}`;
    const route = resolveScreenRoute(pathname);
    if (route.routePattern === "/unknown") return { ...unknown, entry_target_basis: "unknown_route" };
    const patternParts = route.routePattern.split("/").filter(Boolean);
    const index = patternParts.findIndex((part) => part.startsWith("["));
    const pathKey = index < 0 ? null : patternParts[index].slice(1, -1);
    const pathValue = index < 0 ? null : pathname.split("/").filter(Boolean)[index];
    // Match ScreenTracker's first scalar param; unrelated lower-priority params are not conflicts.
    const entityKey = ENTITY_KEYS.find((key) => key === pathKey || parsed.searchParams.getAll(key).length === 1);
    const entityValues = entityKey ? parsed.searchParams.getAll(entityKey) : [];
    if (entityKey === pathKey && pathValue) entityValues.unshift(decodeURIComponent(pathValue));
    const requiresEntity = entityValues.length > 0 || route.routePattern.includes("[");
    const ids = entityValues.map(safeId);
    const distinct = new Set(ids.filter((id): id is string => id !== null));
    const basis = route.screenName === "app_entry" ? "root_redirect"
      : !requiresEntity ? "normalized_static_route"
      : ids.some((id) => id === null) || !distinct.size ? "entity_unverified"
      : distinct.size > 1 ? "conflicting_entity_ids" : "normalized_entity_id";
    return {
      entry_target_route_pattern: route.routePattern, entry_target_screen_name: route.screenName,
      entry_target_entity_revision: basis === "normalized_entity_id" ? contentFingerprint([...distinct][0]) : null,
      entry_target_entity_required: requiresEntity, entry_target_basis: basis,
    };
  } catch {
    return { ...unknown, entry_target_basis: "malformed_url" };
  }
}

export function createExternalEntryObserver(input: {
  now?: () => number; wallNow?: () => number; createId?: (prefix: string) => string;
} = {}) {
  const now = input.now ?? (() => typeof performance !== "undefined" ? performance.now() : Date.now());
  const wallNow = input.wallNow ?? Date.now;
  const createId = input.createId ?? createAnalyticsId;
  let emitter: Emit = () => undefined;
  let current: Entry | null = null;

  function emit<EventName extends keyof ExternalEntryEventPayloads>(
    event: EventName, entry: Entry, extra: Omit<ExternalEntryEventPayloads[EventName], keyof ExternalEntryScope>,
  ) {
    try {
      // Outcome fields are checked here; retained scope is assembled by this observer.
      emitter(event, { ...properties(entry), ...extra } as AnalyticsEventPayloads[EventName]);
    } catch { /* Optional analytics, never routing. */ }
  }
  function elapsed(entry: Entry) {
    const value = now() - entry.receivedMono;
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  function properties(entry: Entry) {
    return {
      ...entry.properties, entry_bound_app_visit_id: entry.visit,
      entry_scope_status: entry.visit ? "bound_visit" : entry.properties.entry_scope_status,
    };
  }
  function endDestination(entry: Entry, reason: EntryDestinationEndReason) {
    if (entry.destinationEnded) return;
    entry.destinationEnded = true;
    emit(ANALYTICS_EVENTS.externalEntryDestinationEnded.key, entry, {
      entry_destination_end_reason: reason,
      entry_elapsed_ms: elapsed(entry), entry_destination_target_observed: entry.targetObserved,
      entry_destination_usable_observed: entry.usableObserved,
    });
  }
  function end(reason: EntryEndReason) {
    const entry = current;
    if (!entry) return;
    current = null;
    endDestination(entry, reason);
    emit(ANALYTICS_EVENTS.externalEntryEnded.key, entry, {
      entry_end_reason: reason, entry_elapsed_ms: elapsed(entry),
    });
  }
  function recordSignal(context: AnalyticsProperties): Signal | null {
    try {
      const mono = now();
      if (!Number.isFinite(mono)) return null;
      return {
        wall: new Date(wallNow()).toISOString(), mono, visit: safeId(context.app_visit_id),
        active: context.app_visibility === "active",
      };
    } catch { return null; }
  }
  function receive(
    kind: "deep_link" | "notification", origin: string, target: AnalyticsProperties,
    context: AnalyticsProperties, signal?: Signal | null, responseRevision?: string,
  ): AnalyticsProperties {
    const cached = origin === "cached_os_response";
    try {
      const observed = recordSignal(context);
      const received = signal === undefined ? observed : signal;
      if (!observed || !received) {
        if (!cached) end("superseded_by_unobserved_signal");
        return {};
      }
      const age = observed.mono - received.mono;
      const clockInvalid = !Number.isFinite(age) || age < 0 || received.wall > observed.wall;
      const visitChanged = received.active && (!received.visit || !observed.visit || received.visit !== observed.visit);
      const delayedForeground = age >= ENTRY_ASSOCIATION_HORIZON_MS
        || !received.active && age >= ENTRY_DESTINATION_HORIZON_MS;
      const attributable = !cached && !visitChanged && !clockInvalid && !delayedForeground;
      if (attributable && kind === "notification" && current?.properties.entry_kind === kind
        && current.properties.notification_response_revision === responseRevision && current.visit === observed.visit) {
        const currentAge = elapsed(current);
        if (currentAge !== null && currentAge < ENTRY_ASSOCIATION_HORIZON_MS) return properties(current);
      }
      const id = safeId(createId("entry"));
      if (!id) {
        if (!cached) end("superseded_by_unobserved_signal");
        return {};
      }
      const visit = attributable && observed.active ? observed.visit : null;
      const scope = cached ? "cached_unattributed" : clockInvalid ? "observation_clock_invalid"
        : delayedForeground ? "signal_horizon_elapsed" : visitChanged ? "processing_visit_changed"
        : visit ? "bound_visit" : "awaiting_foreground";
      const props: AnalyticsProperties = {
        entry_observation_version: 1, entry_observation_id: id, entry_kind: kind,
        entry_signal_origin: origin, entry_signal_received_at: received.wall,
        entry_observed_at: observed.wall, entry_observation_time_basis: "client_signal_processing_not_tap",
        entry_scope_status: scope, entry_bound_app_visit_id: visit,
        entry_destination_horizon_seconds: ENTRY_DESTINATION_HORIZON_MS / 1000,
        entry_association_horizon_seconds: ENTRY_ASSOCIATION_HORIZON_MS / 1000,
        notification_response_revision: responseRevision ?? null, ...target,
      };
      if (!cached) {
        end(attributable ? "superseded" : "superseded_by_unattributed_signal");
        if (attributable) current = {
          properties: props, receivedMono: received.mono, visit, seen: new Set(),
          destinationEnded: false, targetObserved: target.entry_target_route_pattern ? false : null,
          usableObserved: false,
        };
      }
      return props;
    } catch {
      if (!cached) current = null;
      return {};
    }
  }
  function tick() {
    try {
      if (!current) return;
      const age = elapsed(current);
      if (age === null) { end("observation_clock_invalid"); return; }
      if (!current.visit && age >= ENTRY_DESTINATION_HORIZON_MS) { end("foreground_not_observed"); return; }
      if (age >= ENTRY_DESTINATION_HORIZON_MS) endDestination(current, "destination_horizon_elapsed");
      if (age >= ENTRY_ASSOCIATION_HORIZON_MS) end("association_horizon_elapsed");
    } catch { /* Observation timers never drive navigation. */ }
  }
  return {
    setEmitter(next: Emit) { emitter = next; },
    recordSignal,
    receiveLink(url: unknown, origin: "initial_url" | "live_url", context: AnalyticsProperties) {
      return receive("deep_link", origin, externalLinkTarget(url), context);
    },
    receiveNotification(responseKey: string, cached: boolean, context: AnalyticsProperties, signal?: Signal | null) {
      try {
        return receive("notification", cached ? "cached_os_response" : "live_os_response", {
          entry_target_route_pattern: null, entry_target_screen_name: null,
          entry_target_entity_revision: null, entry_target_entity_required: false,
          entry_target_basis: "notification_target_unspecified",
        }, context, signal, contentFingerprint(responseKey));
      } catch {
        if (!cached) {
          try { end("superseded_by_unobserved_signal"); } catch { current = null; }
        }
        return {};
      }
    },
    bindVisit(visit: string) {
      try {
        tick();
        if (!current || !safeId(visit)) return;
        if (current.visit && current.visit !== visit) { end("visit_changed"); return; }
        current.visit = visit;
      } catch { /* Optional binding. */ }
    },
    getAssociation(visit: string | null, visibility: string): AnalyticsProperties {
      try {
        if (!current || visibility !== "active" || !visit || current.visit !== visit) return {};
        const age = elapsed(current);
        return age !== null && age < ENTRY_ASSOCIATION_HORIZON_MS ? properties(current) : {};
      } catch { return {}; }
    },
    observeDestination(context: AnalyticsProperties, basis: DestinationBasis) {
      try {
        tick();
        const entry = current;
        if (!entry || entry.destinationEnded || !entry.visit || context.app_visibility !== "active"
          || context.app_visit_id !== entry.visit || typeof context.route_pattern !== "string") return;
        const route = resolveScreenRoute(context.route_pattern);
        if (route.routePattern === "/unknown" && context.route_pattern !== "/unknown") return;
        if (route.screenName === "app_entry") return;
        const entity = safeId(context.route_entity_id);
        const entityRevision = entity ? contentFingerprint(entity) : null;
        const target = entry.properties;
        const match = target.entry_target_basis === "notification_target_unspecified" ? "target_unspecified"
          : target.entry_target_basis === "root_redirect" ? "redirect_landing"
          : !target.entry_target_route_pattern ? "target_unknown"
          : externalEntryRouteKey(String(target.entry_target_route_pattern)) !== externalEntryRouteKey(route.routePattern)
            ? "different_route"
          : !target.entry_target_entity_required ? "static_route"
          : !target.entry_target_entity_revision || !entityRevision ? "entity_unverified"
          : target.entry_target_entity_revision === entityRevision ? "route_and_entity" : "different_entity";
        const phase = destinationPhase(context.view_state);
        const key = `${route.routePattern}:${entityRevision}:${phase}:${match}`;
        if (entry.seen.has(key)) return;
        if (entry.seen.size >= 32) { endDestination(entry, "observation_limit"); return; }
        entry.seen.add(key);
        const matched = match === "static_route" || match === "route_and_entity" || match === "redirect_landing";
        if (matched) entry.targetObserved = true;
        if ((matched || match === "target_unspecified") && phase === "usable") entry.usableObserved = true;
        emit(ANALYTICS_EVENTS.externalEntryDestinationObserved.key, entry, {
          entry_destination_route_pattern: route.routePattern,
          entry_destination_screen_name: route.screenName, entry_destination_entity_revision: entityRevision,
          entry_destination_phase: phase, entry_destination_match: match,
          entry_destination_basis: basis, entry_elapsed_ms: elapsed(entry),
        });
      } catch { /* Never affect screen state. */ }
    },
    visitEnded(visit: string) {
      try { if (current?.visit === visit || current && !current.visit) end("visit_background"); } catch { /* Optional. */ }
    },
    tick,
    end(reason: EntryEndReason) {
      try { end(reason); } catch { current = null; }
    },
  };
}

export type ExternalEntryObserver = ReturnType<typeof createExternalEntryObserver>;
export const externalEntryObservation = createExternalEntryObserver();
