import { Platform } from "react-native";

import { FEATURE_FLAGS } from "@prawko/config";

import { mobileEnv } from "../../config/env";

const GOOGLE_TEST_INTERSTITIAL_UNIT_IDS = {
  android: "ca-app-pub-3940256099942544/1033173712",
  ios: "ca-app-pub-3940256099942544/4411468910",
} as const;

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
  if (Platform.OS === "ios") {
    return (
      mobileEnv.admobIosInterstitialUnitId || GOOGLE_TEST_INTERSTITIAL_UNIT_IDS.ios
    );
  }

  if (Platform.OS === "android") {
    return (
      mobileEnv.admobAndroidInterstitialUnitId ||
      GOOGLE_TEST_INTERSTITIAL_UNIT_IDS.android
    );
  }

  return "";
}
