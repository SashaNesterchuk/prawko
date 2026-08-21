import { buildSearchText, pickLocalized } from "./localized";
import type {
  RoadSignMetadata,
  RoadSignPracticeContent,
  SignPractice,
} from "./types";

type RoadSignContentRegistryInput = {
  metadata: Record<string, RoadSignMetadata>;
  practices?: Record<string, RoadSignPracticeContent>;
};

export function createRoadSignContentRegistry({
  metadata,
  practices = {},
}: RoadSignContentRegistryInput) {
  function getSignMetadata(signId: string): RoadSignMetadata | undefined {
    return metadata[signId];
  }

  function hasSignMetadata(signId: string): boolean {
    return signId in metadata;
  }

  function getSignPracticeContent(signId: string): RoadSignPracticeContent | undefined {
    return practices[signId];
  }

  function hasSignPracticeContent(signId: string): boolean {
    return signId in practices;
  }

  function listPracticeSignIds(): string[] {
    return Object.keys(practices);
  }

  function getSignDisplayName(signId: string, locale: string, fallbackCode?: string): string {
    const entry = getSignMetadata(signId);
    return entry ? pickLocalized(entry.name, locale) : (fallbackCode ?? signId);
  }

  function getSignDescription(signId: string, locale: string): string | undefined {
    const entry = getSignMetadata(signId);
    return entry ? pickLocalized(entry.description, locale) : undefined;
  }

  function getSignPractices(signId: string): SignPractice[] {
    return getSignPracticeContent(signId)?.practices ?? [];
  }

  function getPrimarySignPractice(signId: string): SignPractice | undefined {
    return getSignPractices(signId)[0];
  }

  function getSignSearchText(signId: string): string {
    const entry = getSignMetadata(signId);
    return entry ? buildSearchText(signId, entry.name, entry.description) : "";
  }

  function matchesSignSearch(signId: string, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return normalized.length > 0 && getSignSearchText(signId).includes(normalized);
  }

  return {
    getSignMetadata,
    hasSignMetadata,
    getSignPracticeContent,
    hasSignPracticeContent,
    listPracticeSignIds,
    getSignDisplayName,
    getSignDescription,
    getSignPractices,
    getPrimarySignPractice,
    getSignSearchText,
    matchesSignSearch,
  };
}
