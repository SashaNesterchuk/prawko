import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

import { FEATURE_FLAGS } from "@prawko/config";

import { mobileEnv } from "../../config/env";

/**
 * AdMob App ID (iOS): ca-app-pub-4994877133367352~1533006266
 * Product ads use Interstitial units only (not Rewarded).
 * Create `ios_interstitial_main` in AdMob and set EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID.
 * In __DEV__ we always use Google test interstitial IDs.
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

  if (__DEV__) {
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
