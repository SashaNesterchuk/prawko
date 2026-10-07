import { Platform } from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type PaidEvent,
} from "react-native-google-mobile-ads";

import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsEventPayloads } from "../../analytics/catalog";
import type { RewardedObservationPayloads, RewardedObservationScope } from "../../analytics/observation-payloads";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import { createAnalyticsId } from "../../analytics/runtime-context";
import { mobileEnv } from "../../config/env";
import { isAdMobEnabled, shouldUseAdMobTestAds } from "./admob-config";
import { buildAdRevenueEvent, buildAdImpressionRevenueProperties } from "./ad-analytics";

export type RewardedExamResult = "earned" | "dismissed" | "failed";

type TrackAd = AnalyticsTrack;

const PLACEMENT = "exam_unlock";
export const REWARDED_PAID_GRACE_MS = 2_000;

function failureCategory(error: unknown) {
  try {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (typeof code !== "string") return "sdk_unspecified";
    if (/no[-_]fill/i.test(code)) return "no_fill";
    if (/network/i.test(code)) return "network";
    if (/invalid[-_]request/i.test(code)) return "invalid_request";
    if (/internal/i.test(code)) return "internal";
  } catch { /* Error observations must not alter the SDK failure outcome. */ }
  return "sdk_unspecified";
}

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
  function observationId(prefix: string) {
    try { return createAnalyticsId(prefix); } catch { return null; }
  }
  const requestId = observationId("ad_request");
  let impressionId: string | null = null;
  let nativeLoadObserved = false;
  let openedObserved = false;
  let unitBasis: RewardedObservationScope["ad_unit_basis"] = "not_resolved";
  const properties = () => ({
    ad_observation_version: 1, ad_format: "rewarded", ad_request_id: requestId,
    ad_impression_id: impressionId, ad_unit_basis: unitBasis,
    ad_native_load_observed: nativeLoadObserved, ad_opened_observed: openedObserved,
    placement: PLACEMENT,
  });
  const emit = <EventName extends AnalyticsEventName>(
    event: EventName,
    payload: EventName extends keyof RewardedObservationPayloads
      ? Omit<RewardedObservationPayloads[EventName], keyof RewardedObservationScope>
      : AnalyticsEventPayloads[EventName],
  ) => {
    try {
      // The scope factory supplies IDs; typed extras preserve each new observation's meaning.
      track(event, { ...properties(), ...payload } as AnalyticsEventPayloads[EventName]);
    } catch {
      // Telemetry cannot prevent SDK callbacks, promise resolution or earning credit.
    }
  };
  if (!isAdMobEnabled()) {
    emit(ANALYTICS_EVENTS.adFailed.key, {
      placement: PLACEMENT,
      why: "disabled",
      ad_failure_category: "disabled", ad_failure_stage: "policy",
    });
    return Promise.resolve("failed");
  }

  const unitId = getRewardedExamAdUnitId();
  unitBasis = unitId === TestIds.REWARDED ? "test_unit" : unitId ? "configured_unit" : "not_resolved";

  emit(ANALYTICS_EVENTS.adRequested.key, {
    placement: PLACEMENT,
    trigger: PLACEMENT,
  });

  if (!unitId) {
    emit(ANALYTICS_EVENTS.adFailed.key, {
      placement: PLACEMENT,
      why: "missing_unit_id",
      ad_failure_category: "missing_unit_id", ad_failure_stage: "configuration",
    });
    return Promise.resolve("failed");
  }

  return new Promise((resolve) => {
    const rewarded = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    impressionId = observationId("ad_impression");
    let earned = false;
    let settled = false;
    const unsubscribers: Array<() => void> = [];
    let detachPaid: (() => void) | null = null;
    let impressionObserved = false;
    let paidSequence = 0;
    function detachPaidSafely() {
      try { detachPaid?.(); } catch { /* Optional observer cleanup is best effort. */ }
      detachPaid = null;
    }

    const finish = (result: RewardedExamResult) => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      resolve(result);
      // Keep only the optional PAID listener; the product promise still resolves immediately.
      try { setTimeout(detachPaidSafely, REWARDED_PAID_GRACE_MS); } catch { detachPaidSafely(); }
    };

    unsubscribers.push(
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show();
      }),
      rewarded.addAdEventListener(AdEventType.OPENED, () => {
        openedObserved = true;
        emit(ANALYTICS_EVENTS.adShown.key, { placement: PLACEMENT });
      }),
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
        emit(ANALYTICS_EVENTS.adRewardEarned.key, {
          placement: PLACEMENT,
          reward: "exam_attempt",
        });
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        emit(ANALYTICS_EVENTS.adDismissed.key, {
          placement: PLACEMENT,
          reward_earned: earned,
        });
        finish(earned ? "earned" : "dismissed");
      }),
      rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        emit(ANALYTICS_EVENTS.adFailed.key, {
          placement: PLACEMENT, ad_failure_category: failureCategory(error), ad_failure_stage: "sdk_event",
        });
        finish("failed");
      }),
    );

    try {
      const addPaid = rewarded.addAdEventListener.bind(rewarded) as unknown as (
        type: AdEventType.PAID, listener: (event: PaidEvent) => void
      ) => () => void;
      detachPaid = addPaid(AdEventType.PAID, (event) => {
        try {
          const revenue = buildAdRevenueEvent({ adFormat: "rewarded", adUnitId: unitId, paid: event, placement: PLACEMENT });
          if (!revenue) {
            emit(ANALYTICS_EVENTS.adObservationFailed.key, { observation_stage: "paid_payload", why: "unparseable_revenue" });
            return;
          }
          if (!impressionObserved) {
            impressionObserved = true;
            emit(ANALYTICS_EVENTS.adImpressionObserved.key, {
              ad_impression_basis: "sdk_paid_callback", ad_native_terminal_observed: settled,
            });
          }
          emit(ANALYTICS_EVENTS.adImpressionRevenue.key, {
            ...buildAdImpressionRevenueProperties(revenue),
            ad_paid_callback_sequence: ++paidSequence,
            ad_paid_basis: "sdk_paid_value", ad_native_terminal_observed: settled,
          });
        } catch {
          emit(ANALYTICS_EVENTS.adObservationFailed.key, { observation_stage: "paid_payload", why: "observation_failed" });
        }
      });
    } catch {
      emit(ANALYTICS_EVENTS.adObservationFailed.key, { observation_stage: "paid_listener_registration", why: "observation_failed" });
    }

    void Promise.resolve()
      .then(() => {
        nativeLoadObserved = true;
        emit(ANALYTICS_EVENTS.adNativeRequestStarted.key, { ad_request_basis: "sdk_load_invoked" });
        return rewarded.load();
      })
      .catch((error) => {
        emit(ANALYTICS_EVENTS.adFailed.key, {
          placement: PLACEMENT, ad_failure_category: failureCategory(error), ad_failure_stage: "load_invocation",
        });
        finish("failed");
      });
  });
}
