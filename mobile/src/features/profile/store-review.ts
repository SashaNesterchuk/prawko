import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";

/** App Store Connect / iTunes ID from `eas.json` submit.production.ios.ascAppId. */
export const IOS_APP_STORE_ID = "6795258105";
export const ANDROID_PACKAGE_NAME = "com.mindjar.prawko";

export type StoreReviewMethod = "native" | "store";

export function getStoreWriteReviewUrl(
  platform: typeof Platform.OS = Platform.OS
) {
  if (platform === "ios") {
    return `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${IOS_APP_STORE_ID}?action=write-review`;
  }

  if (platform === "android") {
    return `market://details?id=${ANDROID_PACKAGE_NAME}&showAllReviews=true`;
  }

  return null;
}

export async function openStoreReview(): Promise<StoreReviewMethod> {
  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
    return "native";
  }

  const url = getStoreWriteReviewUrl();
  if (!url) {
    const error = new Error("store_review_unavailable");
    (error as { code?: string }).code = "store_review_unavailable";
    throw error;
  }

  await Linking.openURL(url);
  return "store";
}
