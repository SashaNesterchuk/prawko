import sourceManifest from "../../../data/cz-road-signs-dopravni-znaceni-eu/manifest.json";

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
  categoryPath: string;
};

const categoryIdByPath: Record<string, RoadSignCategoryId> = {
  "/znacky/vystrazne-dopravni-znacky/": "A",
  "/znacky/dopravni-znacky-upravujici-prednost/": "G",
  "/znacky/zakazove-dopravni-znacky/": "B",
  "/znacky/prikazove-dopravni-znacky/": "C",
  "/znacky/informativni-smerove-dopravni-znacky/": "E",
  "/znacky/informativni-provozni-dopravni-znacky/": "D",
  "/znacky/informativni-dopravni-znacky/": "D",
  "/znacky/dopravni-znacky-dodatkove-tabulky/": "T",
  "/znacky/vodorovne-dopravni-znacky/": "P",
  "/znacky/svetelne-signaly/": "S",
  "/znacky/dopravni-zarizeni/": "F",
  "/znacky/zarizeni-pro-provozni-informace/": "F",
  "/znacky/specialni-oznaceni-vozidel/": "F",
};

const descriptionPrefixByPath: Record<string, string> = {
  "/znacky/vystrazne-dopravni-znacky/": "Výstražná značka upozorňuje na",
  "/znacky/dopravni-znacky-upravujici-prednost/": "Značka upravující přednost stanovuje",
  "/znacky/zakazove-dopravni-znacky/": "Zákazová značka vyjadřuje zákaz:",
  "/znacky/prikazove-dopravni-znacky/": "Příkazová značka stanovuje povinnost:",
  "/znacky/informativni-smerove-dopravni-znacky/": "Informativní směrová značka poskytuje informaci:",
  "/znacky/informativni-provozni-dopravni-znacky/": "Informativní značka poskytuje informaci:",
  "/znacky/informativni-dopravni-znacky/": "Informativní značka poskytuje informaci:",
  "/znacky/dopravni-znacky-dodatkove-tabulky/": "Dodatková tabulka upřesňuje význam hlavní značky:",
  "/znacky/vodorovne-dopravni-znacky/": "Vodorovné dopravní značení vyznačuje:",
  "/znacky/svetelne-signaly/": "Světelný signál řídí provoz:",
  "/znacky/dopravni-zarizeni/": "Dopravní zařízení označuje nebo zabezpečuje:",
  "/znacky/zarizeni-pro-provozni-informace/": "Zařízení pro provozní informace zobrazuje:",
  "/znacky/specialni-oznaceni-vozidel/": "Zvláštní označení vozidla vyjadřuje:",
};

const sourceSigns = sourceManifest.signs as SourceSign[];

function localized(value: string): LocalizedString {
  // Czech names are official names of the local signs. They remain visible in
  // the English shell too, so learners can match the term used in the exam.
  return { pl: value, ua: value, en: value, cs: value };
}

function descriptionFor(sign: SourceSign): string {
  const prefix = descriptionPrefixByPath[sign.categoryPath] ?? "Dopravní značka označuje:";
  return `${prefix} ${sign.name}.`;
}

const metadata: Record<string, RoadSignMetadata> = Object.fromEntries(
  sourceSigns.map((sign) => [
    sign.id,
    {
      id: sign.id,
      categoryId: categoryIdByPath[sign.categoryPath],
      name: localized(sign.name),
      description: localized(descriptionFor(sign)),
    },
  ])
);

const practices: Record<string, RoadSignPracticeContent> = Object.fromEntries(
  sourceSigns.map((sign, index) => {
    const categoryId = categoryIdByPath[sign.categoryPath];
    const sameGroup = sourceSigns.filter(
      (candidate) => candidate.categoryPath === sign.categoryPath && candidate.id !== sign.id
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
        categoryId,
        practices: [
          {
            id: `${sign.id}-name`,
            prompt: {
              pl: "Jak se jmenuje tato dopravní značka?",
              ua: "Jak se jmenuje tato dopravní značka?",
              en: "What is the name of this Czech road sign?",
              cs: "Jak se jmenuje tato dopravní značka?",
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
