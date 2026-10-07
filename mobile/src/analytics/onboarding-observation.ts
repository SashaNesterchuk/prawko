import AsyncStorage from "@react-native-async-storage/async-storage";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "./catalog";
import { createAnalyticsId } from "./runtime-context";
import type { AnalyticsTrack } from "../hooks/useAnalytics";

const PREFIX = "prawko.analytics.onboarding.v1:";
type Entry = { start_reason: string; reset_operation_id: string | null };
type Record = {
  version: 1;
  attemptId: string;
  startedAt: string;
  startReason: string;
  resetOperationId: string | null;
  completedAt: string | null;
  homeObservedAt: string | null;
};
export type OnboardingObservation = Record & {
  storageStatus: "persistent" | "memory_only";
  detectionMethod: "new_observation" | "restored" | "storage_recovery";
};
type Storage = Pick<typeof AsyncStorage, "getItem" | "setItem">;
type Scope = {
  record: Record | null;
  loaded: boolean;
  chain: Promise<unknown>;
  storageStatus: OnboardingObservation["storageStatus"];
  detectionMethod: OnboardingObservation["detectionMethod"];
};

export function isOnboardingAnalyticsStorageKey(key: string) {
  return key.startsWith(PREFIX);
}

export function onboardingObservationProperties(current: OnboardingObservation) {
  return {
    onboarding_attempt_id: current.attemptId,
    onboarding_observation_version: 1 as const,
    onboarding_started_at: current.startedAt,
    onboarding_completed_at: current.completedAt,
    onboarding_home_observed_at: current.homeObservedAt,
    onboarding_storage_status: current.storageStatus,
    onboarding_detection_method: current.detectionMethod,
    onboarding_clock_order_valid: (current.completedAt === null ||
      Date.parse(current.startedAt) <= Date.parse(current.completedAt)) &&
      (current.homeObservedAt === null || (
        current.completedAt !== null && Date.parse(current.completedAt) <= Date.parse(current.homeObservedAt)
      )),
    start_reason: current.startReason,
    reset_operation_id: current.resetOperationId,
    flow_version: "category_schedule_v1" as const,
    flow_context: "onboarding" as const,
  };
}

export function createOnboardingObservationTracker(
  storage: Storage = AsyncStorage,
  now: () => number = Date.now,
  createId: () => string = () => createAnalyticsId("onboarding"),
) {
  const scopes = new Map<string, Scope>();
  function scopeFor(identity: string) {
    let scope = scopes.get(identity);
    if (!scope) {
      scope = {
        record: null, loaded: false, chain: Promise.resolve(), storageStatus: "memory_only",
        detectionMethod: "new_observation",
      };
      scopes.set(identity, scope);
    }
    return scope;
  }
  function snapshot(scope: Scope): OnboardingObservation | null {
    return scope.record ? {
      ...scope.record, storageStatus: scope.storageStatus, detectionMethod: scope.detectionMethod,
    } : null;
  }
  function fresh(entry: Entry, observedAt = new Date(now()).toISOString()): Record {
    return {
      version: 1, attemptId: createId(), startedAt: observedAt,
      startReason: entry.start_reason, resetOperationId: entry.reset_operation_id,
      completedAt: null, homeObservedAt: null,
    };
  }
  async function persist(identity: string, scope: Scope) {
    try {
      await storage.setItem(`${PREFIX}${identity}`, JSON.stringify(scope.record));
      scope.storageStatus = "persistent";
    } catch {
      scope.storageStatus = "memory_only";
    }
  }
  function enqueue<T>(identity: string, operation: (scope: Scope) => Promise<T>): Promise<T> {
    const scope = scopeFor(identity);
    const result = scope.chain.then(async () => {
      if (!scope.loaded) {
        scope.loaded = true;
        try {
          const raw = await storage.getItem(`${PREFIX}${identity}`);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (validRecord(parsed)) {
              scope.record = {
                version: 1, attemptId: parsed.attemptId, startedAt: parsed.startedAt,
                startReason: parsed.startReason, resetOperationId: parsed.resetOperationId,
                completedAt: parsed.completedAt, homeObservedAt: parsed.homeObservedAt,
              };
              scope.storageStatus = "persistent";
              scope.detectionMethod = "restored";
            } else {
              scope.detectionMethod = "storage_recovery";
            }
          }
        } catch {
          scope.detectionMethod = "storage_recovery";
        }
      }
      return operation(scope);
    });
    scope.chain = result.catch(() => undefined);
    return result;
  }
  return {
    peek(identity: string) {
      return snapshot(scopeFor(identity));
    },
    resolve(identity: string, entry?: Entry) {
      const observedAt = new Date(now()).toISOString();
      return enqueue(identity, async (scope) => {
        if (entry) {
          const resetChanged = entry.reset_operation_id !== null &&
            entry.reset_operation_id !== scope.record?.resetOperationId;
          if (!scope.record || scope.record.completedAt !== null || resetChanged) {
            if (scope.record) scope.detectionMethod = "new_observation";
            scope.record = fresh({
              ...entry,
              start_reason: scope.record && !resetChanged
                ? "repeat_incomplete_onboarding_observed" : entry.start_reason,
            }, observedAt);
            await persist(identity, scope);
          }
        }
        return snapshot(scope);
      });
    },
    complete(identity: string, acceptedAt = new Date(now()).toISOString()) {
      return enqueue(identity, async (scope) => {
        if (!scope.record) {
          scope.record = fresh({
            start_reason: "completion_without_entry_observed", reset_operation_id: null,
          }, acceptedAt);
        }
        const changed = scope.record.completedAt === null;
        if (changed) {
          scope.record = { ...scope.record, completedAt: acceptedAt };
          await persist(identity, scope);
        }
        return { changed, observation: snapshot(scope)! };
      });
    },
    home(identity: string, observedAt = new Date(now()).toISOString()) {
      return enqueue(identity, async (scope) => {
        if (!scope.record?.completedAt || scope.record.homeObservedAt) return null;
        scope.record = { ...scope.record, homeObservedAt: observedAt };
        await persist(identity, scope);
        return snapshot(scope);
      });
    },
  };
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validRecord(value: unknown): value is Record {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Record>;
  return record.version === 1 && typeof record.attemptId === "string" &&
    /^onboarding_[a-zA-Z0-9_-]{1,100}$/.test(record.attemptId) && timestamp(record.startedAt) &&
    typeof record.startReason === "string" && record.startReason.length <= 80 &&
    (record.resetOperationId === null || (
      typeof record.resetOperationId === "string" && record.resetOperationId.length <= 150
    )) &&
    (record.completedAt === null || timestamp(record.completedAt)) &&
    (record.homeObservedAt === null || timestamp(record.homeObservedAt)) &&
    (record.homeObservedAt === null || record.completedAt !== null);
}

export const onboardingObservation = createOnboardingObservationTracker();
let activeIdentity: string | null = null;

export function bindOnboardingObservationIdentity(identity: string) {
  activeIdentity = identity;
}

export function markOnboardingObservationReset(resetId: string) {
  if (activeIdentity) {
    void onboardingObservation.resolve(activeIdentity, {
      start_reason: "progress_reset", reset_operation_id: resetId,
    }).catch(() => undefined);
  }
}

export function observeAcceptedOnboardingCompletion(
  track: AnalyticsTrack | undefined,
  fallbackAttemptId: string | null,
) {
  const acceptedAt = new Date().toISOString();
  const capture = (properties: AnalyticsProperties & {
    onboarding_attempt_id: string | null; onboarding_completed_at: string | null;
  }) => {
    try {
      track?.(ANALYTICS_EVENTS.onboardingFlowCompleted.key, {
        ...properties, completion_source: "finalize_local",
        completion_scope: "local_store_operations_returned",
        home_arrival_observed: false, flow_version: "category_schedule_v1", flow_context: "onboarding",
      });
    } catch { /* An accepted product operation cannot fail because of telemetry. */ }
  };
  if (!activeIdentity) {
    capture({
      onboarding_attempt_id: fallbackAttemptId, onboarding_completed_at: acceptedAt,
      onboarding_storage_status: "memory_only", onboarding_detection_method: "identity_not_bound",
    });
    return;
  }
  void onboardingObservation.complete(activeIdentity, acceptedAt).then(({ changed, observation }) => {
    if (changed) capture(onboardingObservationProperties(observation));
  }).catch(() => capture({
    onboarding_attempt_id: fallbackAttemptId, onboarding_completed_at: acceptedAt,
    onboarding_storage_status: "memory_only", onboarding_detection_method: "observer_error",
  }));
}
