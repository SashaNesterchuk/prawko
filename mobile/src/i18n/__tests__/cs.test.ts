import { getQuestionTopicCatalogEntry } from "@prawko/config";

import { czechTranslations } from "../cs";

describe("Czech UI copy", () => {
  it("provides Czech copy for the main app surfaces", () => {
    expect(czechTranslations.languages.cs.label).toBe("Čeština");
    expect(czechTranslations.languages.en.label).toBe("English");
    expect(czechTranslations.paywall.title).toBe("Prawko Plus");
    expect(czechTranslations.offlineMode.title).toBe("Režim offline");
    expect(czechTranslations.statistics.title).toBe("Statistiky");
    expect(czechTranslations.modals.aiTitle).toBe("AI chat");
    expect(czechTranslations.profile.shareMessage).toBe(
      "Připravuj se na řidičské zkoušky s Prawko.",
    );
    expect(czechTranslations.profile.supportEmailSubject).toBe("Podpora Prawko");
    expect(czechTranslations.profile.languageTitle).toBe("Jazyk");
    expect(czechTranslations.profile.examCountryTitle).toBe("Země zkoušky");
    expect(czechTranslations.question.correctFeedbackTitle).toBe("Správně");
    expect(czechTranslations.exam.resultPassedTitle).toBe("Splněno");
    expect(getQuestionTopicCatalogEntry("signs_signals").titleCs).toBe(
      "Značky a signalizace",
    );
    expect(getQuestionTopicCatalogEntry("accidents_first_aid").titleCs).toBe(
      "Nehody a první pomoc",
    );
  });
});
