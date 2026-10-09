import { Platform } from "react-native";

jest.mock("../../lib/supabase", () => ({
  getMobileSupabaseClient: jest.fn(),
}));

import { readAppleSearchAdsAttributionToken } from "../../../modules/apple-search-ads/src/AppleSearchAdsModule";
import {
  ADSERVICES_WAIT_FOR_REVENUECAT_MS,
  REVENUECAT_ADSERVICES_HEAD_START_MS,
  appleSearchAdsTokenFetchDelayMs,
  markRevenueCatAdServicesCollectionStarted,
  resetAdServicesTokenScheduleForTests,
} from "../adservices-token-schedule";
import { stepAppleSearchAdsAttribution } from "../apple-search-ads-runner";

jest.mock("../../../modules/apple-search-ads/src/AppleSearchAdsModule", () => ({
  readAppleSearchAdsAttributionToken: jest.fn(),
}));

const NOW = Date.parse("2026-10-08T18:00:00Z");

describe("AdServices token schedule", () => {
  beforeEach(() => {
    resetAdServicesTokenScheduleForTests();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  });

  it("waits for RevenueCat to take the token, then lets the local check run", () => {
    expect(appleSearchAdsTokenFetchDelayMs(NOW)).toBe(2_000);
    markRevenueCatAdServicesCollectionStarted(NOW + 1_000);
    expect(appleSearchAdsTokenFetchDelayMs(NOW + 2_000)).toBe(REVENUECAT_ADSERVICES_HEAD_START_MS - 1_000);
    expect(appleSearchAdsTokenFetchDelayMs(NOW + 1_000 + REVENUECAT_ADSERVICES_HEAD_START_MS)).toBe(0);
  });

  it("does not hold the local check forever when RevenueCat never starts", () => {
    expect(appleSearchAdsTokenFetchDelayMs(NOW)).toBe(2_000);
    expect(appleSearchAdsTokenFetchDelayMs(NOW + ADSERVICES_WAIT_FOR_REVENUECAT_MS)).toBe(0);
  });

  it("does not request a local token while RevenueCat still has the head start", async () => {
    markRevenueCatAdServicesCollectionStarted(NOW);
    const result = await stepAppleSearchAdsAttribution({
      capture: jest.fn(),
      now: () => NOW + 1_000,
      register: jest.fn(async () => undefined),
    });
    expect(result.retryInMs).toBe(REVENUECAT_ADSERVICES_HEAD_START_MS - 1_000);
    expect(readAppleSearchAdsAttributionToken).not.toHaveBeenCalled();
  });
});
