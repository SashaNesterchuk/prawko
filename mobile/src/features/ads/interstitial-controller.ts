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

export function isInterstitialLoaded() {
  return interstitialLoaded;
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

  stopInterstitialPreload();

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

      // Cold-start / first request often fails once — warm a retry in background.
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
  clearAutoRetry();

  for (const unsubscribe of unsubscribers) {
    unsubscribe();
  }

  unsubscribers = [];
  interstitial = null;
  isShowing = false;
  isLoadInFlight = false;
  setLoaded(false);
  resolveLoadWaiters(false);
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
 * Make sure an interstitial is ready. Retries a few times because the first
 * AdMob request after app start / screen open often errors once.
 */
export async function ensureInterstitialReady(options?: {
  attempts?: number;
  timeoutMs?: number;
}): Promise<boolean> {
  const attempts = options?.attempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const perAttemptMs = Math.max(2_500, Math.floor(timeoutMs / attempts));

  if (!isAdMobEnabled()) {
    return false;
  }

  await initializeAdMobSdk();

  if (interstitialLoaded) {
    return true;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    logAd(`ensure ready attempt ${attempt}/${attempts}`);

    if (!interstitial) {
      startInterstitialPreload();
    } else {
      // Recreate after a failed attempt — stale instances often keep failing.
      if (attempt > 1) {
        startInterstitialPreload();
      } else {
        requestLoad();
      }
    }

    const loaded = await waitForSingleLoad(perAttemptMs);
    if (loaded) {
      return true;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  logAd("ensure ready failed after retries");
  return false;
}

/** @deprecated Prefer ensureInterstitialReady — kept for callers. */
export function waitForInterstitialLoaded(timeoutMs = 8_000): Promise<boolean> {
  return ensureInterstitialReady({ attempts: 2, timeoutMs });
}

export async function showPreloadedInterstitial(): Promise<boolean> {
  if (isShowing) {
    logAd("show skipped — already showing");
    return false;
  }

  if (!interstitialLoaded || !interstitial) {
    const ready = await ensureInterstitialReady({ attempts: 3, timeoutMs: 12_000 });
    if (!ready || !interstitial) {
      logAd("show aborted — not loaded after ensure");
      return false;
    }
  }

  const current = interstitial;

  return new Promise<boolean>((resolve) => {
    isShowing = true;
    let didOpen = false;
    let settled = false;

    const finish = (shown: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(hangTimeout);
      unsubscribeOpened();
      unsubscribeClosed();
      unsubscribeError();
      isShowing = false;
      logAd(shown ? "show finished OK" : "show finished FAIL", { didOpen });
      resolve(shown);
    };

    const unsubscribeOpened = current.addAdEventListener(
      AdEventType.OPENED,
      () => {
        didOpen = true;
        logAd("Interstitial OPENED");
      }
    );

    const unsubscribeClosed = current.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        finish(true);
      }
    );

    const unsubscribeError = current.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn("[AdMob] show ERROR", error);
        setLoaded(false);
        finish(false);
      }
    );

    const hangTimeout = setTimeout(() => {
      console.warn("[AdMob] show timed out waiting for CLOSED");
      requestLoad();
      finish(didOpen);
    }, 60_000);

    current.show().catch((error) => {
      console.warn("Failed to show interstitial ad.", error);
      setLoaded(false);
      requestLoad();
      finish(false);
    });
  });
}
