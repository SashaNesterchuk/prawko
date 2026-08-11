// jest-expo provides RN mocks; keep a stable __DEV__ for ad unit selection.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] ?? "");
    if (message.includes("[AdMob]") || message.includes("interstitial")) {
      return;
    }
    originalWarn(...(args as Parameters<typeof console.warn>));
  };
  console.log = (...args: unknown[]) => {
    const message = String(args[0] ?? "");
    if (message.includes("[AdMob]")) {
      return;
    }
    originalLog(...(args as Parameters<typeof console.log>));
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.log = originalLog;
});
