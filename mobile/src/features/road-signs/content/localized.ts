import type { AppLocale, LocalizedString } from "./types";

export function pickLocalized(
  value: LocalizedString,
  locale: string
): string {
  if (locale === "cs") {
    return value.cs ?? value.en;
  }

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
    name.cs,
    description?.pl,
    description?.ua,
    description?.en,
    description?.cs,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
