import type { DrivingCategory } from "@prawko/config";

import { mobileEnv } from "../../config/env";
import { useEntitlementStore } from "../../state/entitlements";

export type E2EOfflinePackStatus =
  | "downloading"
  | "incomplete"
  | "missing"
  | "ready";

export type E2EQuestionScenario = "topic-progress";

type E2ETestOverrides = {
  offlinePackCategory: DrivingCategory | null;
  offlinePackStatus: E2EOfflinePackStatus | null;
  questionScenario: E2EQuestionScenario | null;
  reachability: boolean | null;
};

let overrides: E2ETestOverrides = {
  offlinePackCategory: null,
  offlinePackStatus: null,
  questionScenario: null,
  reachability: null,
};

export function resetE2ETestOverrides() {
  if (!mobileEnv.enableE2ETestMode) {
    return;
  }

  overrides = {
    offlinePackCategory: null,
    offlinePackStatus: null,
    questionScenario: null,
    reachability: null,
  };
  useEntitlementStore.getState().setDebugPlusOverride(null);
}

export function configureE2ETestOverrides(input: {
  offlinePackCategory?: string | null;
  offlinePackStatus?: E2EOfflinePackStatus | null;
  plusAccess?: boolean | null;
  questionScenario?: E2EQuestionScenario | null;
  reachability?: boolean | null;
}) {
  if (!mobileEnv.enableE2ETestMode) {
    return;
  }

  overrides = {
    offlinePackCategory: resolveLooseCategory(input.offlinePackCategory),
    offlinePackStatus: input.offlinePackStatus ?? null,
    questionScenario: input.questionScenario ?? null,
    reachability:
      typeof input.reachability === "boolean" ? input.reachability : null,
  };
  useEntitlementStore.getState().setDebugPlusOverride(
    typeof input.plusAccess === "boolean" ? input.plusAccess : null
  );
}

export function getE2ETestReachabilityOverride() {
  if (!mobileEnv.enableE2ETestMode) {
    return null;
  }

  return overrides.reachability;
}

export function getE2EQuestionScenario() {
  if (!mobileEnv.enableE2ETestMode) {
    return null;
  }

  return overrides.questionScenario;
}

export function getE2EOfflinePackOverride() {
  if (!mobileEnv.enableE2ETestMode || !overrides.offlinePackStatus) {
    return null;
  }

  return {
    category: overrides.offlinePackCategory,
    status: overrides.offlinePackStatus,
  };
}

export function setE2EOfflinePackOverride(input: {
  category?: string | null;
  status: E2EOfflinePackStatus;
}) {
  if (!mobileEnv.enableE2ETestMode) {
    return;
  }

  overrides = {
    ...overrides,
    offlinePackCategory:
      input.category === undefined
        ? overrides.offlinePackCategory
        : resolveLooseCategory(input.category),
    offlinePackStatus: input.status,
  };
}

function resolveLooseCategory(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? (normalized as DrivingCategory) : null;
}
