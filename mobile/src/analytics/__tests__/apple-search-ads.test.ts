import {
  applyExchange,
  applyFetchedToken,
  isAppleSearchAdsStorageKey,
  parseAppleSearchAdsPayload,
  parseStoredAppleSearchAds,
  planAppleSearchAds,
  type AppleSearchAdsPending,
} from "../apple-search-ads";

const NOW = Date.parse("2026-10-06T18:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const attributed = {
  attribution: true,
  orgId: 100,
  campaignId: 2144614494,
  adGroupId: 200,
  keywordId: 300,
  adId: 400,
  conversionType: "Download",
  claimType: "Click",
  countryOrRegion: "PL",
  clickDate: "2026-10-06T17:17Z",
};

function pending(overrides: Partial<AppleSearchAdsPending> = {}): AppleSearchAdsPending {
  return {
    attempts: 0,
    firstAttemptAt: NOW,
    invalidTokenCount: 0,
    nextAttemptAt: NOW,
    status: "pending",
    token: "a".repeat(32),
    tokenFetchedAt: NOW,
    ...overrides,
  };
}

describe("apple search ads attribution", () => {
  it("keeps the install check outside a progress reset", () => {
    expect(isAppleSearchAdsStorageKey("prawko.apple-search-ads.v1")).toBe(true);
    expect(isAppleSearchAdsStorageKey("prawko.checkout.v1:ios:user")).toBe(false);
  });

  it("keeps campaign and keyword ids and drops a search-match keyword", () => {
    expect(parseAppleSearchAdsPayload(attributed)).toMatchObject({
      asa_result: "attributed",
      asa_campaign_id: 2144614494,
      asa_keyword_id: 300,
      asa_ad_group_id: 200,
      asa_country_or_region: "PL",
      asa_click_date: "2026-10-06T17:17Z",
      asa_conversion_type: "Download",
      asa_unavailable_reason: null,
    });
    expect(parseAppleSearchAdsPayload({ ...attributed, keywordId: 0 })?.asa_keyword_id).toBeNull();
    expect(
      parseAppleSearchAdsPayload({ ...attributed, clickDate: "2026-10-06T17:17:04Z" })?.asa_click_date,
    ).toBe("2026-10-06T17:17:04Z");
  });

  it("treats a completed negative check as organic and ignores leftover ids", () => {
    expect(parseAppleSearchAdsPayload({ attribution: false, campaignId: 2144614494 })).toEqual(
      expect.objectContaining({
        asa_result: "organic",
        asa_campaign_id: null,
        asa_keyword_id: null,
      }),
    );
  });

  it("rejects names, tokens, and free text instead of storing them as ids", () => {
    expect(parseAppleSearchAdsPayload({ attribution: "true", campaignId: 1 })).toBeNull();
    expect(parseAppleSearchAdsPayload({ attribution: true, campaignId: "prawo jazdy" })).toMatchObject({
      asa_result: "attributed",
      asa_campaign_id: null,
    });
    expect(parseAppleSearchAdsPayload({ ...attributed, countryOrRegion: "Poland" })?.asa_country_or_region).toBeNull();
    const resolved = applyExchange(pending(), NOW, { outcome: "resolved", apple: attributed });
    expect(resolved.status === "resolved" && "token" in resolved).toBe(false);
    expect(JSON.stringify(resolved)).not.toContain("a".repeat(32));
  });

  it("waits before the first exchange, retries 404, and refreshes an expired token", () => {
    const first = applyFetchedToken(null, NOW, "b".repeat(24));
    expect(first.status).toBe("pending");
    if (first.status !== "pending") return;
    expect(planAppleSearchAds(first, NOW)).toEqual({ kind: "wait", delayMs: 5_000 });
    expect(planAppleSearchAds(first, NOW + 5_000)).toEqual({ kind: "exchange" });

    const retried = applyExchange(first, NOW + 5_000, { outcome: "retry" });
    expect(retried.status).toBe("pending");
    if (retried.status !== "pending") return;
    expect(retried.attempts).toBe(1);
    expect(planAppleSearchAds(retried, NOW + 5_000)).toEqual({ kind: "wait", delayMs: 5_000 });

    const expired = pending({ tokenFetchedAt: NOW - DAY });
    expect(planAppleSearchAds(expired, NOW)).toEqual({ kind: "fetch_token" });
    const refreshed = applyFetchedToken(expired, NOW, "c".repeat(24));
    expect(refreshed.status).toBe("pending");
    if (refreshed.status !== "pending") return;
    expect(refreshed.nextAttemptAt).toBe(NOW);
  });

  it("stops after two invalid tokens and after three days without a response", () => {
    const once = applyExchange(pending(), NOW, { outcome: "invalid_token" });
    expect(once.status).toBe("pending");
    if (once.status !== "pending") return;
    expect(planAppleSearchAds(once, NOW)).toEqual({ kind: "fetch_token" });

    const refreshed = applyFetchedToken(once, NOW, "d".repeat(24));
    if (refreshed.status !== "pending") throw new Error("expected a refreshed token");
    const twice = applyExchange(refreshed, NOW, { outcome: "invalid_token" });
    expect(twice).toMatchObject({
      status: "unavailable",
      properties: { asa_result: "unavailable", asa_unavailable_reason: "invalid_token" },
    });

    expect(planAppleSearchAds(pending({ firstAttemptAt: NOW - 3 * DAY }), NOW)).toEqual({
      kind: "give_up",
    });
  });

  it("reads a stored result and does not revive a token from it", () => {
    const raw = JSON.stringify({
      status: "resolved",
      resolvedAt: NOW,
      properties: parseAppleSearchAdsPayload(attributed),
    });
    const stored = parseStoredAppleSearchAds(raw);
    expect(stored?.status).toBe("resolved");
    expect(stored && "token" in stored).toBe(false);
    expect(stored?.status === "resolved" && stored.captured).toBe(false);
    expect(planAppleSearchAds(stored, NOW).kind).toBe("register");
  });
});
