import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

export function setHomeStartSpotlightActive(next: boolean) {
  if (active === next) {
    return;
  }

  active = next;
  listeners.forEach((listener) => listener());
}

export function subscribeHomeStartSpotlightActive(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getHomeStartSpotlightActive() {
  return active;
}

export function useHomeStartSpotlightActive() {
  return useSyncExternalStore(
    subscribeHomeStartSpotlightActive,
    getHomeStartSpotlightActive,
    getHomeStartSpotlightActive
  );
}
