import { resources } from "../resources";
import { slovakTranslations } from "../sk";

const SLOVAK_DIACRITICS = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/;

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

describe("Slovak translation coverage", () => {
  const english = resources.en.translation;

  it("covers every English UI key", () => {
    const missing = leafPaths(english).filter((path) => valueAt(slovakTranslations, path) == null);

    expect(missing).toEqual([]);
  });

  it("keeps the same interpolation placeholders as English", () => {
    const mismatched = leafPaths(english).flatMap((path) => {
      const englishValue = valueAt(english, path);
      const slovakValue = valueAt(slovakTranslations, path);

      if (typeof englishValue !== "string" || typeof slovakValue !== "string") {
        return [];
      }

      const expected = interpolationNames(englishValue);
      const actual = interpolationNames(slovakValue);
      if (expected.join() === actual.join()) {
        return [];
      }

      return [`${path}: en=${expected.join(",")} sk=${actual.join(",")}`];
    });

    expect(mismatched).toEqual([]);
  });

  it("puts Slovak diacritics in everyday copy", () => {
    expect(slovakTranslations.common.retry).toMatch(SLOVAK_DIACRITICS);
    expect(slovakTranslations.dash.readinessHigh).toMatch(SLOVAK_DIACRITICS);
    expect(slovakTranslations.question.correctFeedbackTitle).toMatch(SLOVAK_DIACRITICS);
    expect(slovakTranslations.profile.examCountryTitle).toMatch(SLOVAK_DIACRITICS);
    expect(slovakTranslations.paywall.directHeadline).toMatch(SLOVAK_DIACRITICS);
  });
});
