import { getQuestionTopicCatalogEntry } from "@prawko/config";

import { polishTranslations } from "../pl";

describe("Polish UI copy", () => {
  it("uses Polish diacritics on core surfaces", () => {
    expect(polishTranslations.common.retry).toBe("Spróbuj ponownie");
    expect(polishTranslations.common.student).toBe("Uczeń");
    expect(polishTranslations.common.backToHome).toBe("Wróć na początek");
    expect(polishTranslations.languages.pl.label).toBe("Polski");
    expect(polishTranslations.languages.ua.label).toBe("Ukraiński");
    expect(polishTranslations.countries.CZ.name).toBe("Czechy");
    expect(polishTranslations.countries.SK.name).toBe("Słowacja");
    expect(polishTranslations.dash.readinessLevel.mid).toBe("Średnia");
    expect(polishTranslations.profile.languageTitle).toBe("Język");
    expect(polishTranslations.profile.shareMessage).toBe(
      "Ucz się na prawo jazdy z Prawko.",
    );
    expect(polishTranslations.offlineMode.title).toBe("Tryb offline");
    expect(polishTranslations.paywall.ctaFallbackPrice).toBe("24,99 zł");
    expect(polishTranslations.question.correctFeedbackTitle).toBe("Poprawnie");
    expect(polishTranslations.exam.resultPassedTitle).toBe("Zdany");
    expect(polishTranslations.signs.categories.E.title).toBe(
      "Znaki kierunku i miejscowości",
    );
    expect(getQuestionTopicCatalogEntry("signs_signals").titlePl).toBe(
      "Znaki i sygnały drogowe",
    );
  });
});
