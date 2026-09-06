import { InteractionManager } from "react-native";
import {
  AdEventType,
  InterstitialAd,
  MobileAds,
} from "react-native-google-mobile-ads";

import {
  getInterstitialAdUnitId,
  isAdMobEnabled,
  shouldUseAdMobTestAds,
} from "./admob-config";

type InterstitialShowingListener = (showing: boolean) => void;

let interstitial: InterstitialAd | null = null;
let unsubscribers: Array<() => void> = [];
let sdkInitialized = false;
let interstitialLoaded = false;
let isShowing = false;
let isLoadInFlight = false;
let loadWaiters: Array<(loaded: boolean) => void> = [];
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
const showingListeners = new Set<InterstitialShowingListener>();

function setShowing(next: boolean) {
  if (isShowing === next) {
    return;
  }

  isShowing = next;

  for (const listener of [...showingListeners]) {
    listener(next);
  }
}

/** If the ad never opens, bail quickly so the result screen stays tappable. */
const SHOW_OPEN_TIMEOUT_MS = 4_000;
/**
 * Safety net only: real interstitials often run 15–60s+. Resolving earlier
 * (e.g. 5s) lets callers navigate under a still-visible ad — exam timers then
 * advance in the background. Keep this longer than any normal creative.
 */
const SHOW_CLOSE_TIMEOUT_MS = 90_000;
/** Extra settle after RN animations so AdMob is not presented over a Modal. */
export const PRESENTATION_SETTLE_MS = 400;
/** Hard cap so a stuck interaction queue cannot freeze show() forever. */
export const PRESENTATION_IDLE_TIMEOUT_MS = 1_200;
/** Max time spent waiting for a creative before skipping. */
const ENSURE_ATTEMPTS = 2;
const ENSURE_PER_ATTEMPT_MS = 2_500;

type IdleWait = () => Promise<void>;

/**
 * Presenting GADInterstitial during a Modal dismiss / stack animation leaves a
 * transparent native layer that eats all touches. Wait for the UI to settle.
 */
export function waitForPresentationReady(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(finish, PRESENTATION_SETTLE_MS);
    });

    setTimeout(() => {
      task.cancel?.();
      finish();
    }, PRESENTATION_IDLE_TIMEOUT_MS);
  });
}

let idleWait: IdleWait = waitForPresentationReady;

export function setInterstitialIdleWaitForTests(next?: IdleWait) {
  idleWait = next ?? waitForPresentationReady;
}

export function isInterstitialLoaded() {
  return interstitialLoaded;
}

export function isInterstitialShowing() {
  return isShowing;
}

/** Blitz / exam clocks subscribe so an overlay that never backgrounds still pauses. */
export function subscribeInterstitialShowing(
  listener: InterstitialShowingListener
) {
  showingListeners.add(listener);
  return () => {
    showingListeners.delete(listener);
  };
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
  setShowing(false);
  isLoadInFlight = false;
  setLoaded(false);
  resolveLoadWaiters(false);
}

/** Test-only: full module reset including SDK init flag. */
export function resetInterstitialControllerForTests() {
  resetInterstitialInstance();
  sdkInitialized = false;
  idleWait = waitForPresentationReady;
}

export async function initializeAdMobSdk() {
  if (!isAdMobEnabled() || sdkInitialized) {
    return;
  }

  try {
    if (shouldUseAdMobTestAds()) {
      await MobileAds().setRequestConfiguration({
        testDeviceIdentifiers: ["EMULATOR"],
      });
    }
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

  const unitId = getInterstitialAdUnitId();

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
      setShowing(false);
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
      setShowing(false);
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
 * Never leaves `isShowing` stuck. Does not tear down the native instance on
 * AppState flicker — that is what leaves a transparent overlay on the result.
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
  setShowing(true);

  try {
    await idleWait();
  } catch (error) {
    console.warn("[AdMob] idle wait failed before show", error);
    setShowing(false);
    return false;
  }

  if (!current || interstitial !== current) {
    logAd("show aborted — instance changed during idle wait");
    setShowing(false);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let didOpen = false;
    let settled = false;
    let openTimeout: ReturnType<typeof setTimeout> | null = null;
    let closeTimeout: ReturnType<typeof setTimeout> | null = null;

    const cleanupTimers = () => {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
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
      setShowing(false);
      logAd(shown ? "show finished OK" : "show finished FAIL", {
        didOpen,
        reason,
      });

      // Recreate only after the native show settled (CLOSED / ERROR / timeout).
      // Tearing down on AppState flicker is what leaves a ghost touch layer.
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
