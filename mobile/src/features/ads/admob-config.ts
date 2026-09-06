import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

import { FEATURE_FLAGS } from "@prawko/config";

import { mobileEnv } from "../../config/env";
import { isE2EAdsEnabled } from "../../testing/e2e/ads-flag";

/**
 * AdMob App IDs:
 *   iOS     ca-app-pub-4994877133367352~1533006266
 *   Android ca-app-pub-4994877133367352~7730175532
 * Product ads use Interstitial units only (not Rewarded).
 * iOS unit:     ios_interstitial_main     ca-app-pub-4994877133367352/9403561308
 * Android unit: android_interstitial_main ca-app-pub-4994877133367352/1525071282
 * Dev and e2e use Google sample interstitial IDs. Production never registers
 * test devices. E2E builds skip AdMob unless bootstrap sets enableAds=true.
 */
export function isAdMobEnabled() {
  if (mobileEnv.enableE2ETestMode) {
    return FEATURE_FLAGS.enableAds && isE2EAdsEnabled();
  }

  return FEATURE_FLAGS.enableAds;
}

/** Sample unit IDs + emulator test-device flag. Never true in store builds. */
export function shouldUseAdMobTestAds() {
  return __DEV__ || mobileEnv.enableE2ETestMode;
}

export function getAdMobAppId() {
  if (Platform.OS === "ios") {
    return mobileEnv.admobIosAppId;
  }

  if (Platform.OS === "android") {
    return mobileEnv.admobAndroidAppId;
  }

  return "";
}

export function getInterstitialAdUnitId() {
  // Explicit Google sample IDs — more reliable than relying on TestIds shape.
  const googleTestInterstitial =
    Platform.OS === "ios"
      ? "ca-app-pub-3940256099942544/4411468910"
      : "ca-app-pub-3940256099942544/1033173712";

  if (shouldUseAdMobTestAds()) {
    return TestIds.INTERSTITIAL || googleTestInterstitial;
  }

  if (Platform.OS === "ios") {
    return mobileEnv.admobIosInterstitialUnitId;
  }

  if (Platform.OS === "android") {
    return mobileEnv.admobAndroidInterstitialUnitId;
  }

  return "";
}
