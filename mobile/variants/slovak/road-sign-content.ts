import sourceManifest from "./source-manifest.json";

import { createRoadSignContentRegistry } from "../../src/features/road-signs/content/create-registry";
import type {
  LocalizedString,
  RoadSignMetadata,
  RoadSignPracticeContent,
} from "../../src/features/road-signs/content/types";
import type { RoadSignCategoryId } from "../../src/features/road-signs/types";

type SourceSign = {
  id: string;
  name: string;
  categoryId: RoadSignCategoryId;
};

const descriptionPrefixByCategory: Record<RoadSignCategoryId, string> = {
  A: "Výstražná značka upozorňuje na",
  G: "Značka upravujúca prednosť stanovuje",
  B: "Zákazová značka vyjadruje zákaz:",
  C: "Príkazová značka stanovuje povinnosť:",
  E: "Informatívna smerová značka poskytuje informáciu:",
  D: "Informatívna značka poskytuje informáciu:",
  T: "Dodatková tabuľka upresňuje význam hlavnej značky:",
  P: "Vodorovné dopravné značenie vyznačuje:",
  S: "Svetelný signál riadi premávku:",
  F: "Dopravné zariadenie označuje alebo zabezpečuje:",
  W: "Vojenská značka označuje:",
};

const sourceSigns = sourceManifest.signs as SourceSign[];

function localized(value: string): LocalizedString {
  return { pl: value, ua: value, en: value, sk: value };
}

function descriptionFor(sign: SourceSign): string {
  const prefix = descriptionPrefixByCategory[sign.categoryId] ?? "Dopravná značka označuje:";
  return `${prefix} ${sign.name}.`;
}

const metadata: Record<string, RoadSignMetadata> = Object.fromEntries(
  sourceSigns.map((sign) => [
    sign.id,
    {
      id: sign.id,
      categoryId: sign.categoryId,
      name: localized(sign.name),
      description: localized(descriptionFor(sign)),
    },
  ])
);

const practices: Record<string, RoadSignPracticeContent> = Object.fromEntries(
  sourceSigns.map((sign, index) => {
    const sameGroup = sourceSigns.filter(
      (candidate) => candidate.categoryId === sign.categoryId && candidate.id !== sign.id
    );
    const fallback = sourceSigns.filter((candidate) => candidate.id !== sign.id);
    const pool = sameGroup.length >= 3 ? sameGroup : fallback;
    const distractors = [0, 1, 2].map(
      (offset) => pool[(index + offset) % pool.length]
    );
    const choices = [sign, ...distractors];
    const orderedChoices = choices.map(
      (_, choiceIndex) => choices[(choiceIndex + (index % choices.length)) % choices.length]
    );
    const correctOptionId = `${sign.id}-option-${sign.id}`;

    return [
      sign.id,
      {
        id: sign.id,
        categoryId: sign.categoryId,
        practices: [
          {
            id: `${sign.id}-name`,
            prompt: {
              pl: "Ako sa volá táto dopravná značka?",
              ua: "Ako sa volá táto dopravná značka?",
              en: "What is the name of this Slovak road sign?",
              sk: "Ako sa volá táto dopravná značka?",
            },
            options: orderedChoices.map((choice) => ({
              id: `${sign.id}-option-${choice.id}`,
              label: localized(choice.name),
            })),
            correctOptionId,
            explanation: localized(descriptionFor(sign)),
          },
        ],
      },
    ];
  })
);

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
