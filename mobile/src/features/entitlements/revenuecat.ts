import { APP_FEATURES, type AppFeature } from "@prawko/config";
import { Platform } from "react-native";
import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";
import { PAYWALL_RESULT } from "react-native-purchases-ui";

import { mobileEnv } from "../../config/env";
import {
  createEmptyFeatureEntitlements,
  type PurchaseAccessState,
  type RevenueCatPackageSummary,
} from "../../state/entitlements";
import {
  REVENUECAT_PACKAGE_ALIASES,
  REVENUECAT_PRO_ENTITLEMENT_ALIASES,
  REVENUECAT_PRO_ENTITLEMENT_ID,
  REVENUECAT_PRODUCT_IDS,
  type RevenueCatPaywallOutcome,
  type RevenueCatProductId,
} from "./revenuecat-config";

type RevenueCatModule = typeof import("react-native-purchases");
type RevenueCatUIModule = typeof import("react-native-purchases-ui");

export type RevenueCatSnapshot = {
  featureEntitlements: ReturnType<typeof createEmptyFeatureEntitlements>;
  isConfigured: boolean;
  offerings: RevenueCatPackageSummary[];
  purchaseAccess: PurchaseAccessState | null;
};

const ENTITLEMENT_ALIASES: Record<AppFeature, string[]> = {
  premium_access: [
    REVENUECAT_PRO_ENTITLEMENT_ID.toLowerCase(),
    ...REVENUECAT_PRO_ENTITLEMENT_ALIASES,
  ],
  ai_explanations: [
    REVENUECAT_PRO_ENTITLEMENT_ID.toLowerCase(),
    ...REVENUECAT_PRO_ENTITLEMENT_ALIASES,
    "ai_explanations",
  ],
  ai_question_chat: [
    REVENUECAT_PRO_ENTITLEMENT_ID.toLowerCase(),
    ...REVENUECAT_PRO_ENTITLEMENT_ALIASES,
    "ai_question_chat",
    "ai_chat",
  ],
  exam_simulator: [
    REVENUECAT_PRO_ENTITLEMENT_ID.toLowerCase(),
    ...REVENUECAT_PRO_ENTITLEMENT_ALIASES,
    "exam_simulator",
    "exam",
  ],
};

let configuredAppUserId: string | null = null;
let configuredApiKey: string | null = null;
let didConfigurePurchases = false;
let revenueCatModulePromise: Promise<RevenueCatModule> | null = null;
let revenueCatUIModulePromise: Promise<RevenueCatUIModule> | null = null;
let customerInfoListener: CustomerInfoUpdateListener | null = null;

export function isRevenueCatConfiguredForCurrentPlatform() {
  return Boolean(getRevenueCatPublicApiKey());
}

export function hasProEntitlement(customerInfo: CustomerInfo) {
  const activeIds = Object.keys(customerInfo.entitlements.active).map((value) =>
    value.toLowerCase()
  );

  return ENTITLEMENT_ALIASES.premium_access.some((candidate) =>
    activeIds.includes(candidate.toLowerCase())
  );
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

/**
 * Presents the remotely configured RevenueCat Paywall for the current offering.
 * Falls back to `not_presented` when the dashboard paywall is missing.
 */
export async function presentRevenueCatPaywall(input: {
  appUserId: string;
  requiredEntitlementIdentifier?: string;
}): Promise<{
  outcome: RevenueCatPaywallOutcome;
  snapshot: RevenueCatSnapshot | null;
}> {
  const isConfigured = await ensureRevenueCatReady(input.appUserId);

  if (!isConfigured) {
    return { outcome: "not_presented", snapshot: null };
  }

  try {
    const RevenueCatUI = (await getRevenueCatUIModule()).default;
    const requiredEntitlementIdentifier =
      input.requiredEntitlementIdentifier ?? REVENUECAT_PRO_ENTITLEMENT_ID;

    const result = await RevenueCatUI.presentPaywallIfNeeded({
      displayCloseButton: true,
      requiredEntitlementIdentifier,
    });

    const outcome = mapPaywallResult(result);

    if (outcome !== "purchased" && outcome !== "restored") {
      return { outcome, snapshot: null };
    }

    const snapshot = await fetchRevenueCatSnapshot(input.appUserId);
    return { outcome, snapshot };
  } catch (error) {
    console.warn("Failed to present RevenueCat paywall.", error);
    return { outcome: "error", snapshot: null };
  }
}

/**
 * Opens RevenueCat Customer Center for restore / manage / support flows.
 */
export async function presentRevenueCatCustomerCenter(input: {
  appUserId: string;
  onCustomerInfoUpdated?: (snapshot: RevenueCatSnapshot) => void;
}) {
  const isConfigured = await ensureRevenueCatReady(input.appUserId);

  if (!isConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }

  const RevenueCatUI = (await getRevenueCatUIModule()).default;

  await RevenueCatUI.presentCustomerCenter({
    callbacks: {
      onRestoreCompleted: ({ customerInfo }) => {
        if (!input.onCustomerInfoUpdated) {
          return;
        }

        void buildSnapshotFromCustomerInfo(customerInfo).then(
          input.onCustomerInfoUpdated
        );
      },
      onPromotionalOfferSucceeded: ({ customerInfo }) => {
        if (!input.onCustomerInfoUpdated) {
          return;
        }

        void buildSnapshotFromCustomerInfo(customerInfo).then(
          input.onCustomerInfoUpdated
        );
      },
    },
  });
}

export async function subscribeToRevenueCatCustomerInfo(
  appUserId: string,
  onUpdate: (snapshot: RevenueCatSnapshot) => void
) {
  const isConfigured = await ensureRevenueCatReady(appUserId);

  if (!isConfigured) {
    return () => undefined;
  }

  const Purchases = (await getRevenueCatModule()).default;

  if (customerInfoListener) {
    Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    customerInfoListener = null;
  }

  const listener: CustomerInfoUpdateListener = (customerInfo) => {
    void buildSnapshotFromCustomerInfo(customerInfo)
      .then(onUpdate)
      .catch((error) => {
        console.warn("Failed to map RevenueCat customer info update.", error);
      });
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  customerInfoListener = listener;

  return () => {
    if (customerInfoListener === listener) {
      Purchases.removeCustomerInfoUpdateListener(listener);
      customerInfoListener = null;
    }
  };
}

export async function logoutRevenueCatUser() {
  if (customerInfoListener) {
    try {
      const Purchases = (await getRevenueCatModule()).default;
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    } catch {
      // Module may be unavailable during teardown.
    }
    customerInfoListener = null;
  }

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

export function matchRevenueCatProductId(
  item: Pick<
    RevenueCatPackageSummary,
    "identifier" | "packageType" | "productIdentifier"
  >
): RevenueCatProductId | null {
  const candidates = [
    item.identifier,
    item.productIdentifier,
    item.packageType,
  ].map((value) => value.toLowerCase());

  for (const productId of Object.values(REVENUECAT_PRODUCT_IDS)) {
    const aliases = REVENUECAT_PACKAGE_ALIASES[productId].map((alias) =>
      alias.toLowerCase()
    );

    if (
      aliases.some((alias) =>
        candidates.some(
          (candidate) => candidate === alias || candidate.includes(alias)
        )
      )
    ) {
      return productId;
    }
  }

  return null;
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
      Purchases.setLogLevel(
        __DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN
      );
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

async function getRevenueCatUIModule() {
  if (!revenueCatUIModulePromise) {
    revenueCatUIModulePromise = import("react-native-purchases-ui");
  }

  return revenueCatUIModulePromise;
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

async function buildSnapshotFromCustomerInfo(customerInfo: CustomerInfo) {
  const Purchases = (await getRevenueCatModule()).default;
  const offerings = await Purchases.getOfferings();

  return mapRevenueCatSnapshot({
    customerInfo,
    isConfigured: true,
    offerings,
  });
}

function mapPaywallResult(result: PAYWALL_RESULT): RevenueCatPaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return "purchased";
    case PAYWALL_RESULT.RESTORED:
      return "restored";
    case PAYWALL_RESULT.CANCELLED:
      return "cancelled";
    case PAYWALL_RESULT.NOT_PRESENTED:
      return "not_presented";
    case PAYWALL_RESULT.ERROR:
    default:
      return "error";
  }
}

function mapRevenueCatSnapshot(input: {
  customerInfo: CustomerInfo;
  isConfigured: boolean;
  offerings: PurchasesOfferings;
}): RevenueCatSnapshot {
  const featureEntitlements = createEmptyFeatureEntitlements();
  const activeEntitlements = input.customerInfo.entitlements.active;

  for (const feature of APP_FEATURES) {
    featureEntitlements[feature] = hasMappedEntitlement(
      activeEntitlements,
      feature
    );
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
  const activeIds = Object.keys(activeEntitlements).map((value) =>
    value.toLowerCase()
  );

  return ENTITLEMENT_ALIASES[feature].some((candidate) =>
    activeIds.includes(candidate.toLowerCase())
  );
}

function sortRevenueCatPackages(items: RevenueCatPackageSummary[]) {
  const order: Record<string, number> = {
    MONTHLY: 0,
    ANNUAL: 1,
    LIFETIME: 2,
    WEEKLY: 3,
    TWO_MONTH: 4,
    THREE_MONTH: 5,
    SIX_MONTH: 6,
    CUSTOM: 7,
    UNKNOWN: 8,
  };

  return [...items].sort((left, right) => {
    const leftProduct = matchRevenueCatProductId(left);
    const rightProduct = matchRevenueCatProductId(right);
    const productOrder: RevenueCatProductId[] = [
      "monthly",
      "yearly",
      "lifetime",
    ];

    if (leftProduct || rightProduct) {
      const leftIndex = leftProduct
        ? productOrder.indexOf(leftProduct)
        : 99;
      const rightIndex = rightProduct
        ? productOrder.indexOf(rightProduct)
        : 99;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
    }

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
