import { getQuestionTopicCatalogEntry } from "@prawko/config";

import { slovakTranslations } from "../sk";

describe("Slovak UI copy", () => {
  it("provides Slovak copy for the main app surfaces", () => {
    expect(slovakTranslations.languages.sk.label).toBe("Slovenčina");
    expect(slovakTranslations.languages.cs.label).toBe("Čeština");
    expect(slovakTranslations.paywall.title).toBe("Prawko Plus");
    expect(slovakTranslations.offlineMode.title).toBe("Režim offline");
    expect(slovakTranslations.statistics.title).toBe("Štatistiky");
    expect(slovakTranslations.modals.aiTitle).toBe("AI chat");
    expect(slovakTranslations.profile.shareMessage).toBe(
      "Pripravuj sa na vodičské skúšky s Prawko.",
    );
    expect(slovakTranslations.profile.supportEmailSubject).toBe("Podpora Prawko");
    expect(slovakTranslations.profile.languageTitle).toBe("Jazyk");
    expect(slovakTranslations.profile.examCountryTitle).toBe("Krajina skúšky");
    expect(slovakTranslations.question.correctFeedbackTitle).toBe("Správne");
    expect(slovakTranslations.exam.resultPassedTitle).toBe("Splnené");
    expect(slovakTranslations.countries.SK.name).toBe("Slovensko");
    expect(slovakTranslations.signs.categories.A.title).toBe("Výstražné značky");
    expect(slovakTranslations.signs.searchHintDescription).toContain("201");
    const trafficRules = getQuestionTopicCatalogEntry("road_traffic_rules");
    const safeDriving = getQuestionTopicCatalogEntry("safe_driving_principles");
    expect("titleSk" in trafficRules ? trafficRules.titleSk : undefined).toBe(
      "Pravidlá cestnej premávky",
    );
    expect("titleSk" in safeDriving ? safeDriving.titleSk : undefined).toBe(
      "Zásady bezpečnej jazdy",
    );
  });
});
