import { resources } from "../resources";
import { polishTranslations } from "../pl";

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function leafPaths(
  value: unknown,
  prefix = "",
): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function valueAt(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

function interpolationNames(value: string) {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]).sort();
}

describe("Polish translation coverage", () => {
  const english = resources.en.translation;

  it("covers every English UI key", () => {
    const missing = leafPaths(english).filter((path) => valueAt(polishTranslations, path) == null);

    expect(missing).toEqual([]);
  });

  it("keeps the same interpolation placeholders as English", () => {
    const mismatched = leafPaths(english).flatMap((path) => {
      const englishValue = valueAt(english, path);
      const polishValue = valueAt(polishTranslations, path);

      if (typeof englishValue !== "string" || typeof polishValue !== "string") {
        return [];
      }

      const expected = interpolationNames(englishValue);
      const actual = interpolationNames(polishValue);
      if (expected.join() === actual.join()) {
        return [];
      }

      return [`${path}: en=${expected.join(",")} pl=${actual.join(",")}`];
    });

    expect(mismatched).toEqual([]);
  });

  it("puts Polish diacritics in everyday copy", () => {
    expect(polishTranslations.common.retry).toMatch(POLISH_DIACRITICS);
    expect(polishTranslations.onboarding.languageTitle).toMatch(POLISH_DIACRITICS);
    expect(polishTranslations.dash.tileMistakesTitle).toMatch(POLISH_DIACRITICS);
    expect(polishTranslations.profile.languageTitle).toMatch(POLISH_DIACRITICS);
    expect(polishTranslations.paywall.directHeadline).toMatch(POLISH_DIACRITICS);
  });
});
