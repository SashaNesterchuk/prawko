const mockFeatureFlags = { enableAds: true };
const mockMobileEnv = {
  enableE2ETestMode: false,
  admobIosAppId: "ios-app-id",
  admobAndroidAppId: "android-app-id",
  admobIosInterstitialUnitId: "ios-unit",
  admobAndroidInterstitialUnitId: "android-unit",
};

jest.mock("@prawko/config", () => ({
  FEATURE_FLAGS: mockFeatureFlags,
}));

jest.mock("../../../config/env", () => ({
  mobileEnv: mockMobileEnv,
}));

jest.mock("react-native-google-mobile-ads", () => ({
  TestIds: {
    INTERSTITIAL: "ca-app-pub-3940256099942544/4411468910",
  },
}));

describe("admob-config", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  async function loadConfigForOs(os: string) {
    jest.resetModules();
    const rn = require("react-native") as { Platform: { OS: string } };
    rn.Platform.OS = os;
    return import("../admob-config");
  }

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    mockFeatureFlags.enableAds = true;
    mockMobileEnv.enableE2ETestMode = false;
  });

  it("reports enabled from FEATURE_FLAGS.enableAds", async () => {
    const { isAdMobEnabled } = await loadConfigForOs("ios");
    expect(isAdMobEnabled()).toBe(true);

    mockFeatureFlags.enableAds = false;
    expect(isAdMobEnabled()).toBe(false);
  });

  it("disables AdMob in e2e test builds", async () => {
    mockMobileEnv.enableE2ETestMode = true;
    const { isAdMobEnabled } = await loadConfigForOs("ios");
    expect(isAdMobEnabled()).toBe(false);
  });

  it("enables AdMob in e2e when bootstrap opts into ads", async () => {
    mockMobileEnv.enableE2ETestMode = true;
    jest.resetModules();
    const rn = require("react-native") as { Platform: { OS: string } };
    rn.Platform.OS = "ios";
    const { setE2EAdsEnabled } = await import("../../../testing/e2e/ads-flag");
    setE2EAdsEnabled(true);
    const { isAdMobEnabled } = await import("../admob-config");
    expect(isAdMobEnabled()).toBe(true);
  });

  it("returns iOS app id", async () => {
    const { getAdMobAppId } = await loadConfigForOs("ios");
    expect(getAdMobAppId()).toBe("ios-app-id");
  });

  it("returns Android app id", async () => {
    const { getAdMobAppId } = await loadConfigForOs("android");
    expect(getAdMobAppId()).toBe("android-app-id");
  });

  it("returns empty app id on unsupported platforms", async () => {
    const { getAdMobAppId } = await loadConfigForOs("web");
    expect(getAdMobAppId()).toBe("");
  });

  it("uses Google test interstitial ids in __DEV__", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const { getInterstitialAdUnitId } = await loadConfigForOs("ios");
    expect(getInterstitialAdUnitId()).toBe(
      "ca-app-pub-3940256099942544/4411468910"
    );
  });

  it("uses Google test interstitial ids in e2e builds", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockMobileEnv.enableE2ETestMode = true;
    const { getInterstitialAdUnitId } = await loadConfigForOs("android");
    expect(getInterstitialAdUnitId()).toBe(
      "ca-app-pub-3940256099942544/4411468910"
    );
  });

  it("uses production iOS unit ids when not in __DEV__", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { getInterstitialAdUnitId, shouldUseAdMobTestAds } =
      await loadConfigForOs("ios");
    expect(shouldUseAdMobTestAds()).toBe(false);
    expect(getInterstitialAdUnitId()).toBe("ios-unit");
  });

  it("flags test ads in __DEV__ and e2e", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const { shouldUseAdMobTestAds: inDev } = await loadConfigForOs("ios");
    expect(inDev()).toBe(true);

    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockMobileEnv.enableE2ETestMode = true;
    const { shouldUseAdMobTestAds: inE2e } = await loadConfigForOs("ios");
    expect(inE2e()).toBe(true);
  });

  it("uses production Android unit ids when not in __DEV__", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { getInterstitialAdUnitId } = await loadConfigForOs("android");
    expect(getInterstitialAdUnitId()).toBe("android-unit");
  });

  it("returns empty interstitial unit on unsupported platforms outside __DEV__", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { getInterstitialAdUnitId } = await loadConfigForOs("web");
    expect(getInterstitialAdUnitId()).toBe("");
  });
});
