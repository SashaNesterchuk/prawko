// The app's Ukrainian code "ua" is a country code, so Intl falls back to
// English plural rules ("3 дня"). Map it to the language tag "uk".
const PLURAL_LOCALE: Record<string, string> = { ua: "uk" };

/** Picks the CLDR plural key (`<key>_one`, `_few`, `_many`, `_other`) for the app locale. */
export function pluralKey(key: string, count: number, language: string) {
  let category: Intl.LDMLPluralRule = "other";
  try {
    category = new Intl.PluralRules(PLURAL_LOCALE[language] ?? language).select(count);
  } catch {
    // Unknown locale: keep "other".
  }
  return `${key}_${category === "zero" || category === "two" ? "other" : category}`;
}
