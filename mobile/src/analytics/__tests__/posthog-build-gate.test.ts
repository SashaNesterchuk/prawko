import { isPostHogEnabledForBuild } from "../posthog-build-gate";

const productionStoreBuild = {
  captureEnabled: true,
  hasApiKey: true,
  isDevBuild: false,
  isE2ETestMode: false,
  isTestFlightInstall: false,
};

describe("isPostHogEnabledForBuild", () => {
  it("stays off in E2E even when the production flag is set", () => {
    expect(
      isPostHogEnabledForBuild({
        ...productionStoreBuild,
        isE2ETestMode: true,
      })
    ).toBe(false);
  });

  it("stays off in Metro and development-client builds", () => {
    expect(
      isPostHogEnabledForBuild({
        ...productionStoreBuild,
        isDevBuild: true,
      })
    ).toBe(false);
  });

  it("stays off on TestFlight even when the production flag is set", () => {
    expect(
      isPostHogEnabledForBuild({
        ...productionStoreBuild,
        isTestFlightInstall: true,
      })
    ).toBe(false);
  });

  it("stays off when the production capture flag is missing", () => {
    expect(
      isPostHogEnabledForBuild({
        ...productionStoreBuild,
        captureEnabled: false,
      })
    ).toBe(false);
  });

  it("stays off when the project API key is missing", () => {
    expect(
      isPostHogEnabledForBuild({
        ...productionStoreBuild,
        hasApiKey: false,
      })
    ).toBe(false);
  });

  it("is on for a production store build", () => {
    expect(isPostHogEnabledForBuild(productionStoreBuild)).toBe(true);
  });
});
