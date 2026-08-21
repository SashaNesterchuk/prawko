import { AppState } from "react-native";

import { useQuestionProgressStore } from "../../state/question-progress";
import {
  isInterstitialShowing,
  subscribeInterstitialShowing,
} from "../ads/interstitial-controller";
import { isTimedQuestionSession } from "./question-engine";

/**
 * Blitz uses an absolute `expiresAt`. Ads often overlay without backgrounding,
 * so wall-clock would keep ticking. Freeze while an interstitial is up or the
 * app is inactive (same idea as the exam question timer).
 */
export function shouldFreezeTimedSessionClock() {
  return isInterstitialShowing() || AppState.currentState !== "active";
}

export function syncTimedSessionClock() {
  const store = useQuestionProgressStore.getState();
  const session = store.activeSession;

  if (!session || session.finishedAt || !isTimedQuestionSession(session)) {
    return;
  }

  if (shouldFreezeTimedSessionClock()) {
    store.pauseActiveSessionTimer();
    return;
  }

  store.resumeActiveSessionTimer();
}

export function startTimedSessionClock() {
  syncTimedSessionClock();
  const appSubscription = AppState.addEventListener(
    "change",
    syncTimedSessionClock
  );
  const stopInterstitial = subscribeInterstitialShowing(() => {
    syncTimedSessionClock();
  });

  return () => {
    appSubscription.remove();
    stopInterstitial();
  };
}
