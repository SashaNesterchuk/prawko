// Metro resolves this alias to the active app variant. The Czech build therefore
// never evaluates Prawko's Polish sign metadata or practice content.
export {
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
} from "@app-road-sign-content";
