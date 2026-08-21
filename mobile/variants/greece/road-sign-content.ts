import { createRoadSignContentRegistry } from "../../src/features/road-signs/content/create-registry";

export const {
  getSignMetadata,
  hasSignMetadata,
  getSignPracticeContent,
  hasSignPracticeContent,
  listPracticeSignIds,
  getSignDisplayName,
  getSignDescription,
  getSignPractices,
  getPrimarySignPractice,
  getSignSearchText,
  matchesSignSearch,
} = createRoadSignContentRegistry({ metadata: {} });
