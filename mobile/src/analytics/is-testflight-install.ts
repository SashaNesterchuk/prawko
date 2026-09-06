/**
 * TestFlight uses the sandbox App Store receipt. App Store production does not.
 * Resolved lazily so Node unit tests never load Expo native bindings.
 */
export function readIsTestFlightInstall(): boolean {
  try {
    const { requireOptionalNativeModule } = require("expo") as {
      requireOptionalNativeModule: <T>(name: string) => T | null;
    };
    const native = requireOptionalNativeModule<{ isTestFlight?: boolean }>(
      "StoreDistribution"
    );

    return native?.isTestFlight === true;
  } catch {
    return false;
  }
}
