import type { AppLocale, LocalizedString } from "./types";

export function pickLocalized(
  value: LocalizedString,
  locale: string
): string {
  if (locale === "pl" || locale === "ua" || locale === "en") {
    return value[locale];
  }

  return value.pl;
}

export function buildSearchText(
  signId: string,
  name: LocalizedString
): string {
  return [signId, name.pl, name.ua, name.en].join(" ").toLowerCase();
}
