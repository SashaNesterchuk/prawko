import { APP_FEATURES, type AppFeature } from "@prawko/config";
import { Platform } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";

import { mobileEnv } from "../../config/env";
import {
  createEmptyFeatureEntitlements,
  type PurchaseAccessState,
  type RevenueCatPackageSummary,
} from "../../state/entitlements";

type RevenueCatModule = typeof import("react-native-purchases");

export type RevenueCatSnapshot = {
  featureEntitlements: ReturnType<typeof createEmptyFeatureEntitlements>;
  isConfigured: boolean;
  offerings: RevenueCatPackageSummary[];
  purchaseAccess: PurchaseAccessState | null;
};

const ENTITLEMENT_ALIASES: Record<AppFeature, string[]> = {
  premium_access: ["premium_access", "premium", "pro", "full_access"],
  ai_explanations: ["ai_explanations", "premium_access", "premium"],
  ai_question_chat: ["ai_question_chat", "ai_chat", "plus", "premium_access", "premium"],
  exam_simulator: ["exam_simulator", "exam", "premium_access", "premium"],
};

let configuredAppUserId: string | null = null;
let configuredApiKey: string | null = null;
let didConfigurePurchases = false;
let revenueCatModulePromise: Promise<RevenueCatModule> | null = null;

export function isRevenueCatConfiguredForCurrentPlatform() {
  return Boolean(getRevenueCatPublicApiKey());
}

export async function fetchRevenueCatSnapshot(
  appUserId: string
): Promise<RevenueCatSnapshot> {
  const isConfigured = await ensureRevenueCatReady(appUserId);

  if (!isConfigured) {
    return createEmptyRevenueCatSnapshot(false);
  }

  const Purchases = (await getRevenueCatModule()).default;
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);

  return mapRevenueCatSnapshot({
    customerInfo,
    isConfigured: true,
    offerings,
  });
}

export async function purchaseRevenueCatPackage(input: {
  appUserId: string;
  identifier: string;
  offeringIdentifier: string;
}) {
  const isConfigured = await ensureRevenueCatReady(input.appUserId);

  if (!isConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }

  const Purchases = (await getRevenueCatModule()).default;
  const offerings = await Purchases.getOfferings();
  const targetPackage = findOfferingPackage(offerings, input);

  if (!targetPackage) {
    throw new Error("The selected purchase package is no longer available.");
  }

  const result = await Purchases.purchasePackage(targetPackage);

  return mapRevenueCatSnapshot({
    customerInfo: result.customerInfo,
    isConfigured: true,
    offerings,
  });
}

export async function restoreRevenueCatPurchases(appUserId: string) {
  const isConfigured = await ensureRevenueCatReady(appUserId);

  if (!isConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }

  const Purchases = (await getRevenueCatModule()).default;
  const [customerInfo, offerings] = await Promise.all([
    Purchases.restorePurchases(),
    Purchases.getOfferings(),
  ]);

  return mapRevenueCatSnapshot({
    customerInfo,
    isConfigured: true,
    offerings,
  });
}

export async function logoutRevenueCatUser() {
  if (!didConfigurePurchases) {
    configuredAppUserId = null;
    configuredApiKey = null;
    return;
  }

  try {
    const Purchases = (await getRevenueCatModule()).default;
    await Purchases.logOut();
  } catch (error) {
    console.warn("Failed to log out RevenueCat user.", error);
  } finally {
    configuredAppUserId = null;
  }
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  return Boolean((error as { userCancelled?: unknown })?.userCancelled);
}

export function getRevenueCatErrorMessage(error: unknown) {
  const message = getErrorMessage(error);

  if (!message) {
    return "The purchase action could not be completed.";
  }

  if (/not configured/i.test(message)) {
    return "Direct purchase is not configured in this build yet.";
  }

  if (/network/i.test(message) || /offline/i.test(message)) {
    return "The purchase request failed because the device is offline.";
  }

  if (/package is no longer available/i.test(message)) {
    return "The selected offer is no longer available.";
  }

  if (/already.*subscribed/i.test(message)) {
    return "This subscription is already active on this account.";
  }

  return message;
}

function createEmptyRevenueCatSnapshot(
  isConfigured: boolean
): RevenueCatSnapshot {
  return {
    featureEntitlements: createEmptyFeatureEntitlements(),
    isConfigured,
    offerings: [],
    purchaseAccess: null,
  };
}

async function ensureRevenueCatReady(appUserId: string) {
  const apiKey = getRevenueCatPublicApiKey();

  if (!apiKey) {
    return false;
  }

  const Purchases = (await getRevenueCatModule()).default;

  if (!didConfigurePurchases) {
    if ("setLogLevel" in Purchases) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    }

    Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });
    configuredApiKey = apiKey;
    configuredAppUserId = appUserId;
    didConfigurePurchases = true;
    return true;
  }

  if (configuredApiKey !== apiKey) {
    Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });
    configuredApiKey = apiKey;
    configuredAppUserId = appUserId;
    return true;
  }

  if (configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  }

  return true;
}

async function getRevenueCatModule() {
  if (!revenueCatModulePromise) {
    revenueCatModulePromise = import("react-native-purchases");
  }

  return revenueCatModulePromise;
}

function getRevenueCatPublicApiKey() {
  if (Platform.OS === "ios") {
    return mobileEnv.revenueCatAppleApiKey;
  }

  if (Platform.OS === "android") {
    return mobileEnv.revenueCatGoogleApiKey;
  }

  return "";
}

function mapRevenueCatSnapshot(input: {
  customerInfo: CustomerInfo;
  isConfigured: boolean;
  offerings: PurchasesOfferings;
}): RevenueCatSnapshot {
  const featureEntitlements = createEmptyFeatureEntitlements();
  const activeEntitlements = input.customerInfo.entitlements.active;

  for (const feature of APP_FEATURES) {
    featureEntitlements[feature] = hasMappedEntitlement(activeEntitlements, feature);
  }

  return {
    featureEntitlements,
    isConfigured: input.isConfigured,
    offerings: mapOfferings(input.offerings),
    purchaseAccess:
      Object.keys(activeEntitlements).length > 0
        ? {
            activeEntitlementIds: Object.keys(activeEntitlements),
            latestExpirationDate: input.customerInfo.latestExpirationDate,
            managementUrl: input.customerInfo.managementURL,
            originalAppUserId: input.customerInfo.originalAppUserId,
          }
        : null,
  };
}

function mapOfferings(offerings: PurchasesOfferings) {
  const currentPackages = offerings.current?.availablePackages ?? [];

  if (currentPackages.length > 0) {
    return sortRevenueCatPackages(currentPackages.map(mapRevenueCatPackage));
  }

  const fallbackPackages = Object.values(offerings.all)
    .flatMap((offering) => offering.availablePackages)
    .map(mapRevenueCatPackage);

  return sortRevenueCatPackages(
    dedupeByKey(fallbackPackages, (item) => {
      return `${item.offeringIdentifier}:${item.identifier}:${item.productIdentifier}`;
    })
  );
}

function mapRevenueCatPackage(item: PurchasesPackage): RevenueCatPackageSummary {
  return {
    description: item.product.description,
    identifier: item.identifier,
    offeringIdentifier: item.presentedOfferingContext.offeringIdentifier,
    packageType: item.packageType,
    price: item.product.price,
    pricePerMonthString: item.product.pricePerMonthString,
    pricePerWeekString: item.product.pricePerWeekString,
    pricePerYearString: item.product.pricePerYearString,
    priceString: item.product.priceString,
    productIdentifier: item.product.identifier,
    subscriptionPeriod: item.product.subscriptionPeriod,
    title: item.product.title,
  };
}

function findOfferingPackage(
  offerings: PurchasesOfferings,
  input: {
    identifier: string;
    offeringIdentifier: string;
  }
) {
  const packages = offerings.all[input.offeringIdentifier]?.availablePackages;

  return (
    packages?.find((item) => item.identifier === input.identifier) ??
    offerings.current?.availablePackages.find(
      (item) =>
        item.identifier === input.identifier &&
        item.presentedOfferingContext.offeringIdentifier ===
          input.offeringIdentifier
    ) ??
    null
  );
}

function hasMappedEntitlement(
  activeEntitlements: CustomerInfo["entitlements"]["active"],
  feature: AppFeature
) {
  const activeIds = Object.keys(activeEntitlements).map((value) => value.toLowerCase());

  return ENTITLEMENT_ALIASES[feature].some((candidate) =>
    activeIds.includes(candidate)
  );
}

function sortRevenueCatPackages(items: RevenueCatPackageSummary[]) {
  const order: Record<string, number> = {
    WEEKLY: 0,
    MONTHLY: 1,
    TWO_MONTH: 2,
    THREE_MONTH: 3,
    SIX_MONTH: 4,
    ANNUAL: 5,
    LIFETIME: 6,
    CUSTOM: 7,
    UNKNOWN: 8,
  };

  return [...items].sort((left, right) => {
    const leftOrder = order[left.packageType] ?? 99;
    const rightOrder = order[right.packageType] ?? 99;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.price - right.price;
  });
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim() ? message.trim() : null;
}
