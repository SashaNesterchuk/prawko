import {
  AdEventType,
  getLatestMockInterstitial,
  resetLatestMockInterstitial,
  type MockInterstitial,
} from "./ads-test-utils";

const mockIsAdMobEnabled = jest.fn(() => true);
const mockShouldUseAdMobTestAds = jest.fn(() => true);
const mockGetInterstitialAdUnitId = jest.fn(
  () => "ca-app-pub-3940256099942544/4411468910"
);

const mockMobileAds = {
  setRequestConfiguration: jest.fn(() => Promise.resolve()),
  initialize: jest.fn(() => Promise.resolve()),
};

function mockCreateInterstitial(): MockInterstitial {
  // Local factory so jest.mock factory can reference a `mock*` binding.
  const { createMockInterstitial } = require("./ads-test-utils") as typeof import("./ads-test-utils");
  return createMockInterstitial();
}

jest.mock("../admob-config", () => ({
  isAdMobEnabled: () => mockIsAdMobEnabled(),
  getInterstitialAdUnitId: () => mockGetInterstitialAdUnitId(),
  shouldUseAdMobTestAds: () => mockShouldUseAdMobTestAds(),
}));

jest.mock("react-native-google-mobile-ads", () => ({
  AdEventType: {
    LOADED: "loaded",
    ERROR: "error",
    OPENED: "opened",
    CLOSED: "closed",
  },
  TestIds: {
    INTERSTITIAL: "ca-app-pub-3940256099942544/4411468910",
  },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => mockCreateInterstitial()),
  },
  MobileAds: jest.fn(() => mockMobileAds),
}));

import { AppState } from "react-native";
import {
  ensureInterstitialReady,
  initializeAdMobSdk,
  isInterstitialLoaded,
  isInterstitialShowing,
  resetInterstitialControllerForTests,
  setInterstitialIdleWaitForTests,
  showPreloadedInterstitial,
  startInterstitialPreload,
  stopInterstitialPreload,
  subscribeInterstitialShowing,
  waitForInterstitialLoaded,
  waitForPresentationReady,
  PRESENTATION_SETTLE_MS,
} from "../interstitial-controller";

type MockAppState = typeof AppState & {
  __emit: (state: string) => void;
  __reset: () => void;
};

const mockAppState = AppState as MockAppState;

describe("interstitial-controller", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsAdMobEnabled.mockReturnValue(true);
    mockShouldUseAdMobTestAds.mockReturnValue(true);
    mockGetInterstitialAdUnitId.mockReturnValue(
      "ca-app-pub-3940256099942544/4411468910"
    );
    resetLatestMockInterstitial();
    resetInterstitialControllerForTests();
    setInterstitialIdleWaitForTests(async () => undefined);
    mockAppState.__reset();
    mockMobileAds.setRequestConfiguration.mockClear();
    mockMobileAds.initialize.mockClear();
  });

  afterEach(() => {
    resetInterstitialControllerForTests();
    mockAppState.__reset();
    jest.useRealTimers();
  });

  function loadCurrentAd() {
    const ad = getLatestMockInterstitial();
    expect(ad).toBeTruthy();
    ad!.emit(AdEventType.LOADED);
    expect(isInterstitialLoaded()).toBe(true);
    return ad!;
  }

  it("does not preload when AdMob is disabled", () => {
    mockIsAdMobEnabled.mockReturnValue(false);
    const stop = startInterstitialPreload();

    expect(getLatestMockInterstitial()).toBeNull();
    expect(isInterstitialLoaded()).toBe(false);
    stop();
  });

  it("preloads, marks loaded on LOADED, and clears on stop", () => {
    startInterstitialPreload();
    const ad = getLatestMockInterstitial()!;
    expect(ad.load).toHaveBeenCalledTimes(1);

    ad.emit(AdEventType.LOADED);
    expect(isInterstitialLoaded()).toBe(true);

    stopInterstitialPreload();
    expect(isInterstitialLoaded()).toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("schedules a quiet reload after ERROR", () => {
    startInterstitialPreload();
    const ad = getLatestMockInterstitial()!;
    ad.load.mockClear();

    ad.emit(AdEventType.ERROR, { message: "no fill" });
    expect(isInterstitialLoaded()).toBe(false);

    jest.advanceTimersByTime(750);
    expect(ad.load).toHaveBeenCalledTimes(1);
  });

  it("ensureInterstitialReady returns true once LOADED within budget", async () => {
    startInterstitialPreload();
    const readyPromise = ensureInterstitialReady({
      attempts: 2,
      timeoutMs: 4_000,
    });

    getLatestMockInterstitial()!.emit(AdEventType.LOADED);

    await expect(readyPromise).resolves.toBe(true);
  });

  it("ensureInterstitialReady returns false after attempts timeout", async () => {
    startInterstitialPreload();
    const readyPromise = ensureInterstitialReady({
      attempts: 2,
      timeoutMs: 3_000,
    });

    await jest.advanceTimersByTimeAsync(3_500);
    await expect(readyPromise).resolves.toBe(false);
  });

  it("ensureInterstitialReady short-circuits when already loaded", async () => {
    startInterstitialPreload();
    loadCurrentAd();

    await expect(
      ensureInterstitialReady({ attempts: 1, timeoutMs: 1_500 })
    ).resolves.toBe(true);
  });

  it("ensureInterstitialReady returns false when ads disabled", async () => {
    mockIsAdMobEnabled.mockReturnValue(false);
    await expect(ensureInterstitialReady()).resolves.toBe(false);
  });

  it("waitForInterstitialLoaded delegates to ensure", async () => {
    startInterstitialPreload();
    const promise = waitForInterstitialLoaded(2_000);
    getLatestMockInterstitial()!.emit(AdEventType.LOADED);
    await expect(promise).resolves.toBe(true);
  });

  async function afterIdleWait() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("shows and finishes on CLOSED without leaving isShowing stuck", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    expect(isInterstitialShowing()).toBe(true);
    await afterIdleWait();

    ad.emit(AdEventType.OPENED);
    ad.emit(AdEventType.CLOSED);

    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
    expect(getLatestMockInterstitial()).toBeTruthy();
  });

  it("waits for UI idle before calling native show()", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();
    let releaseIdle: (() => void) | undefined;
    setInterstitialIdleWaitForTests(
      () =>
        new Promise<void>((resolve) => {
          releaseIdle = resolve;
        })
    );

    const showPromise = showPreloadedInterstitial();
    await Promise.resolve();
    expect(isInterstitialShowing()).toBe(true);
    expect(ad.show).not.toHaveBeenCalled();

    releaseIdle!();
    await afterIdleWait();
    expect(ad.show).toHaveBeenCalled();

    ad.emit(AdEventType.OPENED);
    ad.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toBe(true);
  });

  it("waitForPresentationReady resolves after the settle delay", async () => {
    setInterstitialIdleWaitForTests();
    const promise = waitForPresentationReady();
    await jest.advanceTimersByTimeAsync(PRESENTATION_SETTLE_MS);
    await expect(promise).resolves.toBeUndefined();
  });

  it("force-releases UI on open timeout when OPENED never fires", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    expect(ad.show).toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(4_000);
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("force-releases UI on close timeout after OPENED without CLOSED", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    ad.emit(AdEventType.OPENED);

    // Still showing after a normal creative length — must not unlock early.
    await jest.advanceTimersByTimeAsync(30_000);
    expect(isInterstitialShowing()).toBe(true);

    await jest.advanceTimersByTimeAsync(60_000);
    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("does not treat AppState flicker as dismiss after OPENED", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    ad.emit(AdEventType.OPENED);

    mockAppState.__emit("inactive");
    mockAppState.__emit("active");
    await jest.advanceTimersByTimeAsync(500);
    expect(isInterstitialShowing()).toBe(true);

    ad.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("does not finish on AppState active without OPENED — waits for open timeout", async () => {
    startInterstitialPreload();
    loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    mockAppState.__emit("inactive");
    mockAppState.__emit("active");

    await jest.advanceTimersByTimeAsync(400);
    expect(isInterstitialShowing()).toBe(true);

    await jest.advanceTimersByTimeAsync(4_000);
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("returns false on show ERROR and clears showing lock", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    ad.emit(AdEventType.ERROR, { message: "show failed" });

    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("returns false when show() rejects", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();
    ad.show.mockRejectedValueOnce(new Error("native show failed"));

    const showPromise = showPreloadedInterstitial();
    await afterIdleWait();
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("does not tear down a live show when a concurrent show is requested", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const first = showPreloadedInterstitial();
    expect(isInterstitialShowing()).toBe(true);

    await expect(showPreloadedInterstitial()).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(true);

    await afterIdleWait();
    ad.emit(AdEventType.OPENED);
    ad.emit(AdEventType.CLOSED);
    await expect(first).resolves.toBe(true);
  });

  it("notifies showing subscribers when a show starts and finishes", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();
    const listener = jest.fn();
    const stop = subscribeInterstitialShowing(listener);

    const showPromise = showPreloadedInterstitial();
    expect(listener).toHaveBeenCalledWith(true);
    await afterIdleWait();

    ad.emit(AdEventType.OPENED);
    ad.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toBe(true);

    expect(listener).toHaveBeenCalledWith(false);
    stop();
  });

  it("initializeAdMobSdk is a no-op when ads disabled", async () => {
    mockIsAdMobEnabled.mockReturnValue(false);
    await expect(initializeAdMobSdk()).resolves.toBeUndefined();
    expect(mockMobileAds.initialize).not.toHaveBeenCalled();
  });

  it("registers emulator as a test device only for debug/e2e ads", async () => {
    mockShouldUseAdMobTestAds.mockReturnValue(true);
    await initializeAdMobSdk();

    expect(mockMobileAds.setRequestConfiguration).toHaveBeenCalledWith({
      testDeviceIdentifiers: ["EMULATOR"],
    });
    expect(mockMobileAds.initialize).toHaveBeenCalled();
  });

  it("does not register test devices in production", async () => {
    mockShouldUseAdMobTestAds.mockReturnValue(false);
    await initializeAdMobSdk();

    expect(mockMobileAds.setRequestConfiguration).not.toHaveBeenCalled();
    expect(mockMobileAds.initialize).toHaveBeenCalled();
  });

  it("does not fall back to Google sample unit ids when production id is missing", () => {
    mockShouldUseAdMobTestAds.mockReturnValue(false);
    mockGetInterstitialAdUnitId.mockReturnValue("");

    startInterstitialPreload();

    expect(getLatestMockInterstitial()).toBeNull();
    expect(isInterstitialLoaded()).toBe(false);
  });

  it("show aborts when ensure cannot load a creative", async () => {
    mockIsAdMobEnabled.mockReturnValue(true);
    resetInterstitialControllerForTests();
    // No preload — ensure will timeout.
    const showPromise = showPreloadedInterstitial();
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });
});
