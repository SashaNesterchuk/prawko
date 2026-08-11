import { AppState, type NativeEventSubscription } from "react-native";
import {
  AdEventType,
  InterstitialAd,
  MobileAds,
  TestIds,
} from "react-native-google-mobile-ads";

import { getInterstitialAdUnitId, isAdMobEnabled } from "./admob-config";

let interstitial: InterstitialAd | null = null;
let unsubscribers: Array<() => void> = [];
let sdkInitialized = false;
let interstitialLoaded = false;
let isShowing = false;
let isLoadInFlight = false;
let loadWaiters: Array<(loaded: boolean) => void> = [];
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

/** If the ad never opens, bail quickly so the result screen stays tappable. */
const SHOW_OPEN_TIMEOUT_MS = 4_000;
/**
 * Safety net only: real interstitials often run 15–60s+. Resolving earlier
 * (e.g. 5s) lets callers navigate under a still-visible ad — exam timers then
 * advance in the background. Keep this longer than any normal creative.
 */
const SHOW_CLOSE_TIMEOUT_MS = 90_000;
/** Max time spent waiting for a creative before skipping. */
const ENSURE_ATTEMPTS = 2;
const ENSURE_PER_ATTEMPT_MS = 2_500;

export function isInterstitialLoaded() {
  return interstitialLoaded;
}

export function isInterstitialShowing() {
  return isShowing;
}

function resolveLoadWaiters(loaded: boolean) {
  const waiters = loadWaiters;
  loadWaiters = [];
  for (const resolve of waiters) {
    resolve(loaded);
  }
}

function setLoaded(loaded: boolean) {
  interstitialLoaded = loaded;
  isLoadInFlight = false;

  if (loaded) {
    resolveLoadWaiters(true);
  }
}

function logAd(message: string, payload?: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[AdMob] ${message}`, payload ?? "");
  }
}

function clearAutoRetry() {
  if (autoRetryTimer) {
    clearTimeout(autoRetryTimer);
    autoRetryTimer = null;
  }
}

function requestLoad() {
  if (!interstitial || isShowing || interstitialLoaded || isLoadInFlight) {
    return;
  }

  isLoadInFlight = true;
  logAd("load()");
  interstitial.load();
}

/**
 * Tear down the current interstitial instance. Needed when AdMob leaves a
 * ghost full-screen layer that eats touches without firing CLOSED.
 */
export function resetInterstitialInstance() {
  clearAutoRetry();

  for (const unsubscribe of unsubscribers) {
    try {
      unsubscribe();
    } catch {
      // Best effort.
    }
  }

  unsubscribers = [];
  interstitial = null;
  isShowing = false;
  isLoadInFlight = false;
  setLoaded(false);
  resolveLoadWaiters(false);
}

/** Test-only: full module reset including SDK init flag. */
export function resetInterstitialControllerForTests() {
  resetInterstitialInstance();
  sdkInitialized = false;
}

export async function initializeAdMobSdk() {
  if (!isAdMobEnabled() || sdkInitialized) {
    return;
  }

  try {
    await MobileAds().setRequestConfiguration({
      testDeviceIdentifiers: ["EMULATOR"],
    });
    await MobileAds().initialize();
    sdkInitialized = true;
    logAd("SDK initialized", { unitId: getInterstitialAdUnitId() });
  } catch (error) {
    console.warn("Failed to initialize AdMob SDK.", error);
    setLoaded(false);
  }
}

export function startInterstitialPreload() {
  if (!isAdMobEnabled()) {
    setLoaded(false);
    return () => undefined;
  }

  resetInterstitialInstance();

  const unitId = getInterstitialAdUnitId() || TestIds.INTERSTITIAL;

  if (!unitId) {
    console.warn("[AdMob] Missing interstitial unit id.");
    setLoaded(false);
    return () => undefined;
  }

  logAd("Creating interstitial request", { unitId });

  interstitial = InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  unsubscribers.push(
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      logAd("Interstitial LOADED");
      clearAutoRetry();
      setLoaded(true);
    })
  );

  unsubscribers.push(
    interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn("[AdMob] Interstitial ERROR", error);
      isLoadInFlight = false;
      setLoaded(false);
      isShowing = false;
      resolveLoadWaiters(false);

      // One quiet background retry — never blocks UI.
      clearAutoRetry();
      autoRetryTimer = setTimeout(() => {
        requestLoad();
      }, 750);
    })
  );

  unsubscribers.push(
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      logAd("Interstitial CLOSED");
      isShowing = false;
      setLoaded(false);
      clearAutoRetry();
      autoRetryTimer = setTimeout(() => {
        requestLoad();
      }, 250);
    })
  );

  requestLoad();

  return stopInterstitialPreload;
}

export function stopInterstitialPreload() {
  resetInterstitialInstance();
}

function waitForSingleLoad(timeoutMs: number): Promise<boolean> {
  if (interstitialLoaded) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(loaded);
    };

    loadWaiters.push(finish);
    setTimeout(() => finish(interstitialLoaded), timeoutMs);
  });
}

/**
 * Warm an interstitial. Caps wait time tightly — callers must skip if false.
 */
export async function ensureInterstitialReady(options?: {
  attempts?: number;
  timeoutMs?: number;
}): Promise<boolean> {
  const attempts = options?.attempts ?? ENSURE_ATTEMPTS;
  const timeoutMs = options?.timeoutMs ?? attempts * ENSURE_PER_ATTEMPT_MS;
  const perAttemptMs = Math.max(
    1_500,
    Math.floor(timeoutMs / Math.max(attempts, 1))
  );

  if (!isAdMobEnabled()) {
    return false;
  }

  await initializeAdMobSdk();

  if (interstitialLoaded) {
    return true;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    logAd(`ensure ready attempt ${attempt}/${attempts}`);

    if (!interstitial || attempt > 1) {
      startInterstitialPreload();
    } else {
      requestLoad();
    }

    const loaded = await waitForSingleLoad(perAttemptMs);
    if (loaded) {
      return true;
    }
  }

  logAd("ensure ready failed — skipping ad");
  return false;
}

/** @deprecated Prefer ensureInterstitialReady — kept for callers. */
export function waitForInterstitialLoaded(timeoutMs = 5_000): Promise<boolean> {
  return ensureInterstitialReady({ attempts: 2, timeoutMs });
}

/**
 * Show a loaded interstitial with hard fail-open timeouts.
 * Never leaves `isShowing` stuck — ghost overlays get torn down.
 */
export async function showPreloadedInterstitial(): Promise<boolean> {
  if (isShowing) {
    // Never tear down a live show from a concurrent caller — that creates
    // ghost overlays that eat touches on the result screen.
    logAd("show skipped — already showing");
    return false;
  }

  if (!interstitialLoaded || !interstitial) {
    const ready = await ensureInterstitialReady();
    if (!ready || !interstitial) {
      logAd("show aborted — not loaded after ensure");
      return false;
    }
  }

  const current = interstitial;

  return new Promise<boolean>((resolve) => {
    isShowing = true;
    let didOpen = false;
    let sawBackgroundDuringShow = false;
    let settled = false;
    let appStateSub: NativeEventSubscription | null = null;
    let openTimeout: ReturnType<typeof setTimeout> | null = null;
    let closeTimeout: ReturnType<typeof setTimeout> | null = null;
    let appStateReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

    const cleanupTimers = () => {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      if (appStateReleaseTimeout) {
        clearTimeout(appStateReleaseTimeout);
        appStateReleaseTimeout = null;
      }
      appStateSub?.remove();
      appStateSub = null;
    };

    const finish = (shown: boolean, reason: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanupTimers();
      unsubscribeOpened();
      unsubscribeClosed();
      unsubscribeError();
      isShowing = false;
      logAd(shown ? "show finished OK" : "show finished FAIL", {
        didOpen,
        reason,
      });

      // Always recreate after a show attempt so a ghost native layer cannot
      // keep eating touches on the exam result screen.
      resetInterstitialInstance();
      startInterstitialPreload();

      resolve(shown);
    };

    const unsubscribeOpened = current.addAdEventListener(
      AdEventType.OPENED,
      () => {
        didOpen = true;
        logAd("Interstitial OPENED");
        if (openTimeout) {
          clearTimeout(openTimeout);
          openTimeout = null;
        }
        closeTimeout = setTimeout(() => {
          console.warn(
            "[AdMob] show timed out waiting for CLOSED after OPENED — force release UI"
          );
          finish(true, "close_timeout");
        }, SHOW_CLOSE_TIMEOUT_MS);
      }
    );

    const unsubscribeClosed = current.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        finish(true, "closed");
      }
    );

    const unsubscribeError = current.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn("[AdMob] show ERROR", error);
        setLoaded(false);
        finish(false, "error");
      }
    );

    // Ghost dismiss without CLOSED: only treat "active" as done after the app
    // actually left the foreground during this show. A spurious active (or
    // open flicker) must not unlock navigation under a still-visible ad.
    appStateSub = AppState.addEventListener("change", (nextState) => {
      if (settled || !isShowing) {
        return;
      }

      if (nextState === "inactive" || nextState === "background") {
        sawBackgroundDuringShow = true;
        return;
      }

      if (nextState !== "active") {
        return;
      }

      if (didOpen && !sawBackgroundDuringShow) {
        logAd("Ignoring AppState active — never left foreground after OPENED");
        return;
      }

      const reason = didOpen
        ? "app_active_after_open"
        : "app_active_without_open";
      const delayMs = didOpen ? 250 : 400;

      logAd(`App became active during show — ${reason}`);
      if (appStateReleaseTimeout) {
        clearTimeout(appStateReleaseTimeout);
      }
      appStateReleaseTimeout = setTimeout(() => {
        appStateReleaseTimeout = null;
        if (!settled) {
          finish(Boolean(didOpen), reason);
        }
      }, delayMs);
    });

    openTimeout = setTimeout(() => {
      if (didOpen) {
        return;
      }

      console.warn(
        "[AdMob] show timed out waiting for OPENED — skipping ad, releasing UI"
      );
      finish(false, "open_timeout");
    }, SHOW_OPEN_TIMEOUT_MS);

    current.show().catch((error) => {
      console.warn("Failed to show interstitial ad.", error);
      setLoaded(false);
      finish(false, "show_rejected");
    });
  });
}
