import { mobileEnv } from "../../../config/env";
import {
  configureE2ETestOverrides,
  isE2EHomeChromeUnlocked,
  resetE2ETestOverrides,
} from "../state";

jest.mock("../../../config/env", () => ({
  mobileEnv: {
    enableE2ETestMode: true,
  },
}));

jest.mock("../../../state/entitlements", () => ({
  useEntitlementStore: {
    getState: () => ({
      setDebugPlusOverride: jest.fn(),
    }),
  },
}));

const mockedEnv = mobileEnv as { enableE2ETestMode: boolean };

describe("e2e home chrome unlock", () => {
  beforeEach(() => {
    mockedEnv.enableE2ETestMode = true;
    resetE2ETestOverrides();
  });

  it("stays locked until bootstrap opts in", () => {
    expect(isE2EHomeChromeUnlocked()).toBe(false);
    configureE2ETestOverrides({ unlockHomeChrome: true });
    expect(isE2EHomeChromeUnlocked()).toBe(true);
  });

  it("skips the first-start spotlight when bootstrap unlocks Home", () => {
    configureE2ETestOverrides({ unlockHomeChrome: false });
    expect(isE2EHomeChromeUnlocked()).toBe(false);
  });

  it("ignores the unlock outside e2e builds", () => {
    mockedEnv.enableE2ETestMode = false;
    configureE2ETestOverrides({ unlockHomeChrome: true });
    expect(isE2EHomeChromeUnlocked()).toBe(false);
  });
});
