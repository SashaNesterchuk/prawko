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
    expect(czechTranslations.profile.languageTitle).toBe("Jazyk");
    expect(czechTranslations.question.correctFeedbackTitle).toBe("Správně");
    expect(czechTranslations.exam.resultPassedTitle).toBe("Splněno");
  });
});
