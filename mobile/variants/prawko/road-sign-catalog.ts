import signUrls from "../../../data/pl-road-signs-wikimedia/urls.json";

import type { RoadSignCatalogDefinition } from "../../src/features/road-signs/content/variant-catalog";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "../../src/features/road-signs/types";

const categories: Array<Omit<RoadSignCategory, "count">> = [
  { id: "A", titlePl: "Znaki ostrzegawcze", subtitlePl: "Ostrzegają o miejscach niebezpiecznych", accent: "amber", iconName: "warning-outline" },
  { id: "B", titlePl: "Znaki zakazu", subtitlePl: "Zakazują określonych zachowań", accent: "red", iconName: "close-circle-outline" },
  { id: "C", titlePl: "Znaki nakazu", subtitlePl: "Wskazują obowiązkowy sposób jazdy", accent: "blue", iconName: "arrow-forward-circle-outline" },
  { id: "D", titlePl: "Znaki informacyjne", subtitlePl: "Informują o drodze i kierunkach", accent: "green", iconName: "information-circle-outline" },
  { id: "E", titlePl: "Znaki kierunku i miejscowości", subtitlePl: "Wskazują kierunki i miejscowości", accent: "blue", iconName: "navigate-outline" },
  { id: "F", titlePl: "Znaki uzupełniające", subtitlePl: "Doprecyzowują inne znaki", accent: "green", iconName: "add-circle-outline" },
  { id: "T", titlePl: "Tabliczki do znaków drogowych", subtitlePl: "Uzupełniają znaki główne", accent: "amber", iconName: "document-text-outline" },
  { id: "G", titlePl: "Znaki dodatkowe", subtitlePl: "Dotyczą przejazdów kolejowych", accent: "blue", iconName: "train-outline" },
  { id: "P", titlePl: "Znaki drogowe poziome", subtitlePl: "Oznakowanie poziome jezdni", accent: "green", iconName: "git-network-outline" },
  { id: "S", titlePl: "Znaki świetlne", subtitlePl: "Sygnalizacja świetlna na drodze", accent: "red", iconName: "traffic-light-outline" },
  { id: "W", titlePl: "Znaki wojskowe", subtitlePl: "Stosowane na drogach wojskowych", accent: "red", iconName: "shield-outline" },
];

function previewUrl(imageUrl: string, size = 256): string {
  const commonsPrefix = "https://upload.wikimedia.org/wikipedia/commons/";
  if (!imageUrl.startsWith(commonsPrefix)) return imageUrl;
  const basePath = imageUrl.slice(commonsPrefix.length).split("?")[0] ?? "";
  const filename = basePath.split("/").pop() ?? "";
  return `${commonsPrefix}thumb/${basePath}/${size}px-${filename}.png`;
}

function compareSignCodes(left: string, right: string): number {
  return left.localeCompare(right, "pl", { numeric: true, sensitivity: "base" });
}

const categoryIds = new Set(categories.map((category) => category.id));
const signs: RoadSign[] = Object.entries(signUrls)
  .map(([filename, imageUrl]) => {
    const categoryId = filename.match(/^PL_road_sign_([A-Z])-/)?.[1] as RoadSignCategoryId | undefined;
    if (!categoryId || !categoryIds.has(categoryId)) return null;
    const code = filename.replace(/^PL_road_sign_/, "").replace(/\.(svg|png|jpe?g)$/i, "");
    return {
      id: code,
      code,
      categoryId,
      filename,
      imageUrl,
      previewUrl: previewUrl(imageUrl),
      searchText: `${code} ${categoryId} ${filename}${code === "E-19" ? " E-19a" : ""}`.toLowerCase(),
    };
  })
  .filter((sign): sign is RoadSign => sign != null)
  .sort((left, right) => compareSignCodes(left.code, right.code));

export const roadSignCatalog: RoadSignCatalogDefinition = { categories, signs };
