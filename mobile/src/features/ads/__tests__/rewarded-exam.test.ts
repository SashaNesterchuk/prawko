import { showRewardedExamUnlock, REWARDED_PAID_GRACE_MS } from "../rewarded-exam";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";
import type { AnalyticsEventName, AnalyticsProperties } from "../../../analytics/catalog";

let mockEnabled = false;
let mockTestAds = true;
let mockPaidRegistrationThrows = false;
let mockLoadRejects = false;
let mockCreateThrows = false;
let mockScopeThrows = false;
const mockCreate = jest.fn();
const mockInstances: ReturnType<typeof mockInstance>[] = [];

function mockInstance() {
  const listeners = new Map<string, Set<(event?: unknown) => void>>();
  return {
    load: jest.fn(() => mockLoadRejects ? Promise.reject(new Error("load failed")) : undefined),
    show: jest.fn(),
    addAdEventListener: jest.fn((type: string, listener: (event?: unknown) => void) => {
      if (type === "paid" && mockPaidRegistrationThrows) throw new Error("optional listener");
      const callbacks = listeners.get(type) ?? new Set();
      callbacks.add(listener);
      listeners.set(type, callbacks);
      return () => callbacks.delete(listener);
    }),
    emit(type: string, event?: unknown) { for (const listener of [...(listeners.get(type) ?? [])]) listener(event); },
    count(type: string) { return listeners.get(type)?.size ?? 0; },
  };
}

jest.mock("react-native-google-mobile-ads", () => ({
  AdEventType: { OPENED: "opened", CLOSED: "closed", ERROR: "error", PAID: "paid" },
  RewardedAdEventType: { LOADED: "loaded", EARNED_REWARD: "earned" },
  TestIds: { REWARDED: "rewarded-test-unit" },
  RewardedAd: {
    createForAdRequest: (...args: unknown[]) => {
      mockCreate(...args);
      if (mockCreateThrows) throw new Error("native constructor");
      const ad = mockInstance();
      mockInstances.push(ad);
      return ad;
    },
  },
}));
jest.mock("../admob-config", () => ({
  isAdMobEnabled: () => mockEnabled, shouldUseAdMobTestAds: () => mockTestAds,
}));
jest.mock("../../../config/env", () => ({
  mobileEnv: { admobIosRewardedUnitId: "", admobAndroidRewardedUnitId: "" },
}));
jest.mock("../../../analytics/runtime-context", () => ({
  createAnalyticsId: (prefix: string) => {
    if (mockScopeThrows) throw new Error("optional scope");
    return `${prefix}_test`;
  },
}));

const paid = { value: "0.0025", currency: "USD", precision: 3 };

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("dormant rewarded observations without reward changes", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockEnabled = false;
    mockTestAds = true;
    mockPaidRegistrationThrows = false;
    mockLoadRejects = false;
    mockCreateThrows = false;
    mockScopeThrows = false;
    mockCreate.mockClear();
    mockInstances.length = 0;
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("retains the disabled result and never calls native load/create or invents an impression", async () => {
    const track = jest.fn();
    expect(await showRewardedExamUnlock(track)).toBe("failed");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("ad_failed", expect.objectContaining({
      why: "disabled", ad_format: "rewarded", ad_native_load_observed: false, ad_impression_id: null,
    }));
  });

  it("keeps missing-unit behavior and opportunity distinct from SDK load", async () => {
    mockEnabled = true;
    mockTestAds = false;
    const track = jest.fn();
    expect(await showRewardedExamUnlock(track)).toBe("failed");
    expect(track.mock.calls.map(([name]) => name)).toEqual(["ad_requested", "ad_failed"]);
    expect(track.mock.calls[1][1].why).toBe("missing_unit_id");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("preserves load/show/earned/close and binds request to PAID evidence rather than OPENED", async () => {
    mockEnabled = true;
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    const ad = mockInstances[0];
    expect(mockCreate).toHaveBeenCalledWith("rewarded-test-unit", { requestNonPersonalizedAdsOnly: true });
    expect(ad.load).toHaveBeenCalledTimes(1);
    ad.emit("loaded");
    expect(ad.show).toHaveBeenCalledTimes(1);
    ad.emit("opened");
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_observed")).toHaveLength(0);
    ad.emit("paid", paid);
    ad.emit("earned");
    ad.emit("closed");
    expect(await result).toBe("earned");
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_observed")).toHaveLength(1);
    expect(track).toHaveBeenCalledWith("ad_impression_revenue", expect.objectContaining({
      ad_request_id: "ad_request_test", ad_impression_id: "ad_impression_test",
      ad_format: "rewarded", revenue: 0.0025, currency: "USD", revenue_precision: "precise",
      ad_paid_basis: "sdk_paid_value", ad_native_terminal_observed: false,
    }));
    for (const [name, props] of track.mock.calls) {
      expect(validateAnalyticsPayload(name as AnalyticsEventName, props as AnalyticsProperties).analytics_payload_valid).toBe(true);
    }
  });

  it("resolves the product promise immediately while keeping only the optional PAID listener briefly", async () => {
    mockEnabled = true;
    const track = jest.fn();
    const grant = jest.fn();
    const result = showRewardedExamUnlock(track).then((outcome) => {
      if (outcome === "earned") grant();
      return outcome;
    });
    await flush();
    const ad = mockInstances[0];
    ad.emit("earned");
    ad.emit("closed");
    expect(await result).toBe("earned");
    expect(grant).toHaveBeenCalledTimes(1);
    expect(ad.count("earned")).toBe(0);
    expect(ad.count("paid")).toBe(1);
    ad.emit("paid", paid);
    expect(track).toHaveBeenCalledWith("ad_impression_revenue", expect.objectContaining({ ad_native_terminal_observed: true }));
    jest.advanceTimersByTime(REWARDED_PAID_GRACE_MS);
    expect(ad.count("paid")).toBe(0);
    ad.emit("earned");
    ad.emit("paid", paid);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_revenue")).toHaveLength(1);
  });

  it("keeps paid duplicates inspectable but adds only one impression observation", async () => {
    mockEnabled = true;
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    const ad = mockInstances[0];
    ad.emit("paid", paid);
    ad.emit("paid", paid);
    ad.emit("paid", { ...paid, value: "0.005" });
    ad.emit("closed");
    expect(await result).toBe("dismissed");
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_observed")).toHaveLength(1);
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_revenue").map(([, props]) => props.ad_paid_callback_sequence))
      .toEqual([1, 2, 3]);
  });

  it.each([false, true])("does not let malformed PAID data change an earned result (listener failure=%s)", async (listenerFailure) => {
    mockEnabled = true;
    mockPaidRegistrationThrows = listenerFailure;
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    const ad = mockInstances[0];
    ad.emit("paid", { value: "private invalid payload" });
    ad.emit("earned");
    ad.emit("closed");
    expect(await result).toBe("earned");
    expect(track.mock.calls.filter(([name]) => name === "ad_observation_failed")).toHaveLength(1);
    expect(track.mock.calls.filter(([name]) => name === "ad_impression_revenue")).toHaveLength(0);
    expect(JSON.stringify(track.mock.calls)).not.toContain("private invalid payload");
  });

  it.each(["native_error", "load_rejection"])("retains the %s failed result without rewards", async (reason) => {
    mockEnabled = true;
    mockLoadRejects = reason === "load_rejection";
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    if (reason === "native_error") mockInstances[0].emit("error");
    expect(await result).toBe("failed");
    expect(track.mock.calls.filter(([name]) => name === "ad_reward_earned")).toHaveLength(0);
  });

  it("preserves native constructor rejection instead of rewriting product errors", async () => {
    mockEnabled = true;
    mockCreateThrows = true;
    await expect(showRewardedExamUnlock(jest.fn())).rejects.toThrow("native constructor");
  });

  it.each([
    ["googleMobileAds/error-code-no-fill", "no_fill"],
    ["googleMobileAds/error-code-network-error", "network"],
    ["googleMobileAds/invalid_request", "invalid_request"],
    ["internal-error", "internal"],
    ["unknown-secret-code", "sdk_unspecified"],
  ])("normalizes SDK failure %s without exporting its code or changing the failed result", async (code, category) => {
    mockEnabled = true;
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    mockInstances[0].emit("error", { code, message: "private message" });
    expect(await result).toBe("failed");
    const failure = track.mock.calls.find(([name]) => name === "ad_failed")?.[1];
    expect(failure).toMatchObject({ ad_failure_category: category, ad_failure_stage: "sdk_event" });
    expect(validateAnalyticsPayload("ad_failed", failure).analytics_payload_valid).toBe(true);
    expect(JSON.stringify(track.mock.calls)).not.toContain(code);
    expect(JSON.stringify(track.mock.calls)).not.toContain("private message");
  });

  it("contains scope/capture failures without delaying or suppressing an earned result", async () => {
    mockEnabled = true;
    mockScopeThrows = true;
    const result = showRewardedExamUnlock(() => { throw new Error("optional capture"); });
    await flush();
    const ad = mockInstances[0];
    ad.emit("opened");
    ad.emit("paid", paid);
    ad.emit("earned");
    ad.emit("closed");
    expect(await result).toBe("earned");
    expect(ad.load).toHaveBeenCalledTimes(1);
  });

  it("keeps failed observation scopes capturable and invalid without changing the earned result", async () => {
    mockEnabled = true;
    mockScopeThrows = true;
    const track = jest.fn();
    const result = showRewardedExamUnlock(track);
    await flush();
    const ad = mockInstances[0];
    ad.emit("paid", paid);
    ad.emit("earned");
    ad.emit("closed");
    expect(await result).toBe("earned");
    expect(ad.load).toHaveBeenCalledTimes(1);
    for (const name of ["ad_native_request_started", "ad_impression_observed"] as const) {
      const payload = track.mock.calls.find(([event]) => event === name)?.[1];
      expect(payload).toMatchObject({ ad_request_id: null, ad_impression_id: null });
      expect(validateAnalyticsPayload(name, payload)).toMatchObject({
        analytics_payload_contract_version: 2, analytics_payload_valid: false,
        analytics_payload_invalid_keys: "ad_request_id,ad_impression_id",
      });
    }
    expect(track.mock.calls.filter(([event]) => event === "ad_reward_earned")).toHaveLength(1);
  });
});
