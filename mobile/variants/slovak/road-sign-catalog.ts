import sourceManifest from "./source-manifest.json";

import type { RoadSignCatalogDefinition } from "../../src/features/road-signs/content/variant-catalog";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "../../src/features/road-signs/types";

type SourceSign = {
  id: string;
  code: string;
  name: string;
  categoryId: RoadSignCategoryId;
  filename: string;
  imageUrl: string;
  previewUrl: string;
};

const categories: Array<Omit<RoadSignCategory, "count">> = [
  { id: "A", titlePl: "Výstražné značky", subtitlePl: "Upozorňujú na nebezpečenstvo", accent: "amber", iconName: "warning-outline" },
  { id: "G", titlePl: "Značky upravujúce prednosť", subtitlePl: "Určujú prednosť v jazde", accent: "blue", iconName: "train-outline" },
  { id: "B", titlePl: "Zákazové značky", subtitlePl: "Zakazujú určité správanie", accent: "red", iconName: "close-circle-outline" },
  { id: "C", titlePl: "Príkazové značky", subtitlePl: "Stanovujú povinný spôsob jazdy", accent: "blue", iconName: "arrow-forward-circle-outline" },
  { id: "E", titlePl: "Informatívne smerové značky", subtitlePl: "Ukazujú smery a ciele", accent: "blue", iconName: "navigate-outline" },
  { id: "D", titlePl: "Informatívne značky", subtitlePl: "Informujú o premávke a službách", accent: "green", iconName: "information-circle-outline" },
  { id: "T", titlePl: "Dodatkové tabuľky", subtitlePl: "Upresňujú význam hlavnej značky", accent: "amber", iconName: "document-text-outline" },
];

const categoryIds = new Set(categories.map((category) => category.id));

const signs = (sourceManifest.signs as SourceSign[])
  .map((sourceSign): RoadSign | null => {
    if (!categoryIds.has(sourceSign.categoryId)) return null;
    return {
      id: sourceSign.id,
      code: sourceSign.code,
      categoryId: sourceSign.categoryId,
      filename: sourceSign.filename,
      imageUrl: sourceSign.imageUrl,
      previewUrl: sourceSign.previewUrl,
      searchText: `${sourceSign.code} ${sourceSign.name}`.toLowerCase(),
    };
  })
  .filter((sign): sign is RoadSign => sign != null)
  .sort((left, right) => left.code.localeCompare(right.code, "sk", { numeric: true }));

export const roadSignCatalog: RoadSignCatalogDefinition = { categories, signs };
