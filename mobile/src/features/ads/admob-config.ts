import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

import { FEATURE_FLAGS } from "@prawko/config";

import { mobileEnv } from "../../config/env";

/**
 * AdMob App IDs:
 *   iOS     ca-app-pub-4994877133367352~1533006266
 *   Android ca-app-pub-4994877133367352~7730175532
 * Product ads use Interstitial units only (not Rewarded).
 * iOS unit:     ios_interstitial_main     ca-app-pub-4994877133367352/9403561308
 * Android unit: android_interstitial_main ca-app-pub-4994877133367352/1525071282
 * __DEV__ and e2e builds always use Google test interstitial IDs.
 */
export function isAdMobEnabled() {
  return FEATURE_FLAGS.enableAds;
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

  if (__DEV__ || mobileEnv.enableE2ETestMode) {
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
