import { getWebServerEnv } from "./server-env";
import { getWebSupabaseAdminClient } from "./supabase-admin";

export type ServerAppErrorSeverity = "info" | "warning" | "error" | "critical";

type LogServerErrorInput = {
  area: string;
  authMode?: string | null;
  error?: unknown;
  eventName: string;
  message?: string;
  metadata?: Record<string, unknown>;
  platform?: string | null;
  severity?: ServerAppErrorSeverity;
  source?: string;
  userId?: string | null;
};

export async function logServerError(input: LogServerErrorInput) {
  const env = getWebServerEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const normalizedError = normalizeServerError(input.error);

  try {
    const { error } = await getWebSupabaseAdminClient()
      .from("app_error_logs")
      .insert({
      user_id: input.userId ?? null,
      source: normalizeString(input.source) ?? "web_admin",
      area: normalizeString(input.area) ?? "web_unknown",
      event_name: normalizeString(input.eventName) ?? "web_unknown_error",
      severity: input.severity ?? "error",
      message:
        normalizeString(input.message) ??
        normalizedError.message ??
        `${input.area}:${input.eventName}`,
      error_name: normalizedError.name,
      error_code: normalizedError.code,
      auth_mode: normalizeString(input.authMode) ?? "admin",
      platform: normalizeString(input.platform) ?? "web",
      metadata: sanitizeMetadata(input.metadata),
    });

    if (error) {
      console.error("Failed to persist server error log.", error);
    }
  } catch (error) {
    console.error("Failed to persist server error log.", error);
  }
}

function normalizeServerError(error: unknown) {
  if (error instanceof Error) {
    const record = error as Error & {
      code?: unknown;
      status?: unknown;
    };

    return {
      code: normalizeCode(record.code ?? record.status),
      message: normalizeString(error.message),
      name: normalizeString(error.name),
    };
  }

  const record =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;

  return {
    code: normalizeCode(record?.code ?? record?.status),
    message:
      normalizeString(record?.message) ??
      normalizeString(record?.details) ??
      normalizeString(record?.error_description),
    name: normalizeString(record?.name),
  };
}

function normalizeCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter((entry) => entry[1] !== undefined)
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
