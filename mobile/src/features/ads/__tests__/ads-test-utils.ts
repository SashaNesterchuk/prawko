type AdListener = (payload?: unknown) => void;

export type MockInterstitial = {
  load: jest.Mock;
  show: jest.Mock;
  addAdEventListener: jest.Mock;
  emit: (type: string, payload?: unknown) => void;
};

export const AdEventType = {
  LOADED: "loaded",
  ERROR: "error",
  OPENED: "opened",
  CLOSED: "closed",
} as const;

let latestInterstitial: MockInterstitial | null = null;

export function getLatestMockInterstitial() {
  return latestInterstitial;
}

export function resetLatestMockInterstitial() {
  latestInterstitial = null;
}

export function createMockInterstitial(): MockInterstitial {
  const listeners = new Map<string, Set<AdListener>>();

  const interstitial: MockInterstitial = {
    load: jest.fn(),
    show: jest.fn(() => Promise.resolve()),
    addAdEventListener: jest.fn((type: string, listener: AdListener) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }

      listeners.get(type)!.add(listener);
      return () => {
        listeners.get(type)?.delete(listener);
      };
    }),
    emit(type: string, payload?: unknown) {
      const set = listeners.get(type);
      if (!set) {
        return;
      }

      for (const listener of [...set]) {
        listener(payload);
      }
    },
  };

  latestInterstitial = interstitial;
  return interstitial;
}
