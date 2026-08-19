export const Platform = {
  OS: "ios",
  select: (spec: Record<string, unknown>) =>
    spec.ios ?? spec.default ?? spec.native,
};

type AppStateListener = (state: string) => void;

const appStateListeners = new Set<AppStateListener>();

export const Linking = {
  canOpenURL: jest.fn(async () => true),
  openURL: jest.fn(async () => {}),
  openSettings: jest.fn(async () => {}),
};

export const AppState = {
  currentState: "active",
  addEventListener: jest.fn((_type: string, listener: AppStateListener) => {
    appStateListeners.add(listener);
    return {
      remove: () => {
        appStateListeners.delete(listener);
      },
    };
  }),
  __emit(state: string) {
    for (const listener of [...appStateListeners]) {
      listener(state);
    }
  },
  __reset() {
    appStateListeners.clear();
  },
};

export default {
  Platform,
  Linking,
  AppState,
};
