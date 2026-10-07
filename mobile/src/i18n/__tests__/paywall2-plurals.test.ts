import i18next from "i18next";

import { paywall2Cs, paywall2En, paywall2Pl, paywall2Sk, paywall2Ua } from "../paywall2-copy";
import { pluralKey } from "../plural";

describe("paywall2 trial plurals", () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      compatibilityJSON: "v4",
      lng: "pl",
      resources: {
        pl: { translation: { paywall2: paywall2Pl } },
        en: { translation: { paywall2: paywall2En } },
        ua: { translation: { paywall2: paywall2Ua } },
        cs: { translation: { paywall2: paywall2Cs } },
        sk: { translation: { paywall2: paywall2Sk } },
      },
    });
  });

  it.each([
    ["pl", 1, "Wypróbuj 1 dzień za darmo"],
    ["pl", 3, "Wypróbuj 3 dni za darmo"],
    ["pl", 7, "Wypróbuj 7 dni za darmo"],
    ["en", 3, "Try 3 days free"],
    ["ua", 3, "Спробуй 3 дні безкоштовно"],
    ["ua", 5, "Спробуй 5 днів безкоштовно"],
    ["cs", 3, "Vyzkoušej 3 dny zdarma"],
    ["sk", 7, "Vyskúšaj 7 dní zadarmo"],
  ])("%s: %i days", (lng, count, expected) => {
    expect(i18n.t(pluralKey("paywall2.ctaTrial", count, lng), { lng, count })).toBe(expected);
  });
});
