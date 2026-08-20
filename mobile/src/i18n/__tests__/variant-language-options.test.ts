import {
  variantLanguageOptions,
  withVariantLanguageOptions,
} from "../variant-language-options";

describe("withVariantLanguageOptions", () => {
  it("adds Czech labels to Ukrainian copy without replacing existing languages", () => {
    const resources = withVariantLanguageOptions({
      ua: {
        translation: {
          languages: {
            ua: { label: "Українська", description: "Shell" },
            en: { label: "English", description: "English shell" },
          },
        },
      },
    });
    const languages = (
      resources.ua as {
        translation: { languages: Record<string, { label: string }> };
      }
    ).translation.languages;

    expect(languages.cs).toEqual(variantLanguageOptions.cs);
    expect(languages.ua.label).toBe("Українська");
    expect(languages.en.label).toBe("English");
  });
});
