const { getVariant, getVariantId } = require("../manifest.cjs");

describe("app variant manifest", () => {
  it("keeps the existing Prawko production identity", () => {
    const prawko = getVariant("prawko");

    expect(prawko.productionReady).toBe(true);
    expect(prawko.iosBundleIdentifier).toBe("com.mindjar.prawko");
    expect(prawko.questionSetKey).toBe("pl-v2-current");
    expect(prawko.supportedLocales).toEqual(["pl", "ua", "en", "de", "es"]);
    expect(prawko.features.roadSigns).toBe(true);
  });

  it("keeps new country variants as non-production templates", () => {
    expect(getVariant("czech")).toMatchObject({
      productionReady: false,
      defaultLocale: "cs",
      supportedLocales: ["cs", "en"],
      features: { roadSigns: true },
    });
    expect(getVariant("greece")).toMatchObject({
      productionReady: false,
      defaultLocale: "el",
      supportedLocales: ["el", "en"],
      features: { roadSigns: false },
    });
  });

  it("falls back to Prawko for an absent or invalid APP_VARIANT", () => {
    expect(getVariantId()).toBe("prawko");
    expect(getVariantId("unknown-country")).toBe("prawko");
  });

  it("does not point Czech media at the Prawko CDN", () => {
    const previousPrawko = process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
    const previousCzech = process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL;
    process.env.EXPO_PUBLIC_MEDIA_BASE_URL = "https://media.mind-jar.com";
    process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL =
      "https://czech-media.example.com";

    try {
      expect(getVariant("prawko").mediaBaseUrl).toBe(
        "https://media.mind-jar.com"
      );
      expect(getVariant("czech").mediaBaseUrl).toBe(
        "https://czech-media.example.com"
      );
      expect(getVariant("czech").mediaBaseUrl).not.toBe(
        getVariant("prawko").mediaBaseUrl
      );
    } finally {
      if (previousPrawko === undefined) {
        delete process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
      } else {
        process.env.EXPO_PUBLIC_MEDIA_BASE_URL = previousPrawko;
      }
      if (previousCzech === undefined) {
        delete process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL;
      } else {
        process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL = previousCzech;
      }
    }
  });

  it("leaves Czech media origin empty when its own env is unset", () => {
    const previousPrawko = process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
    const previousCzech = process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL;
    process.env.EXPO_PUBLIC_MEDIA_BASE_URL = "https://media.mind-jar.com";
    delete process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL;

    try {
      expect(getVariant("czech").mediaBaseUrl).toBe("");
      expect(getVariant("prawko").mediaBaseUrl).toBe(
        "https://media.mind-jar.com"
      );
    } finally {
      if (previousPrawko === undefined) {
        delete process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
      } else {
        process.env.EXPO_PUBLIC_MEDIA_BASE_URL = previousPrawko;
      }
      if (previousCzech === undefined) {
        delete process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL;
      } else {
        process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL = previousCzech;
      }
    }
  });
});
