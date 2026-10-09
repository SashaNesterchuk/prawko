/**
 * RevenueCat and the in-app Apple Search Ads check both ask iOS for an
 * AdServices token. RevenueCat goes first so a purchase can leave "No campaign".
 * The local check waits, then still runs if RevenueCat never starts.
 */

export const REVENUECAT_ADSERVICES_HEAD_START_MS = 15_000;
export const ADSERVICES_WAIT_FOR_REVENUECAT_MS = 20_000;

const POLL_MS = 2_000;

let revenueCatCollectionStartedAt: number | null = null;
let localTokenRequestedAt: number | null = null;

export function markRevenueCatAdServicesCollectionStarted(now: number) {
  if (revenueCatCollectionStartedAt == null) {
    revenueCatCollectionStartedAt = now;
  }
}

export function appleSearchAdsTokenFetchDelayMs(now: number) {
  if (localTokenRequestedAt == null) {
    localTokenRequestedAt = now;
  }

  if (revenueCatCollectionStartedAt != null) {
    return Math.max(0, revenueCatCollectionStartedAt + REVENUECAT_ADSERVICES_HEAD_START_MS - now);
  }

  const waited = now - localTokenRequestedAt;
  if (waited >= ADSERVICES_WAIT_FOR_REVENUECAT_MS) return 0;
  return Math.min(POLL_MS, ADSERVICES_WAIT_FOR_REVENUECAT_MS - waited);
}

export function resetAdServicesTokenScheduleForTests() {
  revenueCatCollectionStartedAt = null;
  localTokenRequestedAt = null;
}
