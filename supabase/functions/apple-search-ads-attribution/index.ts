const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
} as const;

const APPLE_ATTRIBUTION_URL = "https://api-adservices.apple.com/api/v1/";
const MAX_TOKEN_LENGTH = 4096;
const MAX_APPLE_BODY_LENGTH = 8000;

type ExchangeOutcome =
  | { outcome: "resolved"; payload: Record<string, unknown> }
  | { outcome: "retry" }
  | { outcome: "invalid_token" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json({ outcome: "invalid_token" }, 405);
  }

  let token = "";
  try {
    const body = await request.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return json({ outcome: "invalid_token" }, 200);
  }

  if (!isUsableToken(token)) {
    return json({ outcome: "invalid_token" }, 200);
  }

  try {
    const apple = await fetch(APPLE_ATTRIBUTION_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: token,
      signal: AbortSignal.timeout(10_000),
    });

    if (apple.status === 400) {
      return json({ outcome: "invalid_token" }, 200);
    }

    if (apple.status === 404 || apple.status >= 500) {
      return json({ outcome: "retry" }, 200);
    }

    if (!apple.ok) {
      return json({ outcome: "retry" }, 200);
    }

    const text = await apple.text();
    if (text.length > MAX_APPLE_BODY_LENGTH) {
      return json({ outcome: "retry" }, 200);
    }

    const parsed = JSON.parse(text) as unknown;
    const payload = allowApplePayload(parsed);
    if (!payload) {
      return json({ outcome: "retry" }, 200);
    }

    return json({ outcome: "resolved", payload }, 200);
  } catch {
    return json({ outcome: "retry" }, 200);
  }
});

function json(body: ExchangeOutcome, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function isUsableToken(token: string) {
  return (
    token.length >= 16 &&
    token.length <= MAX_TOKEN_LENGTH &&
    !/[\s\u0000-\u001f]/.test(token)
  );
}

const APPLE_KEYS = [
  "adGroupId",
  "adId",
  "attribution",
  "campaignId",
  "claimType",
  "clickDate",
  "conversionType",
  "countryOrRegion",
  "impressionDate",
  "keywordId",
  "orgId",
] as const;

function allowApplePayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.attribution !== "boolean") return null;

  const payload: Record<string, unknown> = {};
  for (const key of APPLE_KEYS) {
    if (key in record) payload[key] = record[key];
  }
  return payload;
}
