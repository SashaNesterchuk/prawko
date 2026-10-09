import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import {
  appleSearchAdsTokenFetchDelayMs,
  resetAdServicesTokenScheduleForTests,
} from "../../../analytics/adservices-token-schedule";
import { mobileEnv } from "../../../config/env";
import { ensureRevenueCatReady, resetRevenueCatClientForTests } from "../revenuecat";

jest.mock("../../../config/env", () => ({
  mobileEnv: {
    revenueCatAppleApiKey: "synthetic-ios-key",
    revenueCatGoogleApiKey: "synthetic-android-key",
    revenueCatEnableInDev: true,
    enableE2ETestMode: false,
  },
}));
jest.mock("../../../lib/auth-storage", () => ({ secureSessionStorage: {} }));
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    enableAdServicesAttributionTokenCollection: jest.fn(async () => undefined),
    LOG_LEVEL: { DEBUG: "DEBUG", WARN: "WARN" },
    setLogLevel: jest.fn(),
  },
}));
jest.mock("react-native-purchases-ui", () => ({ PAYWALL_RESULT: {} }));

describe("RevenueCat AdServices collection", () => {
  beforeEach(() => {
    resetRevenueCatClientForTests();
    resetAdServicesTokenScheduleForTests();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    mobileEnv.revenueCatAppleApiKey = "synthetic-ios-key";
    mobileEnv.revenueCatEnableInDev = true;
    jest.mocked(Purchases.enableAdServicesAttributionTokenCollection).mockResolvedValue(undefined);
  });

  it("enables collection after configure and keeps the same app user id", async () => {
    const order: string[] = [];
    jest.mocked(Purchases.configure).mockImplementation(() => {
      order.push("configure");
    });
    jest.mocked(Purchases.enableAdServicesAttributionTokenCollection).mockImplementation(async () => {
      order.push("enable");
    });

    const started = Date.now();
    await expect(ensureRevenueCatReady("usr_install")).resolves.toBe(true);
    expect(order).toEqual(["configure", "enable"]);
    expect(Purchases.configure).toHaveBeenCalledWith({
      apiKey: "synthetic-ios-key",
      appUserID: "usr_install",
    });
    expect(Purchases.logIn).not.toHaveBeenCalled();
    expect(appleSearchAdsTokenFetchDelayMs(started + 10_000)).toBeGreaterThan(4_000);

    await ensureRevenueCatReady("usr_install");
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);

    await ensureRevenueCatReady("usr_other");
    expect(Purchases.logIn).toHaveBeenCalledWith("usr_other");
    expect(Purchases.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
  });

  it("keeps billing ready when attribution collection fails and retries it", async () => {
    jest.mocked(Purchases.enableAdServicesAttributionTokenCollection)
      .mockRejectedValueOnce(new Error("token unavailable"))
      .mockResolvedValueOnce(undefined);

    await expect(ensureRevenueCatReady("usr_install")).resolves.toBe(true);
    await expect(ensureRevenueCatReady("usr_install")).resolves.toBe(true);
    expect(Purchases.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(2);
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it("does not collect an Apple token on Android", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    await expect(ensureRevenueCatReady("usr_install")).resolves.toBe(true);
    expect(Purchases.configure).toHaveBeenCalledWith({
      apiKey: "synthetic-android-key",
      appUserID: "usr_install",
    });
    expect(Purchases.enableAdServicesAttributionTokenCollection).not.toHaveBeenCalled();
  });
});