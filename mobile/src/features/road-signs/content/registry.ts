import { getExamCountry } from "../../../state/app-shell";
import { getRoadSignContentForCountry } from "../../../countries/road-signs";

function getActiveRoadSignContent() {
  return getRoadSignContentForCountry(getExamCountry());
}

export function getSignMetadata(signId: string) {
  return getActiveRoadSignContent().getSignMetadata(signId);
}

export function hasSignMetadata(signId: string) {
  return getActiveRoadSignContent().hasSignMetadata(signId);
}

export function getSignPracticeContent(signId: string) {
  return getActiveRoadSignContent().getSignPracticeContent(signId);
}

export function hasSignPracticeContent(signId: string) {
  return getActiveRoadSignContent().hasSignPracticeContent(signId);
}

export function listPracticeSignIds() {
  return getActiveRoadSignContent().listPracticeSignIds();
}

export function getSignDisplayName(
  signId: string,
  locale: string,
  fallbackCode?: string,
) {
  return getActiveRoadSignContent().getSignDisplayName(
    signId,
    locale,
    fallbackCode,
  );
}

export function getSignDescription(signId: string, locale: string) {
  return getActiveRoadSignContent().getSignDescription(signId, locale);
}

export function getSignPractices(signId: string) {
  return getActiveRoadSignContent().getSignPractices(signId);
}

export function getPrimarySignPractice(signId: string) {
  return getActiveRoadSignContent().getPrimarySignPractice(signId);
}

export function getSignSearchText(signId: string) {
  return getActiveRoadSignContent().getSignSearchText(signId);
}

export function matchesSignSearch(signId: string, query: string) {
  return getActiveRoadSignContent().matchesSignSearch(signId, query);
}
