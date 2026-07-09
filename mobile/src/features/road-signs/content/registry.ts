import { buildSearchText, pickLocalized } from "./localized";
import { A1_CONTENT } from "./signs/A-1";
import type { RoadSignContent, SignPractice } from "./types";

const CURATED_SIGNS: Record<string, RoadSignContent> = {
  "A-1": A1_CONTENT,
};

export function getSignContent(signId: string): RoadSignContent | undefined {
  return CURATED_SIGNS[signId];
}

export function hasSignContent(signId: string): boolean {
  return signId in CURATED_SIGNS;
}

export function listCuratedSignIds(): string[] {
  return Object.keys(CURATED_SIGNS);
}

export function getSignDisplayName(
  signId: string,
  locale: string,
  fallbackCode?: string
): string {
  const content = getSignContent(signId);

  if (content) {
    return pickLocalized(content.name, locale);
  }

  return fallbackCode ?? signId;
}

export function getSignDescription(
  signId: string,
  locale: string
): string | undefined {
  const content = getSignContent(signId);

  if (!content) {
    return undefined;
  }

  return pickLocalized(content.description, locale);
}

export function getSignPractices(signId: string): SignPractice[] {
  return getSignContent(signId)?.practices ?? [];
}

export function getCuratedSearchText(signId: string): string {
  const content = getSignContent(signId);

  if (!content) {
    return "";
  }

  return buildSearchText(signId, content.name);
}

export function matchesCuratedSearch(signId: string, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return getCuratedSearchText(signId).includes(normalized);
}
