import { mobileEnv } from "../../../config/env";
import {
  isE2EAdsEnabled,
  resetE2EAdsEnabled,
  setE2EAdsEnabled,
  subscribeE2EAdsEnabled,
} from "../ads-flag";

jest.mock("../../../config/env", () => ({
  mobileEnv: {
    enableE2ETestMode: true,
  },
}));

const mockedEnv = mobileEnv as { enableE2ETestMode: boolean };

describe("e2e ads flag", () => {
  beforeEach(() => {
    mockedEnv.enableE2ETestMode = true;
    resetE2EAdsEnabled();
  });

  it("is off until bootstrap opts in", () => {
    expect(isE2EAdsEnabled()).toBe(false);
    setE2EAdsEnabled(true);
    expect(isE2EAdsEnabled()).toBe(true);
  });

  it("notifies subscribers when the override changes", () => {
    const listener = jest.fn();
    const stop = subscribeE2EAdsEnabled(listener);

    setE2EAdsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setE2EAdsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);

    resetE2EAdsEnabled();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("ignores the override outside e2e builds", () => {
    mockedEnv.enableE2ETestMode = false;
    setE2EAdsEnabled(true);
    expect(isE2EAdsEnabled()).toBe(false);
  });
});
