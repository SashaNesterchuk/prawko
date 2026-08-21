import type { RoadSign, RoadSignCategory } from "../types";

export type RoadSignCatalogDefinition = {
  categories: Array<Omit<RoadSignCategory, "count">>;
  signs: RoadSign[];
};
