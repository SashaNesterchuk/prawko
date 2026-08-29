import { getExamCountry } from "../../state/app-shell";
import type { RoadSignCatalogDefinition } from "./content/variant-catalog";
import type { GreenWaveAccent } from "../../theme/green-wave";
import { getSignDescription, matchesSignSearch } from "./content/registry";
import type { RoadSign, RoadSignCategory, RoadSignCategoryId } from "./types";
import { getRoadSignCatalogForCountry } from "../../countries/road-signs";

type RoadSignIndex = {
  allSigns: RoadSign[];
  signsById: Map<string, RoadSign>;
  categoryIds: RoadSignCategoryId[];
  signsByCategory: Map<RoadSignCategoryId, RoadSign[]>;
  categories: RoadSignCategory[];
};

const indexes = new Map<string, RoadSignIndex>();

function buildIndex(catalog: RoadSignCatalogDefinition): RoadSignIndex {
  const allSigns = [...catalog.signs];
  const signsById = new Map(allSigns.map((sign) => [sign.id, sign]));
  const categoryIds = catalog.categories.map((category) => category.id);
  const signsByCategory = new Map<RoadSignCategoryId, RoadSign[]>(
    categoryIds.map((categoryId) => [
      categoryId,
      allSigns.filter((sign) => sign.categoryId === categoryId),
    ]),
  );

  return {
    allSigns,
    signsById,
    categoryIds,
    signsByCategory,
    categories: catalog.categories.map((category) => ({
      ...category,
      count: signsByCategory.get(category.id)?.length ?? 0,
    })),
  };
}

function getActiveRoadSignIndex() {
  const country = getExamCountry();
  const cached = indexes.get(country);
  if (cached) {
    return cached;
  }

  const index = buildIndex(getRoadSignCatalogForCountry(country));
  indexes.set(country, index);
  return index;
}

export function getRoadSignCategories(): RoadSignCategory[] {
  return getActiveRoadSignIndex().categories;
}

export function getAllRoadSigns(): RoadSign[] {
  return getActiveRoadSignIndex().allSigns;
}

export function getRoadSignById(signId: string): RoadSign | undefined {
  return getActiveRoadSignIndex().signsById.get(signId);
}

export function getRoadSignsByCategory(categoryId: RoadSignCategoryId): RoadSign[] {
  return getActiveRoadSignIndex().signsByCategory.get(categoryId) ?? [];
}

export function getRoadSignCategory(categoryId: string): RoadSignCategory | undefined {
  return getRoadSignCategories().find((category) => category.id === categoryId);
}

export function isRoadSignCategoryId(value: string): value is RoadSignCategoryId {
  return getActiveRoadSignIndex().categoryIds.includes(value as RoadSignCategoryId);
}

export function searchRoadSigns(query: string): RoadSign[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return getAllRoadSigns().filter(
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
