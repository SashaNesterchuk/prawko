import type { RoadSignCategoryId } from "../types";

export type AppLocale = "pl" | "ua" | "en";

export type LocalizedString = Record<AppLocale, string> &
  Partial<Record<"cs", string>>;

export type SignPracticeOption = {
  id: string;
  label: LocalizedString;
};

export type SignPractice = {
  id: string;
  prompt: LocalizedString;
  options: SignPracticeOption[];
  correctOptionId: string;
  explanation?: LocalizedString;
};

export type RoadSignMetadata = {
  id: string;
  categoryId: RoadSignCategoryId;
  name: LocalizedString;
  description: LocalizedString;
};

export type RoadSignPracticeContent = {
  id: string;
  categoryId: RoadSignCategoryId;
  practices: SignPractice[];
};
