const mockFeatureFlags = { enableAds: true };
const mockMobileEnv = {
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
  });

  it("reports enabled from FEATURE_FLAGS.enableAds", async () => {
    const { isAdMobEnabled } = await loadConfigForOs("ios");
    expect(isAdMobEnabled()).toBe(true);

    mockFeatureFlags.enableAds = false;
    expect(isAdMobEnabled()).toBe(false);
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

  it("uses production iOS unit ids when not in __DEV__", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { getInterstitialAdUnitId } = await loadConfigForOs("ios");
    expect(getInterstitialAdUnitId()).toBe("ios-unit");
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
