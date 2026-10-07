import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { AnalyticsProperties } from "../../analytics/catalog";
import type { RevenueCatPackageSummary } from "../../state/entitlements";
import type { CheckoutAttempt } from "./checkout";
import type { RevenueCatCheckoutErrorKind } from "./revenuecat-errors";
import { CHECKOUT_ORIGIN_KEYS, PAYWALL_ORIGIN_KEYS } from "./offer-origin";

const JOURNAL_PREFIX = "prawko.checkout.v1:";
const CONTEXT_KEYS = [
  "source", "surface", "roadmap_step_id", "presentation", "moment", "feature",
  "exam_country", "category", "locale",
  "auth_mode", "app_version", "monetization_version", "paywall_reason",
  "plan", "default_plan", "paywall_variant", "paywall_offer", "paywall_config_version",
  "trial_days", "trial_eligibility", "trial_shown", "subscription_period", "price_basis",
  "offer_load_id", "offer_request_id",
  "trial_eligibility_observation_version", "trial_eligibility_basis", "trial_eligibility_request_id",
  ...PAYWALL_ORIGIN_KEYS, ...CHECKOUT_ORIGIN_KEYS,
] as const;
const ERROR_KINDS: RevenueCatCheckoutErrorKind[] = [
  "cancelled", "payment_pending", "store_problem", "operation_in_progress",
  "already_owned", "network", "not_allowed", "invalid_purchase",
  "configuration", "unavailable", "receipt_in_use", "unknown", "local_storage",
];

export type CheckoutJournalRecord = {
  attempt: CheckoutAttempt & { kind: "purchase"; package: RevenueCatPackageSummary };
  properties: AnalyticsProperties;
  startedAt: number;
  savedAt: number;
  nativePurchaseCompleted: boolean;
  activeMs: number;
  backgroundMs: number;
  inactiveMs: number;
  unobservedMs: number;
};

let writeChain: Promise<void> = Promise.resolve();

export function isCheckoutJournalStorageKey(key: string) {
  return key.startsWith(JOURNAL_PREFIX);
}

function journalKey(appUserId: string) {
  // Native app sandboxes already isolate PL/CZ/SK apps. The journal belongs to
  // the store identity, not a learning country that can change mid-checkout.
  return `${JOURNAL_PREFIX}${Platform.OS}:${appUserId}`;
}

export function checkoutStorageError(cause: unknown) {
  return Object.assign(new Error("Could not read or persist purchase recovery state."), {
    code: "checkout_storage_error",
    cause,
  });
}

export function journalContext(properties: AnalyticsProperties) {
  const result: AnalyticsProperties = {};
  for (const key of CONTEXT_KEYS) {
    const value = properties[key];
    if (
      value === null || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.length <= 1024)
    ) {
      result[key] = value;
    }
  }
  // No receipts, raw errors, access flags, callbacks or navigation actions.
  return result;
}

export function writeCheckoutJournal(appUserId: string, attempts: CheckoutJournalRecord[]) {
  const key = journalKey(appUserId);
  const raw = JSON.stringify({
    version: 1,
    appUserId,
    attempts: attempts.map((saved) => ({
      ...saved,
      attempt: {
        ...saved.attempt,
        package: {
          identifier: saved.attempt.package.identifier,
          offeringIdentifier: saved.attempt.package.offeringIdentifier,
          productIdentifier: saved.attempt.package.productIdentifier,
          packageType: saved.attempt.package.packageType,
          price: saved.attempt.package.price,
          currencyCode: saved.attempt.package.currencyCode,
          subscriptionPeriod: saved.attempt.package.subscriptionPeriod,
          freeTrialDays: saved.attempt.package.freeTrialDays ?? null,
        },
      },
    })),
  });
  const write = writeChain.catch(() => undefined).then(() =>
    AsyncStorage.setItem(key, raw)
  );
  writeChain = write;
  return write;
}

export async function readCheckoutJournal(appUserId: string): Promise<CheckoutJournalRecord[]> {
  await writeChain.catch(() => undefined);
  const raw = await AsyncStorage.getItem(journalKey(appUserId));
  if (raw === null) {
    return [];
  }
  const parsed = record(JSON.parse(raw));
  if (parsed.version !== 1 || parsed.appUserId !== appUserId || !Array.isArray(parsed.attempts)) {
    throw new Error("Unsupported or mismatched checkout journal.");
  }
  const ids = new Set<string>();
  return parsed.attempts.map((value: unknown) => {
    const restored = parseAttempt(value, appUserId);
    if (ids.has(restored.attempt.id)) {
      throw new Error("Duplicate attempt in checkout journal.");
    }
    ids.add(restored.attempt.id);
    return restored;
  });
}

function parseAttempt(value: unknown, appUserId: string): CheckoutJournalRecord {
  const saved = record(value);
  const attempt = record(saved.attempt);
  if (
    attempt.appUserId !== appUserId || attempt.kind !== "purchase" ||
    attempt.stage !== "purchase_package" ||
    typeof attempt.status !== "string" ||
    !["purchasing", "awaiting_confirmation", "outcome_unknown"].includes(attempt.status)
  ) {
    throw new Error("Invalid unresolved checkout attempt.");
  }
  const errorKind = nullableString(attempt.errorKind);
  if (errorKind !== null && !ERROR_KINDS.includes(errorKind as RevenueCatCheckoutErrorKind)) {
    throw new Error("Invalid checkout error category.");
  }
  if (typeof saved.nativePurchaseCompleted !== "boolean") {
    throw new Error("Invalid native checkout outcome.");
  }
  return {
    attempt: {
      id: requiredString(attempt.id),
      appUserId,
      kind: "purchase",
      originViewId: requiredString(attempt.originViewId),
      status: attempt.status as "purchasing" | "awaiting_confirmation" | "outcome_unknown",
      stage: "purchase_package",
      package: parsePackage(attempt.package),
      errorKind: errorKind as RevenueCatCheckoutErrorKind | null,
      errorCode: nullableString(attempt.errorCode),
      errorMessage: null,
      transactionId: nullableString(attempt.transactionId),
      retryOfAttemptId: nullableString(attempt.retryOfAttemptId),
    },
    properties: journalContext(record(saved.properties) as AnalyticsProperties),
    startedAt: positiveNumber(saved.startedAt),
    savedAt: positiveNumber(saved.savedAt),
    nativePurchaseCompleted: saved.nativePurchaseCompleted,
    activeMs: nonnegativeNumber(saved.activeMs),
    backgroundMs: nonnegativeNumber(saved.backgroundMs),
    inactiveMs: nonnegativeNumber(saved.inactiveMs),
    unobservedMs: nonnegativeNumber(saved.unobservedMs),
  };
}

function parsePackage(value: unknown): RevenueCatPackageSummary {
  const offer = record(value);
  return {
    identifier: requiredString(offer.identifier),
    offeringIdentifier: requiredString(offer.offeringIdentifier),
    productIdentifier: requiredString(offer.productIdentifier),
    packageType: requiredString(offer.packageType),
    price: nonnegativeNumber(offer.price),
    currencyCode: requiredString(offer.currencyCode),
    // Recovery is not an offer. The current paywall loads fresh display copy.
    title: "",
    description: "",
    priceString: "",
    pricePerMonthString: null,
    pricePerWeekString: null,
    pricePerYearString: null,
    // Optional metadata preserves backwards compatibility with v1 journals.
    subscriptionPeriod: typeof offer.subscriptionPeriod === "string" &&
      /^P[1-9]\d*[DWMY]$/.test(offer.subscriptionPeriod) ? offer.subscriptionPeriod : null,
    freeTrialDays: typeof offer.freeTrialDays === "number" &&
      Number.isFinite(offer.freeTrialDays) && offer.freeTrialDays >= 0 ? offer.freeTrialDays : null,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid checkout journal object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 1024) {
    throw new Error("Invalid checkout journal string.");
  }
  return value;
}

function nullableString(value: unknown) {
  return value === null ? null : requiredString(value);
}

function nonnegativeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid checkout journal number.");
  }
  return value;
}

function positiveNumber(value: unknown) {
  const number = nonnegativeNumber(value);
  if (number === 0) {
    throw new Error("Invalid checkout journal timestamp.");
  }
  return number;
}
