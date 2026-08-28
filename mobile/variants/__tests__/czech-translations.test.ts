import { getQuestionTopicCatalogEntry } from "@prawko/config";

import { czechTranslations } from "../czech/translations";

describe("Czech variant translations", () => {
  it("provides Czech copy for the main Czech app surfaces", () => {
    expect(czechTranslations.languages).toEqual({
      cs: {
        label: "Čeština",
        description: "České rozhraní a české otázky k teorii řízení.",
      },
      en: {
        label: "English",
        description: "English interface for international learners.",
      },
    });
    expect(czechTranslations.profile.shareMessage).toBe(
      "Připravuj se na řidičské zkoušky s Řidičákem."
    );
    expect(czechTranslations.profile.supportEmailSubject).toBe("Podpora Řidičák");
    expect(czechTranslations.profile.languageTitle).toBe("Jazyk");
    expect(czechTranslations.question.correctFeedbackTitle).toBe("Správně");
    expect(czechTranslations.exam.resultPassedTitle).toBe("Splněno");
    expect(getQuestionTopicCatalogEntry("signs_signals").titleCs).toBe(
      "Značky a signalizace"
    );
    expect(getQuestionTopicCatalogEntry("accidents_first_aid").titleCs).toBe(
      "Nehody a první pomoc"
    );
  });
});
