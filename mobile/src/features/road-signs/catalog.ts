import { roadSignCatalog } from "@app-road-sign-catalog";

import type { GreenWaveAccent } from "../../theme/green-wave";
import { getSignDescription, matchesSignSearch } from "./content/registry";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "./types";

const ALL_SIGNS = [...roadSignCatalog.signs];
const SIGNS_BY_ID = new Map(ALL_SIGNS.map((sign) => [sign.id, sign]));
const CATEGORY_IDS = roadSignCatalog.categories.map((category) => category.id);
const SIGNS_BY_CATEGORY = new Map<RoadSignCategoryId, RoadSign[]>(
  CATEGORY_IDS.map((categoryId) => [
    categoryId,
    ALL_SIGNS.filter((sign) => sign.categoryId === categoryId),
  ])
);

export const ROAD_SIGN_CATEGORIES: RoadSignCategory[] = roadSignCatalog.categories.map(
  (category) => ({
    ...category,
    count: SIGNS_BY_CATEGORY.get(category.id)?.length ?? 0,
  })
);

export function getAllRoadSigns(): RoadSign[] {
  return ALL_SIGNS;
}

export function getRoadSignById(signId: string): RoadSign | undefined {
  return SIGNS_BY_ID.get(signId);
}

export function getRoadSignsByCategory(categoryId: RoadSignCategoryId): RoadSign[] {
  return SIGNS_BY_CATEGORY.get(categoryId) ?? [];
}

export function getRoadSignCategory(categoryId: string): RoadSignCategory | undefined {
  return ROAD_SIGN_CATEGORIES.find((category) => category.id === categoryId);
}

export function isRoadSignCategoryId(value: string): value is RoadSignCategoryId {
  return CATEGORY_IDS.includes(value as RoadSignCategoryId);
}

export function searchRoadSigns(query: string): RoadSign[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return ALL_SIGNS.filter(
    (sign) => sign.searchText.includes(normalized) || matchesSignSearch(sign.id, normalized)
  );
}

export function getCategoryAccent(categoryId: RoadSignCategoryId): GreenWaveAccent {
  return getRoadSignCategory(categoryId)?.accent ?? "green";
}

export function getSignDescriptionPl(sign: RoadSign): string {
  return (
    getSignDescription(sign.id, "pl") ??
    `${getRoadSignCategory(sign.categoryId)?.titlePl ?? "Znak drogowy"}. Znak ${sign.code}.`
  );
}
