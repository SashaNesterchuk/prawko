import type { SupportedLocale } from "@prawko/config";

const LOCALE_TAGS: Record<SupportedLocale, string> = {
  pl: "pl-PL",
  ua: "uk-UA",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  cs: "cs-CZ",
  el: "el-GR",
};

export function formatDiagnosticExamDate(
  isoDate: string | null | undefined,
  locale: SupportedLocale
) {
  const date = parseIsoDate(isoDate);

  if (!date) {
    return null;
  }

  return date.toLocaleDateString(LOCALE_TAGS[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
  });
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}
