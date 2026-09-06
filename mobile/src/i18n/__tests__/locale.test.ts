import { getLocales } from "expo-localization";

import {
  getSupportedDeviceLocale,
  normalizeSupportedLocale,
} from "../locale";

describe("normalizeSupportedLocale", () => {
  it("maps Ukrainian OS codes onto the app locale", () => {
    expect(normalizeSupportedLocale("uk")).toBe("ua");
    expect(normalizeSupportedLocale("uk-UA")).toBe("ua");
    expect(normalizeSupportedLocale("ua")).toBe("ua");
  });

  it("keeps Czech and Polish phone languages", () => {
    expect(normalizeSupportedLocale("cs")).toBe("cs");
    expect(normalizeSupportedLocale("cs-CZ")).toBe("cs");
    expect(normalizeSupportedLocale("pl-PL")).toBe("pl");
  });
});

describe("getSupportedDeviceLocale", () => {
  afterEach(() => {
    jest.mocked(getLocales).mockReset();
  });

  it("uses the first supported phone language", () => {
    jest.mocked(getLocales).mockReturnValue([
      { languageTag: "cs-CZ", languageCode: "cs", regionCode: "CZ" } as never,
    ]);

    expect(getSupportedDeviceLocale()).toBe("cs");
  });

  it("skips unsupported phone languages and uses the next preferred one", () => {
    jest.mocked(getLocales).mockReturnValue([
      { languageTag: "ru-RU", languageCode: "ru", regionCode: "RU" } as never,
      { languageTag: "pl-PL", languageCode: "pl", regionCode: "PL" } as never,
    ]);

    expect(getSupportedDeviceLocale()).toBe("pl");
  });

  it("falls back to Polish when the phone language is unknown", () => {
    jest.mocked(getLocales).mockReturnValue([
      { languageTag: "ja-JP", languageCode: "ja", regionCode: "JP" } as never,
    ]);

    expect(getSupportedDeviceLocale()).toBe("pl");
  });
});
