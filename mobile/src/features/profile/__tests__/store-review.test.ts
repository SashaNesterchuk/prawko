import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";

import {
  ANDROID_PACKAGE_NAME,
  IOS_APP_STORE_ID,
  getStoreWriteReviewUrl,
  openStoreReview,
} from "../store-review";

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const storeReview = StoreReview as jest.Mocked<typeof StoreReview>;
const linking = Linking as jest.Mocked<typeof Linking>;

describe("getStoreWriteReviewUrl", () => {
  it("opens Apple's write-review page for this App Store id", () => {
    expect(getStoreWriteReviewUrl("ios")).toBe(
      `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${IOS_APP_STORE_ID}?action=write-review`
    );
    expect(IOS_APP_STORE_ID).toBe("6795258105");
  });

  it("opens Play Store reviews for the Android package", () => {
    expect(getStoreWriteReviewUrl("android")).toBe(
      `market://details?id=${ANDROID_PACKAGE_NAME}&showAllReviews=true`
    );
  });

  it("returns null on unsupported platforms", () => {
    expect(getStoreWriteReviewUrl("web")).toBeNull();
  });
});

describe("openStoreReview", () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    Platform.OS = "ios";
    linking.openURL.mockResolvedValue(undefined);
    storeReview.isAvailableAsync.mockResolvedValue(false);
    storeReview.requestReview.mockResolvedValue(undefined);
  });

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it("requests the native Apple / Play review sheet when available", async () => {
    storeReview.isAvailableAsync.mockResolvedValue(true);

    await expect(openStoreReview()).resolves.toBe("native");

    expect(storeReview.requestReview).toHaveBeenCalledTimes(1);
    expect(linking.openURL).not.toHaveBeenCalled();
  });

  it("opens the App Store write-review URL when the native sheet is unavailable", async () => {
    await expect(openStoreReview()).resolves.toBe("store");

    expect(storeReview.requestReview).not.toHaveBeenCalled();
    expect(linking.openURL).toHaveBeenCalledWith(getStoreWriteReviewUrl("ios"));
  });

  it("throws when the store URL cannot be opened", async () => {
    linking.openURL.mockRejectedValue(new Error("not allowed"));

    await expect(openStoreReview()).rejects.toThrow("not allowed");
  });

  it("throws when the platform has no store review URL and native review is off", async () => {
    Platform.OS = "web";

    await expect(openStoreReview()).rejects.toMatchObject({
      code: "store_review_unavailable",
    });
    expect(linking.openURL).not.toHaveBeenCalled();
  });
});
