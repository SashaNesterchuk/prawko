import { Platform } from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { mobileEnv } from "../../config/env";
import { isAdMobEnabled, shouldUseAdMobTestAds } from "./admob-config";

export type RewardedExamResult = "earned" | "dismissed" | "failed";

type TrackAd = (event: string, properties?: Record<string, unknown>) => void;

const PLACEMENT = "exam_unlock";

export function getRewardedExamAdUnitId() {
  if (shouldUseAdMobTestAds()) {
    return TestIds.REWARDED;
  }

  if (Platform.OS === "ios") {
    return mobileEnv.admobIosRewardedUnitId;
  }

  if (Platform.OS === "android") {
    return mobileEnv.admobAndroidRewardedUnitId;
  }

  return "";
}

/**
 * Shows a rewarded ad. The exam credit is granted only after EARNED_REWARD.
 * Closing the ad early, a load error, or a missing unit id does not grant it.
 */
export function showRewardedExamUnlock(track: TrackAd): Promise<RewardedExamResult> {
  if (!isAdMobEnabled()) {
    track(ANALYTICS_EVENTS.adFailed.key, {
      placement: PLACEMENT,
      why: "disabled",
    });
    return Promise.resolve("failed");
  }

  const unitId = getRewardedExamAdUnitId();

  track(ANALYTICS_EVENTS.adRequested.key, {
    placement: PLACEMENT,
    trigger: PLACEMENT,
  });

  if (!unitId) {
    track(ANALYTICS_EVENTS.adFailed.key, {
      placement: PLACEMENT,
      why: "missing_unit_id",
    });
    return Promise.resolve("failed");
  }

  return new Promise((resolve) => {
    const rewarded = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    let settled = false;
    const unsubscribers: Array<() => void> = [];

    const finish = (result: RewardedExamResult) => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      resolve(result);
    };

    unsubscribers.push(
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show();
      }),
      rewarded.addAdEventListener(AdEventType.OPENED, () => {
        track(ANALYTICS_EVENTS.adShown.key, { placement: PLACEMENT });
      }),
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
        track(ANALYTICS_EVENTS.adRewardEarned.key, {
          placement: PLACEMENT,
          reward: "exam_attempt",
        });
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        track(ANALYTICS_EVENTS.adDismissed.key, {
          placement: PLACEMENT,
          reward_earned: earned,
        });
        finish(earned ? "earned" : "dismissed");
      }),
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        track(ANALYTICS_EVENTS.adFailed.key, { placement: PLACEMENT });
        finish("failed");
      }),
    );

    void Promise.resolve()
      .then(() => rewarded.load())
      .catch(() => {
        track(ANALYTICS_EVENTS.adFailed.key, { placement: PLACEMENT });
        finish("failed");
      });
  });
}
