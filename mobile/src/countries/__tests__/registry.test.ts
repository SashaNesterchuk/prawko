import {
  clampLocaleForCountry,
  getCountryConfig,
  resolveCountryCode,
} from "@prawko/config";

describe("country registry", () => {
  it("maps storefront and region aliases onto supported exam countries", () => {
    expect(resolveCountryCode("PL")).toBe("PL");
    expect(resolveCountryCode("POL")).toBe("PL");
    expect(resolveCountryCode("cz")).toBe("CZ");
    expect(resolveCountryCode("CZE")).toBe("CZ");
    expect(resolveCountryCode("US")).toBeNull();
  });

  it("keeps Polish WORD rules and Czech eTesty rules in config, not UI branches", () => {
    expect(getCountryConfig("PL")).toMatchObject({
      questionSetKey: "pl-v2-current",
      defaultLocale: "ua",
      supportedLocales: ["pl", "ua", "en", "de", "es"],
      exam: { id: "word", totalQuestions: 32, durationMinutes: 25 },
    });
    expect(getCountryConfig("CZ")).toMatchObject({
      questionSetKey: "cz-v2-current",
      defaultLocale: "cs",
      supportedLocales: ["cs", "en"],
      categories: ["B"],
      exam: { id: "etesty", totalQuestions: 25, durationMinutes: 30 },
    });
  });

  it("clamps locale to the country's supported list", () => {
    expect(clampLocaleForCountry("CZ", "ua")).toBe("cs");
    expect(clampLocaleForCountry("CZ", "en")).toBe("en");
    expect(clampLocaleForCountry("PL", "cs")).toBe("ua");
    expect(clampLocaleForCountry("PL", "pl")).toBe("pl");
  });
});
