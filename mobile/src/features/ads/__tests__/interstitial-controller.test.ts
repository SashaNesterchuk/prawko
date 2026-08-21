import {
  AdEventType,
  getLatestMockInterstitial,
  resetLatestMockInterstitial,
  type MockInterstitial,
} from "./ads-test-utils";

const mockIsAdMobEnabled = jest.fn(() => true);
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
  showPreloadedInterstitial,
  startInterstitialPreload,
  stopInterstitialPreload,
  subscribeInterstitialShowing,
  waitForInterstitialLoaded,
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
    mockGetInterstitialAdUnitId.mockReturnValue(
      "ca-app-pub-3940256099942544/4411468910"
    );
    resetLatestMockInterstitial();
    resetInterstitialControllerForTests();
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

  it("shows and finishes on CLOSED without leaving isShowing stuck", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    expect(isInterstitialShowing()).toBe(true);

    ad.emit(AdEventType.OPENED);
    ad.emit(AdEventType.CLOSED);

    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
    expect(getLatestMockInterstitial()).toBeTruthy();
  });

  it("force-releases UI on open timeout when OPENED never fires", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    expect(ad.show).toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(4_000);
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("force-releases UI on close timeout after OPENED without CLOSED", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    ad.emit(AdEventType.OPENED);

    // Still showing after a normal creative length — must not unlock early.
    await jest.advanceTimersByTimeAsync(30_000);
    expect(isInterstitialShowing()).toBe(true);

    await jest.advanceTimersByTimeAsync(60_000);
    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("releases on AppState active after OPENED only if app left foreground", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    ad.emit(AdEventType.OPENED);

    // Spurious active without inactive/background must not finish the show.
    mockAppState.__emit("active");
    await jest.advanceTimersByTimeAsync(250);
    expect(isInterstitialShowing()).toBe(true);

    mockAppState.__emit("inactive");
    mockAppState.__emit("active");
    await jest.advanceTimersByTimeAsync(250);
    await expect(showPromise).resolves.toBe(true);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("releases on AppState active without OPENED (flash then vanish)", async () => {
    startInterstitialPreload();
    loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    mockAppState.__emit("active");

    await jest.advanceTimersByTimeAsync(400);
    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("returns false on show ERROR and clears showing lock", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();

    const showPromise = showPreloadedInterstitial();
    ad.emit(AdEventType.ERROR, { message: "show failed" });

    await expect(showPromise).resolves.toBe(false);
    expect(isInterstitialShowing()).toBe(false);
  });

  it("returns false when show() rejects", async () => {
    startInterstitialPreload();
    const ad = loadCurrentAd();
    ad.show.mockRejectedValueOnce(new Error("native show failed"));

    const showPromise = showPreloadedInterstitial();
    await Promise.resolve();
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
