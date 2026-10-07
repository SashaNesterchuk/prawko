import type { AnalyticsProperties } from "./catalog";

export const APPLE_SEARCH_ADS_STORAGE_KEY = "prawko.apple-search-ads.v1";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const GIVE_UP_MS = 72 * 60 * 60 * 1000;
const FIRST_EXCHANGE_DELAY_MS = 5_000;

const RETRY_DELAYS_MS = [
  5_000,
  15_000,
  30_000,
  60_000,
  2 * 60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
];

export type AppleSearchAdsUnavailableReason =
  | "invalid_token"
  | "token_error"
  | "unresolved";

export type AppleSearchAdsProperties = {
  asa_ad_group_id: number | null;
  asa_ad_id: number | null;
  asa_campaign_id: number | null;
  asa_claim_type: "Click" | "Impression" | null;
  asa_click_date: string | null;
  asa_conversion_type: "Download" | "Redownload" | null;
  asa_country_or_region: string | null;
  asa_impression_date: string | null;
  asa_keyword_id: number | null;
  asa_org_id: number | null;
  asa_result: "attributed" | "organic" | "unavailable";
  asa_unavailable_reason: AppleSearchAdsUnavailableReason | null;
};

type AppleSearchAdsPending = {
  attempts: number;
  firstAttemptAt: number;
  invalidTokenCount: number;
  nextAttemptAt: number;
  status: "pending";
  token: string;
  tokenFetchedAt: number;
};

type AppleSearchAdsTerminal = {
  captured: boolean;
  properties: AppleSearchAdsProperties;
  resolvedAt: number;
  status: "resolved" | "unavailable";
};

export type AppleSearchAdsRecord = AppleSearchAdsPending | AppleSearchAdsTerminal;

export type AppleSearchAdsPlan =
  | { kind: "exchange" }
  | { kind: "fetch_token" }
  | { kind: "give_up" }
  | { kind: "register"; properties: AppleSearchAdsProperties }
  | { kind: "wait"; delayMs: number };

export type AppleSearchAdsExchange =
  | { apple: unknown; outcome: "resolved" }
  | { outcome: "invalid_token" }
  | { outcome: "retry" };

export function isAppleSearchAdsStorageKey(key: string) {
  return key === APPLE_SEARCH_ADS_STORAGE_KEY;
}

export function isUsableAttributionToken(token: string) {
  return token.length >= 16 && token.length <= 4096 && !/[\s\u0000-\u001f]/.test(token);
}

export function planAppleSearchAds(
  state: AppleSearchAdsRecord | null,
  now: number,
): AppleSearchAdsPlan {
  if (!state || state.status !== "pending") {
    if (state?.status === "resolved" || state?.status === "unavailable") {
      return { kind: "register", properties: state.properties };
    }
    return { kind: "fetch_token" };
  }

  if (now - state.firstAttemptAt >= GIVE_UP_MS) return { kind: "give_up" };
  if (now - state.tokenFetchedAt >= TOKEN_TTL_MS || !isUsableAttributionToken(state.token)) {
    return { kind: "fetch_token" };
  }
  if (now < state.nextAttemptAt) {
    return { kind: "wait", delayMs: state.nextAttemptAt - now };
  }
  return { kind: "exchange" };
}

export function applyFetchedToken(
  previous: AppleSearchAdsRecord | null,
  now: number,
  token: string,
): AppleSearchAdsRecord {
  if (!isUsableAttributionToken(token)) {
    return unavailableRecord(now, "token_error");
  }

  const continuing = previous?.status === "pending" ? previous : null;
  const immediate =
    continuing != null &&
    (continuing.tokenFetchedAt === 0 || now - continuing.tokenFetchedAt >= TOKEN_TTL_MS);

  return {
    attempts: continuing?.attempts ?? 0,
    firstAttemptAt: continuing?.firstAttemptAt ?? now,
    invalidTokenCount: continuing?.invalidTokenCount ?? 0,
    nextAttemptAt: now + (immediate ? 0 : FIRST_EXCHANGE_DELAY_MS),
    status: "pending",
    token,
    tokenFetchedAt: now,
  };
}

export function applyExchange(
  pending: AppleSearchAdsPending,
  now: number,
  result: AppleSearchAdsExchange,
): AppleSearchAdsRecord {
  if (result.outcome === "resolved") {
    const properties = parseAppleSearchAdsPayload(result.apple);
    if (!properties) return scheduleRetry(pending, now);
    return { captured: false, properties, resolvedAt: now, status: "resolved" };
  }

  if (result.outcome === "invalid_token") {
    const invalidTokenCount = pending.invalidTokenCount + 1;
    if (invalidTokenCount >= 2) return unavailableRecord(now, "invalid_token");
    return {
      ...pending,
      invalidTokenCount,
      nextAttemptAt: now,
      token: "",
      tokenFetchedAt: 0,
    };
  }

  return scheduleRetry(pending, now);
}

export function unavailableRecord(
  now: number,
  reason: AppleSearchAdsUnavailableReason,
): AppleSearchAdsTerminal {
  return {
    captured: false,
    properties: emptyProperties("unavailable", reason),
    resolvedAt: now,
    status: "unavailable",
  };
}

export function parseAppleSearchAdsPayload(value: unknown): AppleSearchAdsProperties | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.attribution !== "boolean") return null;

  if (!record.attribution) return emptyProperties("organic", null);

  return {
    ...emptyProperties("attributed", null),
    asa_ad_group_id: positiveId(record.adGroupId),
    asa_ad_id: positiveId(record.adId),
    asa_campaign_id: positiveId(record.campaignId),
    asa_claim_type: enumValue(record.claimType, ["Click", "Impression"]),
    asa_click_date: appleDate(record.clickDate),
    asa_conversion_type: enumValue(record.conversionType, ["Download", "Redownload"]),
    asa_country_or_region: countryCode(record.countryOrRegion),
    asa_impression_date: appleDate(record.impressionDate),
    asa_keyword_id: positiveId(record.keywordId),
    asa_org_id: positiveId(record.orgId),
  };
}

export function appleSearchAdsAnalyticsProperties(
  properties: AppleSearchAdsProperties,
): AnalyticsProperties {
  return properties;
}

export function parseStoredAppleSearchAds(raw: string | null): AppleSearchAdsRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppleSearchAdsRecord;
    if (parsed?.status === "pending" && typeof parsed.token === "string") return parsed;
    if (
      (parsed?.status === "resolved" || parsed?.status === "unavailable") &&
      parsed.properties?.asa_result
    ) {
      return { ...parsed, captured: parsed.captured === true };
    }
  } catch {
    return null;
  }
  return null;
}

function scheduleRetry(pending: AppleSearchAdsPending, now: number): AppleSearchAdsPending {
  const attempts = pending.attempts + 1;
  return {
    ...pending,
    attempts,
    nextAttemptAt: now + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]!,
  };
}

function emptyProperties(
  result: AppleSearchAdsProperties["asa_result"],
  reason: AppleSearchAdsUnavailableReason | null,
): AppleSearchAdsProperties {
  return {
    asa_ad_group_id: null,
    asa_ad_id: null,
    asa_campaign_id: null,
    asa_claim_type: null,
    asa_click_date: null,
    asa_conversion_type: null,
    asa_country_or_region: null,
    asa_impression_date: null,
    asa_keyword_id: null,
    asa_org_id: null,
    asa_result: result,
    asa_unavailable_reason: reason,
  };
}

function positiveId(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function countryCode(value: unknown) {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) ? value : null;
}

function appleDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(value)
    ? value
    : null;
}
