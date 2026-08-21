import generatedMetadata from "../../../data/pl-road-signs-wikimedia/metadata.generated.json";

import { createRoadSignContentRegistry } from "../../src/features/road-signs/content/create-registry";
import { GENERATED_SIGN_PRACTICE_CONTENT } from "../../src/features/road-signs/content/generatedPractices";
import { A1_PRACTICE_CONTENT } from "../../src/features/road-signs/content/signs/A-1";
import type {
  LocalizedString,
  RoadSignMetadata,
  RoadSignPracticeContent,
} from "../../src/features/road-signs/content/types";

type GeneratedRoadSignMetadata = {
  id: string;
  categoryId: RoadSignMetadata["categoryId"];
  name: string | LocalizedString;
  description: string | LocalizedString;
};

function asLocalized(value: string | LocalizedString): LocalizedString {
  if (typeof value === "string") return { pl: value, ua: value, en: value };
  return { pl: value.pl, ua: value.ua || value.pl, en: value.en || value.pl };
}

const metadata: Record<string, RoadSignMetadata> = Object.fromEntries(
  Object.entries(generatedMetadata as Record<string, GeneratedRoadSignMetadata>).map(
    ([signId, entry]) => [
      signId,
      {
        id: entry.id,
        categoryId: entry.categoryId,
        name: asLocalized(entry.name),
        description: asLocalized(entry.description),
      },
    ]
  )
);

const practices: Record<string, RoadSignPracticeContent> = {
  ...GENERATED_SIGN_PRACTICE_CONTENT,
  "A-1": A1_PRACTICE_CONTENT,
};

export const {
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
} = createRoadSignContentRegistry({ metadata, practices });
