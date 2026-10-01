import { buildDiagnosticDetail } from "../../analytics/diagnostic-detail";
import {
  ANALYTICS_PROPERTIES,
  type AnalyticsProperties,
} from "../../analytics/catalog";

export function isRevenueCatPurchaseCancelled(error: unknown) {
  const code = getRevenueCatErrorCode(error);
  return code === "1" || code === "PURCHASE_CANCELLED_ERROR" || code === "PURCHASE_CANCELLED" ||
    (!code && (error as { userCancelled?: unknown })?.userCancelled === true);
}

export type RevenueCatCheckoutErrorKind =
  | "cancelled" | "payment_pending" | "store_problem" | "operation_in_progress"
  | "already_owned" | "network" | "not_allowed" | "invalid_purchase"
  | "configuration" | "unavailable" | "receipt_in_use" | "unknown" | "local_storage";

export function getRevenueCatCheckoutErrorKind(error: unknown): RevenueCatCheckoutErrorKind {
  if (isRevenueCatPurchaseCancelled(error)) return "cancelled";
  const codes = [getRevenueCatErrorCode(error), getRevenueCatReadableErrorCode(error)];
  const matches = (...values: string[]) => codes.some((code) => code && values.includes(code));
  if (matches("checkout_storage_error")) return "local_storage";
  if (matches("20", "PAYMENT_PENDING_ERROR")) return "payment_pending";
  if (matches("2", "STORE_PROBLEM_ERROR", "STORE_PROBLEM")) return "store_problem";
  if (matches("15", "OPERATION_ALREADY_IN_PROGRESS_ERROR", "OPERATION_ALREADY_IN_PROGRESS")) return "operation_in_progress";
  if (matches("6", "PRODUCT_ALREADY_PURCHASED_ERROR", "PRODUCT_ALREADY_PURCHASED", "ITEM_ALREADY_OWNED")) return "already_owned";
  if (matches("10", "35", "32", "NETWORK_ERROR", "OFFLINE_CONNECTION_ERROR", "PRODUCT_REQUEST_TIMED_OUT_ERROR", "store_request_timeout")) return "network";
  if (matches("3", "19", "PURCHASE_NOT_ALLOWED_ERROR", "INSUFFICIENT_PERMISSIONS_ERROR")) return "not_allowed";
  if (matches("4", "PURCHASE_INVALID_ERROR")) return "invalid_purchase";
  if (matches("11", "23", "INVALID_CREDENTIALS_ERROR", "CONFIGURATION_ERROR")) return "configuration";
  if (matches("5", "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR", "offer_unavailable")) return "unavailable";
  if (matches("7", "13", "RECEIPT_ALREADY_IN_USE_ERROR", "RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR")) return "receipt_in_use";
  return "unknown";
}

export function getCheckoutErrorTranslationKey(kind: RevenueCatCheckoutErrorKind | null) {
  return `paywall.checkout.${kind ?? "unknown"}`;
}

/** Bounded structured codes/domains, never receipts, raw userInfo or account data. */
export function getRevenueCatStructuredErrorProperties(error: unknown): AnalyticsProperties {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const info = record.userInfo && typeof record.userInfo === "object"
    ? record.userInfo as Record<string, unknown> : {};
  const underlying = info.NSUnderlyingError ?? info.underlyingError ?? record.underlyingError;
  const native = underlying && typeof underlying === "object"
    ? underlying as Record<string, unknown> : {};
  const domain = native.domain ?? info.underlyingErrorDomain;
  const nativeCode = native.code ?? info.underlyingErrorCode;
  const kind = getRevenueCatCheckoutErrorKind(error);
  return {
    rc_error_code: getRevenueCatErrorCode(error),
    rc_readable_error_code: getRevenueCatReadableErrorCode(error),
    error_category: kind,
    retryability: ["store_problem", "network", "unknown"].includes(kind) ? "after_reconciliation_if_native_started"
      : kind === "operation_in_progress" ? "after_original_operation"
      : ["payment_pending", "already_owned"].includes(kind) ? "pending"
      : kind === "cancelled" ? "user_action" : "not_automatic",
    native_error_domain: typeof domain === "string" && /^[a-zA-Z0-9._-]{1,100}$/.test(domain) ? domain : null,
    native_error_code: (typeof nativeCode === "number" && Number.isFinite(nativeCode)) ||
      (typeof nativeCode === "string" && /^-?\d{1,10}$/.test(nativeCode)) ? String(nativeCode) : null,
    has_underlying_error: Boolean(underlying || info.underlyingErrorMessage || record.underlyingErrorMessage),
  };
}

export function isRevenueCatPurchasePending(error: unknown) {
  // RevenueCat PAYMENT_PENDING_ERROR = 20 (Ask to Buy / pending store payment).
  return [getRevenueCatErrorCode(error), getRevenueCatReadableErrorCode(error)].some(
    (code) => code === "20" || code === "PAYMENT_PENDING_ERROR"
  );
}

export function getRevenueCatErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as {
    code?: unknown;
    readableErrorCode?: unknown;
    status?: unknown;
  };

  if (typeof record.code === "number" && Number.isFinite(record.code)) {
    return String(record.code);
  }

  if (typeof record.code === "string" && record.code.trim()) {
    return record.code.trim();
  }

  if (typeof record.status === "number" && Number.isFinite(record.status)) {
    return String(record.status);
  }

  return getRevenueCatReadableErrorCode(error);
}

export function isRevenueCatOfflineConnectionError(error: unknown) {
  const code = getRevenueCatErrorCode(error);
  const readable = getRevenueCatReadableErrorCode(error);

  return (
    code === "35" ||
    code === "OFFLINE_CONNECTION_ERROR" ||
    readable === "35" ||
    readable === "OFFLINE_CONNECTION_ERROR"
  );
}

export function getRevenueCatErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  const underlying = getUnderlyingErrorMessage(error);
  const combined = [message, underlying].filter(Boolean).join(" ");

  if (isRevenueCatOfflineConnectionError(error)) {
    return "The purchase request failed because the device is offline.";
  }

  if (getRevenueCatCheckoutErrorKind(error) === "store_problem") {
    return "The store could not confirm the purchase result. The user may or may not have been charged; check access or restore before retrying payment.";
  }

  if (!combined) {
    return "The purchase action could not be completed.";
  }

  if (/not configured/i.test(combined)) {
    return "Direct purchase is not configured in this build yet.";
  }

  if (/timed out loading plus offers/i.test(combined)) {
    return "Loading the Plus offer timed out. Check the connection and try again.";
  }

  if (/network/i.test(combined) || /offline/i.test(combined)) {
    return "The purchase request failed because the device is offline.";
  }

  if (/package is no longer available/i.test(combined)) {
    return "The selected offer is no longer available.";
  }

  if (
    /none of the products could be fetched/i.test(combined) ||
    /could not be fetched from app store/i.test(combined) ||
    /product not available/i.test(combined) ||
    /store product not available/i.test(combined)
  ) {
    return "The App Store could not load the Plus product. Try again in a moment.";
  }

  if (
    /issue with your configuration/i.test(combined) ||
    /store problem/i.test(combined)
  ) {
    return "The App Store could not start this purchase. Check the product is available for this build and try again.";
  }

  if (/already.*subscribed/i.test(combined)) {
    return "This subscription is already active on this account.";
  }

  return message ?? combined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getUnderlyingErrorMessage(error: unknown) {
  const underlying = (error as { underlyingErrorMessage?: unknown })
    ?.underlyingErrorMessage;

  return typeof underlying === "string" && underlying.trim()
    ? underlying.trim()
    : null;
}

export function getRevenueCatReadableErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as {
    readableErrorCode?: unknown;
    userInfo?: { readableErrorCode?: unknown } | null;
  };
  const readable = record.userInfo?.readableErrorCode ?? record.readableErrorCode;

  return typeof readable === "string" && readable.trim()
    ? readable.trim()
    : null;
}

/** Low-cardinality why string for capture/track. Never use the forbidden `message` key. */
export function getRevenueCatWhy(error: unknown) {
  const code = getRevenueCatErrorCode(error);
  const readable = getRevenueCatReadableErrorCode(error);

  if (code && readable && readable !== code) {
    return `${code}:${readable}`;
  }

  return (
    code ??
    readable ??
    (error instanceof Error && error.name.trim() ? error.name.trim() : null) ??
    "unknown"
  );
}

export function getRevenueCatDiagnostic(input: {
  extra?: AnalyticsProperties;
  kind?: string | null;
  step: string;
  why: string;
}): AnalyticsProperties {
  const extra = input.extra ?? {};
  const kind = input.kind ?? null;

  return {
    [ANALYTICS_PROPERTIES.step]: input.step,
    [ANALYTICS_PROPERTIES.why]: input.why,
    kind,
    [ANALYTICS_PROPERTIES.detail]: buildDiagnosticDetail({
      [ANALYTICS_PROPERTIES.step]: input.step,
      [ANALYTICS_PROPERTIES.why]: input.why,
      kind,
      ...extra,
    }),
    ...extra,
  };
}
