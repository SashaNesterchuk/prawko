import { isRevenueCatEnabledForBuild } from "../revenuecat-config";

describe("isRevenueCatEnabledForBuild", () => {
  it("stays off in E2E runs so Maestro clearState does not add customers", () => {
    expect(
      isRevenueCatEnabledForBuild({
        enableInDevBuilds: true,
        isDevBuild: false,
        isE2ETestMode: true,
      })
    ).toBe(false);
  });

  it("stays off in dev builds by default", () => {
    expect(
      isRevenueCatEnabledForBuild({
        enableInDevBuilds: false,
        isDevBuild: true,
        isE2ETestMode: false,
      })
    ).toBe(false);
  });

  it("can be enabled in a dev build to test purchases", () => {
    expect(
      isRevenueCatEnabledForBuild({
        enableInDevBuilds: true,
        isDevBuild: true,
        isE2ETestMode: false,
      })
    ).toBe(true);
  });

  it("stays on for release builds", () => {
    expect(
      isRevenueCatEnabledForBuild({
        enableInDevBuilds: false,
        isDevBuild: false,
        isE2ETestMode: false,
      })
    ).toBe(true);
  });
});
