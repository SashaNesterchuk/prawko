import type { GreenWaveAccent } from "../../theme/green-wave";

export type RoadSignCategoryId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "T"
  | "G"
  | "P"
  | "S"
  | "W";

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
  iconName:
    | "warning-outline"
    | "close-circle-outline"
    | "arrow-forward-circle-outline"
    | "information-circle-outline"
    | "navigate-outline"
    | "add-circle-outline"
    | "document-text-outline"
    | "train-outline"
    | "git-network-outline"
    | "traffic-light-outline"
    | "shield-outline";
  count: number;
};
