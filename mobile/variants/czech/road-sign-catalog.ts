import sourceManifest from "../../../data/cz-road-signs-dopravni-znaceni-eu/manifest.json";

import type { RoadSignCatalogDefinition } from "../../src/features/road-signs/content/variant-catalog";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "../../src/features/road-signs/types";

type SourceSign = {
  id: string;
  name: string;
  categoryPath: string;
  sourcePath: string;
  assetFile: string;
};

const sourceOrigin = "http://www.dopravni-znaceni.eu";

// We keep the shared UI category identifiers, while the titles expose the
// actual Czech legal groups. This avoids pulling Polish-only UI artwork into CZ.
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

const categories: Array<Omit<RoadSignCategory, "count">> = [
  { id: "A", titlePl: "Výstražné dopravní značky", subtitlePl: "Upozorňují na nebezpečí", accent: "amber", iconName: "warning-outline" },
  { id: "G", titlePl: "Značky upravující přednost", subtitlePl: "Určují přednost v jízdě", accent: "blue", iconName: "train-outline" },
  { id: "B", titlePl: "Zákazové dopravní značky", subtitlePl: "Zakazují určité chování", accent: "red", iconName: "close-circle-outline" },
  { id: "C", titlePl: "Příkazové dopravní značky", subtitlePl: "Stanovují povinný způsob jízdy", accent: "blue", iconName: "arrow-forward-circle-outline" },
  { id: "E", titlePl: "Informativní směrové značky", subtitlePl: "Ukazují směry a cíle", accent: "blue", iconName: "navigate-outline" },
  { id: "D", titlePl: "Informativní značky", subtitlePl: "Informují o provozu a službách", accent: "green", iconName: "information-circle-outline" },
  { id: "T", titlePl: "Dodatkové tabulky", subtitlePl: "Upřesňují význam hlavní značky", accent: "amber", iconName: "document-text-outline" },
  { id: "P", titlePl: "Vodorovné dopravní značení", subtitlePl: "Značení přímo na vozovce", accent: "green", iconName: "git-network-outline" },
  { id: "S", titlePl: "Světelné signály", subtitlePl: "Řídí provoz světelnými signály", accent: "red", iconName: "traffic-light-outline" },
  { id: "F", titlePl: "Dopravní zařízení a označení", subtitlePl: "Zařízení, informace a označení vozidel", accent: "green", iconName: "add-circle-outline" },
];

const signs = (sourceManifest.signs as SourceSign[])
  .map((sourceSign): RoadSign | null => {
    const categoryId = categoryIdByPath[sourceSign.categoryPath];
    if (!categoryId) return null;
    return {
      id: sourceSign.id,
      code: sourceSign.id,
      categoryId,
      filename: sourceSign.assetFile,
      imageUrl: `${sourceOrigin}${sourceSign.sourcePath}`,
      previewUrl: `${sourceOrigin}${sourceSign.sourcePath}`,
      searchText: `${sourceSign.id} ${sourceSign.name}`.toLowerCase(),
    };
  })
  .filter((sign): sign is RoadSign => sign != null)
  .sort((left, right) => left.code.localeCompare(right.code, "cs", { numeric: true }));

export const roadSignCatalog: RoadSignCatalogDefinition = { categories, signs };
