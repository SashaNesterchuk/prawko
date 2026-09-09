import { buildDiagnosticDetail } from "../../analytics/diagnostic-detail";
import {
  ANALYTICS_PROPERTIES,
  type AnalyticsProperties,
} from "../../analytics/catalog";

export function isRevenueCatPurchaseCancelled(error: unknown) {
  return Boolean((error as { userCancelled?: unknown })?.userCancelled);
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

  if (
    typeof record.readableErrorCode === "string" &&
    record.readableErrorCode.trim()
  ) {
    return record.readableErrorCode.trim();
  }

  return null;
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

  const readable = (error as { readableErrorCode?: unknown }).readableErrorCode;

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
