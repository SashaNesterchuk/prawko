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
});
