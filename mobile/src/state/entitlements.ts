import { APP_FEATURES, FEATURE_FLAGS, type AppFeature } from "@prawko/config";
import { create } from "zustand";

import type { AnalyticsProperties } from "../analytics/catalog";
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
  currencyCode: string;
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

export type RevenueCatOfferingsLoad = {
  id: string;
  source: string;
  status: "loading" | "ready" | "empty" | "failed";
  startedAt: number;
  completedAt: number | null;
  errorCode: string | null;
  diagnostic: AnalyticsProperties;
};

type EntitlementState = {
  beginRevenueCatOfferingsLoad: (load: RevenueCatOfferingsLoad) => void;
  finishRevenueCatOfferingsLoad: (input: {
    id: string;
    offerings?: RevenueCatPackageSummary[];
    errorCode?: string;
    diagnostic?: AnalyticsProperties;
  }) => void;
  beginRevenueCatHydration: () => void;
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
    customerInfoRequestDate?: string;
    featureEntitlements: FeatureEntitlementMap;
    isConfigured: boolean;
    offerings: RevenueCatPackageSummary[];
    offeringsError?: string | null;
    /** false for SDK snapshots whose offers were already published independently. */
    offeringsUpdated?: boolean;
    purchaseAccess: PurchaseAccessState | null;
  }) => void;
  markRevenueCatHydrationFailed: (errorCode?: string | null) => void;
  purchaseAccess: PurchaseAccessState | null;
  revenueCatConfigured: boolean;
  revenueCatCustomerInfoDate: number | null;
  revenueCatFeatureEntitlements: FeatureEntitlementMap;
  revenueCatHydrationError: string | null;
  revenueCatOfferings: RevenueCatPackageSummary[];
  revenueCatOfferingsLoad: RevenueCatOfferingsLoad | null;
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
  beginRevenueCatOfferingsLoad: (load) => set({ revenueCatOfferingsLoad: load }),
  finishRevenueCatOfferingsLoad: ({ id, offerings, errorCode, diagnostic = {} }) =>
    set((current) => {
      const load = current.revenueCatOfferingsLoad;
      if (!load || load.id !== id) return current;
      const failed = errorCode !== undefined;
      const nextOfferings = failed ? current.revenueCatOfferings : offerings ?? [];
      return {
        revenueCatOfferings: nextOfferings,
        revenueCatHydrationError: errorCode ?? null,
        revenueCatOfferingsLoad: {
          ...load,
          status: failed ? "failed" : nextOfferings.length > 0 ? "ready" : "empty",
          completedAt: Date.now(),
          errorCode: errorCode ?? null,
          diagnostic,
        },
      };
    }),
  beginRevenueCatHydration: () =>
    set({
      revenueCatConfigured: true,
      revenueCatStatus: "loading",
    }),
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
      revenueCatCustomerInfoDate: null,
      revenueCatFeatureEntitlements: createEmptyFeatureEntitlements(),
      revenueCatHydrationError: null,
      revenueCatOfferings: [],
      revenueCatOfferingsLoad: null,
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
    customerInfoRequestDate,
    featureEntitlements,
    isConfigured,
    offerings,
    offeringsError = null,
    offeringsUpdated = true,
    purchaseAccess,
  }) =>
    set((current) => {
      const parsedDate = customerInfoRequestDate ? Date.parse(customerInfoRequestDate) : NaN;
      const incomingDate = Number.isFinite(parsedDate) ? parsedDate : null;
      // A pre-purchase hydration request can finish after a CustomerInfo update.
      // Keep its offers, but never let older access data revoke the new purchase.
      const stale =
        incomingDate !== null &&
        current.revenueCatCustomerInfoDate !== null &&
        incomingDate < current.revenueCatCustomerInfoDate;
      return {
        purchaseAccess: stale ? current.purchaseAccess : purchaseAccess,
        revenueCatConfigured: isConfigured,
        revenueCatCustomerInfoDate: stale
          ? current.revenueCatCustomerInfoDate
          : incomingDate ?? current.revenueCatCustomerInfoDate,
        revenueCatFeatureEntitlements: stale
          ? current.revenueCatFeatureEntitlements
          : {
              ...createEmptyFeatureEntitlements(),
              ...featureEntitlements,
            },
        revenueCatHydrationError: offeringsUpdated ? offeringsError : current.revenueCatHydrationError,
        revenueCatOfferings: offeringsUpdated ? offerings : current.revenueCatOfferings,
        revenueCatStatus: "ready",
      };
    }),
  markRevenueCatHydrationFailed: (errorCode = null) =>
    set({
      revenueCatConfigured: true,
      revenueCatHydrationError: errorCode?.trim() ? errorCode.trim() : "unknown",
      revenueCatStatus: "ready",
    }),
  purchaseAccess: null,
  revenueCatConfigured: false,
  revenueCatCustomerInfoDate: null,
  revenueCatFeatureEntitlements: createEmptyFeatureEntitlements(),
  revenueCatHydrationError: null,
  revenueCatOfferings: [],
  revenueCatOfferingsLoad: null,
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

export function useRevenueCatHydrationError() {
  return useEntitlementStore((state) => state.revenueCatHydrationError);
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

export function hasGrantedPlusAccess(
  purchaseFeatureEntitlements: FeatureEntitlementMap,
  remoteFeatureEntitlements: FeatureEntitlementMap
) {
  return (
    purchaseFeatureEntitlements.premium_access ||
    purchaseFeatureEntitlements.ai_question_chat ||
    remoteFeatureEntitlements.premium_access ||
    remoteFeatureEntitlements.ai_question_chat
  );
}

export function readHasPlusAccess() {
  const debugPlusOverride = useEntitlementStore.getState().debugPlusOverride;

  if ((__DEV__ || mobileEnv.enableE2ETestMode) && debugPlusOverride !== null) {
    return debugPlusOverride;
  }

  if (FEATURE_FLAGS.devPlusAccess) {
    return true;
  }

  const currentUser = getCurrentUserFromState(useAppShellStore.getState());

  if (currentUser?.provider === "mock") {
    return true;
  }

  const store = useEntitlementStore.getState();

  return hasGrantedPlusAccess(
    store.revenueCatFeatureEntitlements,
    store.featureEntitlements
  );
}

export function useHasPlusAccess() {
  const currentUser = useAppShellStore((state) => getCurrentUserFromState(state));
  const debugPlusOverride = useEntitlementStore((state) => state.debugPlusOverride);
  const purchaseFeatureEntitlements = useEntitlementStore(
    (state) => state.revenueCatFeatureEntitlements
  );
  const remoteFeatureEntitlements = useEntitlementStore(
    (state) => state.featureEntitlements
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

  return hasGrantedPlusAccess(
    purchaseFeatureEntitlements,
    remoteFeatureEntitlements
  );
}

export function useShouldShowAds() {
  return FEATURE_FLAGS.enableAds && !useHasPlusAccess();
}

export function useHasAiChatAccess() {
  return useHasPlusAccess();
}
