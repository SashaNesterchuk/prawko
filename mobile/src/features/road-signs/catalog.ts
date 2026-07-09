import signUrls from "../../../../data/pl-road-signs-wikimedia/urls.json";

import type { GreenWaveAccent } from "../../theme/green-wave";
import { matchesCuratedSearch } from "./content/registry";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "./types";

const CATEGORY_META: Record<
  RoadSignCategoryId,
  Omit<RoadSignCategory, "id" | "count">
> = {
  A: {
    titlePl: "Znaki ostrzegawcze",
    subtitlePl: "Ostrzegają o miejscach niebezpiecznych",
    accent: "amber",
    iconName: "warning-outline",
  },
  B: {
    titlePl: "Znaki zakazu",
    subtitlePl: "Zakazują określonych zachowań",
    accent: "red",
    iconName: "close-circle-outline",
  },
  C: {
    titlePl: "Znaki nakazu",
    subtitlePl: "Wskazują obowiązkowy sposób jazdy",
    accent: "blue",
    iconName: "arrow-forward-circle-outline",
  },
  D: {
    titlePl: "Znaki informacyjne",
    subtitlePl: "Informują o drodze i kierunkach",
    accent: "green",
    iconName: "information-circle-outline",
  },
  F: {
    titlePl: "Znaki uzupełniające",
    subtitlePl: "Doprecyzowują inne znaki",
    accent: "green",
    iconName: "add-circle-outline",
  },
  G: {
    titlePl: "Znaki kolejowe i tramwajowe",
    subtitlePl: "Dotyczą przejazdów i torowisk",
    accent: "blue",
    iconName: "train-outline",
  },
  T: {
    titlePl: "Tablice dodatkowe",
    subtitlePl: "Uzupełniają znaki główne",
    accent: "amber",
    iconName: "document-text-outline",
  },
  W: {
    titlePl: "Znaki wojskowe",
    subtitlePl: "Stosowane na drogach wojskowych",
    accent: "red",
    iconName: "shield-outline",
  },
};

const CATEGORY_ORDER: RoadSignCategoryId[] = ["A", "B", "C", "D", "F", "G", "T", "W"];

function parseCategoryId(filename: string): RoadSignCategoryId | null {
  const match = filename.match(/^PL_road_sign_([A-Z])-/);
  return match ? (match[1] as RoadSignCategoryId) : null;
}

function parseSignCode(filename: string): string {
  return filename.replace(/^PL_road_sign_/, "").replace(/\.svg$/, "");
}

function compareSignCodes(left: string, right: string): number {
  const leftParts = left.split("-");
  const rightParts = right.split("-");

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftPart !== "" && rightPart !== "") {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      continue;
    }

    const result = leftPart.localeCompare(rightPart, "pl", {
      numeric: true,
      sensitivity: "base",
    });

    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

export function getRoadSignPreviewUrl(imageUrl: string, size = 256): string {
  const filename = imageUrl.split("/").pop() ?? "";
  const basePath = imageUrl.replace("https://upload.wikimedia.org/wikipedia/commons/", "");
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${basePath}/${size}px-${filename}.png`;
}

function buildSign(filename: string, imageUrl: string): RoadSign | null {
  const categoryId = parseCategoryId(filename);
  if (!categoryId) {
    return null;
  }

  const code = parseSignCode(filename);

  return {
    id: code,
    code,
    categoryId,
    filename,
    imageUrl,
    previewUrl: getRoadSignPreviewUrl(imageUrl, 256),
    searchText: `${code} ${categoryId} ${filename}`.toLowerCase(),
  };
}

const ALL_SIGNS: RoadSign[] = Object.entries(signUrls)
  .map(([filename, imageUrl]) => buildSign(filename, imageUrl))
  .filter((sign): sign is RoadSign => sign != null)
  .sort((left, right) => compareSignCodes(left.code, right.code));

const SIGNS_BY_ID = new Map(ALL_SIGNS.map((sign) => [sign.id, sign]));

const SIGNS_BY_CATEGORY = CATEGORY_ORDER.reduce(
  (accumulator, categoryId) => {
    accumulator[categoryId] = ALL_SIGNS.filter((sign) => sign.categoryId === categoryId);
    return accumulator;
  },
  {} as Record<RoadSignCategoryId, RoadSign[]>
);

export const ROAD_SIGN_CATEGORIES: RoadSignCategory[] = CATEGORY_ORDER.map((categoryId) => ({
  id: categoryId,
  ...CATEGORY_META[categoryId],
  count: SIGNS_BY_CATEGORY[categoryId].length,
}));

export function getAllRoadSigns(): RoadSign[] {
  return ALL_SIGNS;
}

export function getRoadSignById(signId: string): RoadSign | undefined {
  return SIGNS_BY_ID.get(signId);
}

export function getRoadSignsByCategory(categoryId: RoadSignCategoryId): RoadSign[] {
  return SIGNS_BY_CATEGORY[categoryId] ?? [];
}

export function getRoadSignCategory(
  categoryId: string
): RoadSignCategory | undefined {
  return ROAD_SIGN_CATEGORIES.find((category) => category.id === categoryId);
}

export function isRoadSignCategoryId(value: string): value is RoadSignCategoryId {
  return CATEGORY_ORDER.includes(value as RoadSignCategoryId);
}

export function searchRoadSigns(query: string): RoadSign[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return ALL_SIGNS.filter(
    (sign) =>
      sign.searchText.includes(normalized) ||
      matchesCuratedSearch(sign.id, normalized)
  );
}

export function getCategoryAccent(categoryId: RoadSignCategoryId): GreenWaveAccent {
  return CATEGORY_META[categoryId].accent;
}

export function getSignDescriptionPl(sign: RoadSign): string {
  const category = CATEGORY_META[sign.categoryId];
  return `${category.titlePl}. Znak ${sign.code}.`;
}
