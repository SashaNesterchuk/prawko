import { getLocales } from "expo-localization";
import Purchases from "react-native-purchases";

import { mobileEnv } from "../../config/env";
import { detectExamCountry } from "../detect-country";

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    getStorefront: jest.fn(),
    isConfigured: jest.fn(async () => true),
  },
}));

jest.mock("../../config/env", () => ({
  mobileEnv: {
    enableE2ETestMode: false,
  },
}));

const mockedEnv = mobileEnv as { enableE2ETestMode: boolean };
const mockedPurchases = Purchases as unknown as {
  getStorefront: jest.Mock;
  isConfigured: jest.Mock;
};
const getStorefront = mockedPurchases.getStorefront;

describe("detectExamCountry", () => {
  const originalE2eCountry = process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY;

  afterEach(() => {
    mockedEnv.enableE2ETestMode = false;
    mockedPurchases.isConfigured.mockResolvedValue(true);
    getStorefront.mockReset();
    if (originalE2eCountry === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY;
    } else {
      process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY = originalE2eCountry;
    }
  });

  it("prefers a supported RevenueCat storefront over the device region", async () => {
    getStorefront.mockResolvedValue("CZ");
    jest.mocked(getLocales).mockReturnValue([
      {
        regionCode: "PL",
        languageCode: "uk",
        languageTag: "uk-PL",
      } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "CZ",
      source: "storefront",
    });
  });

  it("falls back to the device region when storefront is missing or unsupported", async () => {
    getStorefront.mockResolvedValue("US");
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "CZ", languageCode: "pl", languageTag: "pl-CZ" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "CZ",
      source: "device_region",
    });
  });

  it("detects Slovakia from a Slovak storefront or device region", async () => {
    getStorefront.mockResolvedValue("SK");
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "CZ", languageCode: "cs", languageTag: "cs-CZ" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "SK",
      source: "storefront",
    });

    getStorefront.mockResolvedValue(null);
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "SK", languageCode: "sk", languageTag: "sk-SK" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "SK",
      source: "device_region",
    });
  });

  it("uses a later locale region when the primary region is unsupported", async () => {
    getStorefront.mockResolvedValue(null);
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "UA", languageCode: "uk", languageTag: "uk-UA" } as never,
      { regionCode: "CZ", languageCode: "cs", languageTag: "cs-CZ" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "CZ",
      source: "device_region",
    });
  });

  it("does not pick exam country from phone language", async () => {
    getStorefront.mockResolvedValue(null);
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "US", languageCode: "cs", languageTag: "cs-US" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "PL",
      source: "default",
    });
  });

  it("defaults to Poland when neither storefront nor region maps to a supported country", async () => {
    getStorefront.mockResolvedValue(null);
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "US" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "PL",
      source: "default",
    });
  });

  it("uses the e2e exam-country override in test mode", async () => {
    mockedEnv.enableE2ETestMode = true;
    process.env.EXPO_PUBLIC_E2E_EXAM_COUNTRY = "CZ";
    getStorefront.mockResolvedValue("PL");

    await expect(detectExamCountry()).resolves.toEqual({
      country: "CZ",
      source: "e2e",
    });
  });

  it("skips storefront until RevenueCat is configured", async () => {
    mockedPurchases.isConfigured.mockResolvedValue(false);
    getStorefront.mockResolvedValue("CZ");
    jest.mocked(getLocales).mockReturnValue([
      { regionCode: "PL", languageCode: "pl", languageTag: "pl-PL" } as never,
    ]);

    await expect(detectExamCountry()).resolves.toEqual({
      country: "PL",
      source: "device_region",
    });
    expect(getStorefront).not.toHaveBeenCalled();
  });
});
