import { APP_FEATURES, FEATURE_FLAGS, type AppFeature } from "@prawko/config";
import { create } from "zustand";

import { mobileEnv } from "../config/env";
import { getCurrentUserFromState, useAppShellStore } from "./app-shell";

export type FeatureEntitlementMap = Record<AppFeature, boolean>;

export type SchoolAccessState = {
  accessEndsAt: string | null;
  accessStartsAt: string;
  grantedFeatures: AppFeature[];
  schoolCodeId: string | null;
  schoolId: string;
  schoolMembershipId: string;
  schoolName: string | null;
};

export type PurchaseAccessState = {
  activeEntitlementIds: string[];
  latestExpirationDate: string | null;
  managementUrl: string | null;
  originalAppUserId: string;
};

export type RevenueCatPackageSummary = {
  description: string;
  identifier: string;
  offeringIdentifier: string;
  packageType: string;
  price: number;
  pricePerMonthString: string | null;
  pricePerWeekString: string | null;
  pricePerYearString: string | null;
  priceString: string;
  productIdentifier: string;
  subscriptionPeriod: string | null;
  title: string;
};

type EntitlementStatus = "idle" | "loading" | "ready";
type RevenueCatStatus = "idle" | "loading" | "ready";

type EntitlementState = {
  clearEntitlements: (status?: EntitlementStatus) => void;
  clearRevenueCatState: (status?: RevenueCatStatus) => void;
  /** __DEV__ only: force Plus on/off. `null` = use real entitlements. */
  debugPlusOverride: boolean | null;
  entitlementStatus: EntitlementStatus;
  featureEntitlements: FeatureEntitlementMap;
  hydrateRemoteEntitlements: (payload: {
    featureEntitlements: FeatureEntitlementMap;
    schoolAccess: SchoolAccessState | null;
  }) => void;
  hydrateRevenueCatSnapshot: (payload: {
    featureEntitlements: FeatureEntitlementMap;
    isConfigured: boolean;
    offerings: RevenueCatPackageSummary[];
    purchaseAccess: PurchaseAccessState | null;
  }) => void;
  purchaseAccess: PurchaseAccessState | null;
  revenueCatConfigured: boolean;
  revenueCatFeatureEntitlements: FeatureEntitlementMap;
  revenueCatOfferings: RevenueCatPackageSummary[];
  revenueCatStatus: RevenueCatStatus;
  schoolAccess: SchoolAccessState | null;
  setDebugPlusOverride: (value: boolean | null) => void;
  setEntitlementStatus: (status: EntitlementStatus) => void;
  setRevenueCatStatus: (status: RevenueCatStatus) => void;
};

export function createEmptyFeatureEntitlements(): FeatureEntitlementMap {
  return APP_FEATURES.reduce((accumulator, feature) => {
    accumulator[feature] = false;
    return accumulator;
  }, {} as FeatureEntitlementMap);
}

export const useEntitlementStore = create<EntitlementState>()((set) => ({
  clearEntitlements: (status = "idle") =>
    set({
      entitlementStatus: status,
      featureEntitlements: createEmptyFeatureEntitlements(),
      schoolAccess: null,
    }),
  clearRevenueCatState: (status = "idle") =>
    set({
      purchaseAccess: null,
      revenueCatConfigured: false,
      revenueCatFeatureEntitlements: createEmptyFeatureEntitlements(),
      revenueCatOfferings: [],
      revenueCatStatus: status,
    }),
  debugPlusOverride: null,
  entitlementStatus: "idle",
  featureEntitlements: createEmptyFeatureEntitlements(),
  hydrateRemoteEntitlements: ({ featureEntitlements, schoolAccess }) =>
    set({
      entitlementStatus: "ready",
      featureEntitlements: {
        ...createEmptyFeatureEntitlements(),
        ...featureEntitlements,
      },
      schoolAccess,
    }),
  hydrateRevenueCatSnapshot: ({
    featureEntitlements,
    isConfigured,
    offerings,
    purchaseAccess,
  }) =>
    set({
      purchaseAccess,
      revenueCatConfigured: isConfigured,
      revenueCatFeatureEntitlements: {
        ...createEmptyFeatureEntitlements(),
        ...featureEntitlements,
      },
      revenueCatOfferings: offerings,
      revenueCatStatus: "ready",
    }),
  purchaseAccess: null,
  revenueCatConfigured: false,
  revenueCatFeatureEntitlements: createEmptyFeatureEntitlements(),
  revenueCatOfferings: [],
  revenueCatStatus: "idle",
  schoolAccess: null,
  setDebugPlusOverride: (debugPlusOverride) => set({ debugPlusOverride }),
  setEntitlementStatus: (entitlementStatus) => set({ entitlementStatus }),
  setRevenueCatStatus: (revenueCatStatus) => set({ revenueCatStatus }),
}));

export function useEntitlementStatus() {
  return useEntitlementStore((state) => state.entitlementStatus);
}

export function useSchoolAccess() {
  return useEntitlementStore((state) => state.schoolAccess);
}

export function usePurchaseAccess() {
  return useEntitlementStore((state) => state.purchaseAccess);
}

export function useRevenueCatConfigured() {
  return useEntitlementStore((state) => state.revenueCatConfigured);
}

export function useRevenueCatOfferings() {
  return useEntitlementStore((state) => state.revenueCatOfferings);
}

export function useRevenueCatStatus() {
  return useEntitlementStore((state) => state.revenueCatStatus);
}

export function useHasFeatureAccess(feature: AppFeature) {
  const currentUser = useAppShellStore((state) => getCurrentUserFromState(state));
  const remoteFeatureEntitlements = useEntitlementStore(
    (state) => state.featureEntitlements
  );
  const purchaseFeatureEntitlements = useEntitlementStore(
    (state) => state.revenueCatFeatureEntitlements
  );

  if (currentUser?.provider === "mock") {
    return true;
  }

  return (
    remoteFeatureEntitlements.premium_access ||
    purchaseFeatureEntitlements.premium_access ||
    remoteFeatureEntitlements[feature] ||
    purchaseFeatureEntitlements[feature]
  );
}

export function useHasPlusAccess() {
  const currentUser = useAppShellStore((state) => getCurrentUserFromState(state));
  const debugPlusOverride = useEntitlementStore((state) => state.debugPlusOverride);
  const purchaseFeatureEntitlements = useEntitlementStore(
    (state) => state.revenueCatFeatureEntitlements
  );

  if ((__DEV__ || mobileEnv.enableE2ETestMode) && debugPlusOverride !== null) {
    return debugPlusOverride;
  }

  if (FEATURE_FLAGS.devPlusAccess) {
    return true;
  }

  if (currentUser?.provider === "mock") {
    return true;
  }

  return (
    purchaseFeatureEntitlements.premium_access ||
    purchaseFeatureEntitlements.ai_question_chat
  );
}

export function useShouldShowAds() {
  return FEATURE_FLAGS.enableAds && !useHasPlusAccess();
}

export function useHasAiChatAccess() {
  return useHasPlusAccess();
}
