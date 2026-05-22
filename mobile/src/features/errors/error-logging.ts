import { Platform } from "react-native";

import type { AnalyticsTrackPayload } from "../../providers/AnalyticsProvider";
import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";

export type AppErrorSeverity = "info" | "warning" | "error" | "critical";

export type ErrorLogMetadata = AnalyticsTrackPayload;

export type CaptureErrorInput = {
  area: string;
  error?: unknown;
  eventName: string;
  message?: string;
  metadata?: ErrorLogMetadata;
  severity?: AppErrorSeverity;
  source?: "mobile";
};

type PersistedAppErrorLog = {
  area: string;
  authMode: string | null;
  errorCode: string | null;
  errorName: string | null;
  eventName: string;
  message: string;
  metadata: ErrorLogMetadata;
  platform: string;
  severity: AppErrorSeverity;
  source: string;
};

export function normalizeCapturedError(
  input: CaptureErrorInput,
  context: {
    authMode: string | null;
    category: string | null;
    locale: string | null;
  }
) {
  const normalizedMetadata = sanitizeMetadata({
    ...input.metadata,
    auth_mode: context.authMode,
    category: context.category,
    locale: context.locale,
    platform: Platform.OS,
  });
  const normalizedError = normalizeErrorDetails(input.error);
  const message =
    sanitizeString(input.message) ??
    normalizedError.message ??
    `${input.area}:${input.eventName}`;

  return {
    analyticsPayload: {
      area: input.area,
      auth_mode: context.authMode,
      category: context.category,
      error_code: normalizedError.code,
      error_name: normalizedError.name,
      event_name: input.eventName,
      locale: context.locale,
      message,
      platform: Platform.OS,
      severity: input.severity ?? "error",
      source: input.source ?? "mobile",
      ...normalizedMetadata,
    } as AnalyticsTrackPayload,
    persistedLog: {
      area: input.area,
      authMode: context.authMode,
      errorCode: normalizedError.code,
      errorName: normalizedError.name,
      eventName: input.eventName,
      message,
      metadata: normalizedMetadata,
      platform: Platform.OS,
      severity: input.severity ?? "error",
      source: input.source ?? "mobile",
    } satisfies PersistedAppErrorLog,
  };
}

export async function persistMobileErrorLog(
  input: PersistedAppErrorLog,
  options: {
    canPersist: boolean;
  }
) {
  if (!options.canPersist || !isMobileSupabaseConfigured) {
    return;
  }

  try {
    await getMobileSupabaseClient().rpc("log_client_error", {
      p_area: input.area,
      p_auth_mode: input.authMode,
      p_error_code: input.errorCode,
      p_error_name: input.errorName,
      p_event_name: input.eventName,
      p_message: input.message,
      p_metadata: input.metadata,
      p_platform: input.platform,
      p_severity: input.severity,
      p_source: input.source,
    });
  } catch (error) {
    console.warn("Failed to persist app error log.", error);
  }
}

export function normalizeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      code: getErrorCode(error),
      message: sanitizeString(error.message),
      name: sanitizeString(error.name),
    };
  }

  if (typeof error === "string") {
    return {
      code: null,
      message: sanitizeString(error),
      name: null,
    };
  }

  const record =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;

  return {
    code: sanitizeString(record?.code),
    message:
      sanitizeString(record?.message) ??
      sanitizeString(record?.error_description) ??
      sanitizeString(record?.details),
    name: sanitizeString(record?.name),
  };
}

function getErrorCode(error: Error) {
  const record = error as Error & {
    code?: unknown;
    status?: unknown;
  };

  if (typeof record.code === "string" && record.code.trim()) {
    return record.code.trim();
  }

  if (typeof record.status === "number" && Number.isFinite(record.status)) {
    return String(record.status);
  }

  return null;
}

function sanitizeMetadata(payload?: ErrorLogMetadata) {
  if (!payload) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).filter((entry) => entry[1] !== undefined)
  ) as ErrorLogMetadata;
}

function sanitizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
