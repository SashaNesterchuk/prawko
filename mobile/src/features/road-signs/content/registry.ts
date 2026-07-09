import generatedMetadata from "../../../../../data/pl-road-signs-wikimedia/metadata.generated.json";

import { buildSearchText, pickLocalized } from "./localized";
import { A1_PRACTICE_CONTENT } from "./signs/A-1";
import type {
  LocalizedString,
  RoadSignMetadata,
  RoadSignPracticeContent,
  SignPractice,
} from "./types";

type GeneratedRoadSignMetadata = {
  id: string;
  categoryId: RoadSignMetadata["categoryId"];
  name: string;
  description: string;
};

function toLocalizedString(value: string): LocalizedString {
  return {
    pl: value,
    ua: value,
    en: value,
  };
}

const SIGN_METADATA: Record<string, RoadSignMetadata> = Object.fromEntries(
  Object.entries(generatedMetadata as Record<string, GeneratedRoadSignMetadata>).map(
    ([signId, metadata]) => [
      signId,
      {
        id: metadata.id,
        categoryId: metadata.categoryId,
        name: toLocalizedString(metadata.name),
        description: toLocalizedString(metadata.description),
      },
    ]
  )
);

const PRACTICE_CONTENT: Record<string, RoadSignPracticeContent> = {
  "A-1": A1_PRACTICE_CONTENT,
};

export function getSignMetadata(signId: string): RoadSignMetadata | undefined {
  return SIGN_METADATA[signId];
}

export function hasSignMetadata(signId: string): boolean {
  return signId in SIGN_METADATA;
}

export function getSignPracticeContent(
  signId: string
): RoadSignPracticeContent | undefined {
  return PRACTICE_CONTENT[signId];
}

export function hasSignPracticeContent(signId: string): boolean {
  return signId in PRACTICE_CONTENT;
}

export function listPracticeSignIds(): string[] {
  return Object.keys(PRACTICE_CONTENT);
}

export function getSignDisplayName(
  signId: string,
  locale: string,
  fallbackCode?: string
): string {
  const metadata = getSignMetadata(signId);

  if (metadata) {
    return pickLocalized(metadata.name, locale);
  }

  return fallbackCode ?? signId;
}

export function getSignDescription(
  signId: string,
  locale: string
): string | undefined {
  const metadata = getSignMetadata(signId);

  if (!metadata) {
    return undefined;
  }

  return pickLocalized(metadata.description, locale);
}

export function getSignPractices(signId: string): SignPractice[] {
  return getSignPracticeContent(signId)?.practices ?? [];
}

export function getSignSearchText(signId: string): string {
  const metadata = getSignMetadata(signId);

  if (!metadata) {
    return "";
  }

  return buildSearchText(signId, metadata.name);
}

export function matchesSignSearch(signId: string, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return getSignSearchText(signId).includes(normalized);
}
