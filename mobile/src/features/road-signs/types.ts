import type { GreenWaveAccent } from "../../theme/green-wave";

export type RoadSignCategoryId = "A" | "B" | "C" | "D" | "F" | "G" | "T" | "W";

export type RoadSign = {
  id: string;
  code: string;
  categoryId: RoadSignCategoryId;
  filename: string;
  imageUrl: string;
  previewUrl: string;
  searchText: string;
};

export type RoadSignCategory = {
  id: RoadSignCategoryId;
  titlePl: string;
  subtitlePl: string;
  accent: GreenWaveAccent;
  iconName: "warning-outline" | "close-circle-outline" | "arrow-forward-circle-outline" | "information-circle-outline" | "add-circle-outline" | "train-outline" | "document-text-outline" | "shield-outline";
  count: number;
};
