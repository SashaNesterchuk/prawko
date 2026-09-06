import { mobileEnv } from "../../config/env";

let e2eAdsEnabled = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) {
    listener();
  }
}

export function isE2EAdsEnabled() {
  return mobileEnv.enableE2ETestMode && e2eAdsEnabled;
}

export function setE2EAdsEnabled(enabled: boolean) {
  if (!mobileEnv.enableE2ETestMode) {
    return;
  }

  if (e2eAdsEnabled === enabled) {
    return;
  }

  e2eAdsEnabled = enabled;
  notify();
}

export function resetE2EAdsEnabled() {
  if (!mobileEnv.enableE2ETestMode) {
    return;
  }

  if (!e2eAdsEnabled) {
    return;
  }

  e2eAdsEnabled = false;
  notify();
}

export function subscribeE2EAdsEnabled(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
