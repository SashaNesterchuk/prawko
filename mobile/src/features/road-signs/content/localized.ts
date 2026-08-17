import type { AppLocale, LocalizedString } from "./types";

export function pickLocalized(
  value: LocalizedString,
  locale: string
): string {
  if (locale === "pl" || locale === "ua" || locale === "en") {
    return value[locale];
  }

  // de/es: no dedicated road-sign copy yet; prefer English over Polish.
  return value.en;
}

export function buildSearchText(
  signId: string,
  name: LocalizedString,
  description?: LocalizedString
): string {
  return [
    signId,
    name.pl,
    name.ua,
    name.en,
    description?.pl,
    description?.ua,
    description?.en,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
