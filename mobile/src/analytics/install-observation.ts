import AsyncStorage from "@react-native-async-storage/async-storage";

import { createAnalyticsId } from "./runtime-context";
import { isOnboardingAnalyticsStorageKey } from "./onboarding-observation";

const INSTALL_PREFIX = "prawko.analytics.install-observation.v1:";
const resolved = new Map<string, InstallObservation>();
const pending = new Map<string, Promise<InstallObservation>>();

export type InstallObservation = {
  version: 1;
  observationId: string;
  firstObservedAt: string;
  nativeInstalledAt: string | null;
  detectionMethod: "first_local_observation" | "storage_recovery" | "memory_only";
};

export function isDurableAnalyticsStorageKey(key: string) {
  return key.startsWith(INSTALL_PREFIX) ||
    isOnboardingAnalyticsStorageKey(key) ||
    key === "prawko.analytics.collection.v1" ||
    key === "prawko.analytics.notification-responses.v1";
}

export function getInstallObservationProperties(appUserId: string) {
  const current = resolved.get(appUserId);
  return {
    installation_observation_id: current?.observationId ?? null,
    first_observed_at: current?.firstObservedAt ?? null,
    native_installed_at: current?.nativeInstalledAt ?? null,
    observation_detection_method: current?.detectionMethod ?? "not_resolved" as const,
    observation_contract_version: 1 as const,
    identity_scope: "install" as const,
  };
}

export function resolveInstallObservation(
  appUserId: string,
  getNativeInstallTime: () => Promise<Date | null>,
  now = Date.now,
): Promise<InstallObservation> {
  const cached = resolved.get(appUserId);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(appUserId);
  if (existing) return existing;
  const promise = (async () => {
    let invalidStoredRecord = false;
    try {
      const raw = await AsyncStorage.getItem(`${INSTALL_PREFIX}${appUserId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && typeof parsed.observationId === "string" &&
          typeof parsed.firstObservedAt === "string" && Number.isFinite(Date.parse(parsed.firstObservedAt)) &&
          (parsed.nativeInstalledAt === null || (typeof parsed.nativeInstalledAt === "string" &&
            Number.isFinite(Date.parse(parsed.nativeInstalledAt)))) &&
          ["first_local_observation", "storage_recovery", "memory_only"].includes(parsed.detectionMethod)) {
          resolved.set(appUserId, parsed);
          return parsed as InstallObservation;
        }
        invalidStoredRecord = true;
      }
    } catch { invalidStoredRecord = true; }
    const firstObservedAt = new Date(now()).toISOString();
    let nativeInstalledAt: string | null = null;
    try {
      const native = await getNativeInstallTime();
      if (native && Number.isFinite(native.getTime()) && native.getTime() <= Date.parse(firstObservedAt)) {
        nativeInstalledAt = native.toISOString();
      }
    } catch { /* Native install time is optional, not the observation anchor. */ }
    const result: InstallObservation = {
      version: 1, observationId: createAnalyticsId("installation"),
      firstObservedAt, nativeInstalledAt,
      detectionMethod: invalidStoredRecord ? "storage_recovery" : "first_local_observation",
    };
    try {
      await AsyncStorage.setItem(`${INSTALL_PREFIX}${appUserId}`, JSON.stringify(result));
    } catch { result.detectionMethod = "memory_only"; }
    resolved.set(appUserId, result);
    return result;
  })();
  pending.set(appUserId, promise);
  void promise.finally(() => pending.delete(appUserId)).catch(() => undefined);
  return promise;
}
